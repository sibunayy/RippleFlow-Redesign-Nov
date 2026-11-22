// The library's storage on this device. Projects can hold drawings, pictures and sound, which do not fit in
// localStorage, so they live in IndexedDB:
// - projects: the small record each library card needs (name, dates, thumbnail)
// - docs: the full project, as JSON text
// - media: the original image and audio files, shared by duplicates of a project
/* global IDBTransactionMode, IDBValidKey */
export type Meta = { id: string; name: string; created: number; updated: number; dur: number; count: number; f: number; thumb?: string | null };

const STORES = ['projects', 'docs', 'media'];
let conn: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  return conn ||= new Promise((resolve, reject) => {
    const timer = setTimeout(() => { conn = null; reject(new Error('Storage did not open')); }, 4000);
    const r = indexedDB.open('rippleflow-library', 1);
    r.onupgradeneeded = () => { for (const s of STORES) r.result.createObjectStore(s, { keyPath: 'id' }); };
    r.onsuccess = () => { clearTimeout(timer); const d = r.result; d.onclose = () => { conn = null; }; d.onversionchange = () => { d.close(); conn = null; }; resolve(d); };
    r.onerror = () => { clearTimeout(timer); conn = null; reject(r.error); };
  });
}

/** Runs one transaction. Safari can drop the connection while the app is in the background, so it reconnects once. */
async function tx<T>(names: string[], mode: IDBTransactionMode, work: (t: IDBTransaction) => IDBRequest<T> | void, retry = true): Promise<T> {
  try {
    const d = await db();
    return await new Promise<T>((resolve, reject) => {
      const t = d.transaction(names, mode); const req = work(t);
      t.oncomplete = () => resolve(req ? req.result : undefined as T);
      t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
    });
  } catch (e) {
    if (retry && (e as DOMException)?.name === 'InvalidStateError') { conn = null; return tx(names, mode, work, false); }
    throw e;
  }
}

export const listMeta = () => tx<Meta[]>(['projects'], 'readonly', (t) => t.objectStore('projects').getAll());
export const getMeta = (id: string) => tx<Meta | undefined>(['projects'], 'readonly', (t) => t.objectStore('projects').get(id));
export const putMeta = (m: Meta) => tx<unknown>(['projects'], 'readwrite', (t) => { t.objectStore('projects').put(m); });
export const getDocJson = async (id: string) => (await tx<{ json: string } | undefined>(['docs'], 'readonly', (t) => t.objectStore('docs').get(id)))?.json;
/** The card and the project are written together, so one can never be saved without the other. */
export const putProject = (m: Meta, json: string) => tx<unknown>(['projects', 'docs'], 'readwrite', (t) => { t.objectStore('projects').put(m); t.objectStore('docs').put({ id: m.id, json }); });
// Files are stored as raw bytes: WebKit can refuse a Blob inside IndexedDB.
export async function putMedia(id: string, blob: Blob) {
  const buf = await blob.arrayBuffer(), type = blob.type;
  await tx<unknown>(['media'], 'readwrite', (t) => { t.objectStore('media').put({ id, type, buf }); });
}
export async function getMedia(id: string) {
  const r = await tx<{ type: string; buf: ArrayBuffer } | undefined>(['media'], 'readonly', (t) => t.objectStore('media').get(id));
  return r ? new Blob([r.buf], { type: r.type }) : undefined;
}

/** Keeps an imported image or audio file so the project can bring it back later. Returns the id stored on the layer. */
export function rememberMedia(blob: Blob) {
  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  putMedia(id, blob).catch(() => { /* the layer still works until the app closes */ });
  return id;
}

export const mediaIds =(doc: { layers?: { mediaId?: string }[] }) => [...new Set((doc.layers || []).map((l) => l.mediaId).filter(Boolean) as string[])];

/** Deletes a project, then any media file that no other project still uses. */
export async function deleteProject(id: string) {
  await tx<unknown>(['projects', 'docs'], 'readwrite', (t) => { t.objectStore('projects').delete(id); t.objectStore('docs').delete(id); });
  const docs = await tx<{ json: string }[]>(['docs'], 'readonly', (t) => t.objectStore('docs').getAll());
  const used = new Set(docs.flatMap((d) => { try { return mediaIds(JSON.parse(d.json)); } catch { return []; } }));
  const all = await tx<IDBValidKey[]>(['media'], 'readonly', (t) => t.objectStore('media').getAllKeys());
  const gone = all.filter((k) => !used.has(String(k)));
  if (gone.length) await tx<unknown>(['media'], 'readwrite', (t) => { for (const k of gone) t.objectStore('media').delete(k); });
}
