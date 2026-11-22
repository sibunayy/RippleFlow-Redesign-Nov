# Phase log

## Phase 0: baseline (done)

- `legacy/ripple-flow-console.html` is a read-only copy of `source/ripple-flow-console.html`. Do not edit it.
- Parity tests live in `tests/parity/` (Playwright). They drive the app only through the page (DOM, ARIA, the SVG stage, localStorage), so the same tests will run against the port.
- Reference screenshots are in `tests/reference/`: 11 views each for WebKit landscape (1180 × 820), WebKit portrait (820 × 1180) and desktop Chromium. They cover dark and light, the Layers panel, the Effects, Easing and Presets tabs, the inspector bottom, the dope sheet, the graph, the More menu and the Export dialog.
- Result: 220 tests pass on the legacy file (7 more are skipped on purpose because they apply to only one orientation). The full suite passed 3 times in a row (660 of 660).

### What the tests found in the prototype (ported as is, not fixed)

These are recorded so that nobody "fixes" them by accident during the port. Fix only with Nathan's approval.

1. The strip's Undo / Redo buttons do not update after Hide or Lock, because those actions only redraw the panels. Ctrl+Z and the two-finger tap still work.
2. Moving the playhead does not redraw the inspector, so the Drawing section's cel buttons (for example Clear) can show the state of the previous frame until the panel redraws.
3. A layer that fills the whole timeline cannot be slid in time (there is no room). Trim it first.
4. The brief says 25 effects. The source defines 23 (all 23 are in the Add effect menu and all are tested).
5. In portrait, the inspector sheet covers the right part of the quick action bar.

### Test environment notes

- Playwright's WebKit on Windows has no WebCodecs and no WebGPU. There, the MP4 test checks the app's "needs WebCodecs" message and shaders run on the WebGL2 fallback. Desktop Chromium runs the real MP4 encode. Real iPad Safari still needs a manual check in phase 5.
- Touch, Pencil (pressure and tilt), pinch and multi-finger taps are simulated with synthetic pointer and touch events. A small test-only shim lets `setPointerCapture` accept these synthetic pointers. App code is not changed.

## Phase 1: scaffold (done)

- Vite 6 + TypeScript 5 (build tools only; still no runtime dependencies). `npm run dev` starts the app, `npm run build` writes `dist/`, `npm run preview` serves the build.
- `index.html` holds the DOM skeleton, copied verbatim. `src/legacy-main.ts` holds the whole prototype script, copied verbatim (with `// @ts-nocheck` for now).
- The CSS is split into `src/styles/00-host.css` … `11-inspector-v8.css` and imported in the source order through `src/styles/index.css`. The v8 inspector pass loads last. `scripts/extract-phase1.mjs` made the split and checks that the joined CSS equals the source byte for byte.
- CSS minification is off in the build so the CSS text stays exactly as written.
- The build uses relative paths (`base: './'`), so it works from any folder, including a GitHub Pages sub-path.
- Result: all 220 parity tests pass on the build (`npm run test:parity:app`) and on the dev server (`RF_TARGET=dev`). All 33 screenshots match the reference with zero pixel difference in WebKit.

### Quirk found while porting (kept)

6. The text-animator rule `.anim:first-child { padding-top: 0; border-top: 0 }` also matches the app frame (`<div class="app anim">`) when it is the first element in `<body>`. In the prototype a `<style>` tag came first, so the frame kept a 6 px top padding and a 1 px top line. `index.html` keeps an element (`<noscript>`) before the frame so the look stays the same.

### Test change

- The export Cancel test now waits up to 30 s for the cancel to take effect, because the export checks for Cancel between frames and one 4K frame can take several seconds on the dev server.

## Phase 2: split into modules (done)

- The script is now 92 TypeScript modules in `src/` (layout below). The code inside each function is unchanged; the split was done by tools in `scripts/split/` that read the code's structure with the TypeScript checker, not by hand.
- Shared document state stays in one place: `layers`, `markers`, `DUR`, `projName` and `compBg` live in `model/project.ts`; the UI state `S` in `state/state.ts`. Undo and redo still replace `layers`, and every module reads the current value.
- A variable that other modules change gets a small setter (for example `setLayers`, `setDragging`, `setSuppressClick`). The setters only assign; nothing else changed.
- Event listeners are registered by a `listen()` function per module. `main.ts` calls them in the original order, then boots the app exactly as before.
- The 153 tap actions (`A`, keyed by `data-act`) are split into 13 files in `actions/map/` (app, layers, inspector, keys, effects, timeline, drawing, export, pen, presets, procedural, shader, view) and merged back into one map in `actions/index.ts`.
- The inspector follows HANDOFF section 8: `ui/inspector/header.ts`, `transform.ts`, `layer.ts`, `content-text.ts`, `content-shape.ts`, `content-path.ts`, `content-audio.ts`, `paint.ts`, `extras.ts`, `controls.ts`, assembled by `props-view.ts`.
- New check: `tests/parity/10-dom-parity.spec.ts` loads the legacy file and the build side by side and requires the same HTML in the inspector (all sections unfolded), timeline, stage, top bar and strips, for the demo and after inserting each of 13 layer types.
- ESLint (`npm run lint`) reports no undefined names, so every module imports what it uses. Style findings in the prototype's own code are kept as warnings.
- Result: 234 of 234 tests pass on the legacy file, the build and the dev server. No circular-import errors at runtime.

```
src/
  main.ts                 entry: styles, modules, listeners, boot
  core/        dom ($, $$, esc), store (rfp- localStorage)
  model/       schema (PROPS, GROUPS), project (layers, load, save)
  state/       state (S), history (undo/redo), selection
  anim/        easing, interpolate (val), keys, clipboard, pose
  render/      stage, shapes, text, guides
  fx/          defs, filters
  shader/      presets, runtime (WebGPU / WebGL2), ui
  drawing/     cels, raster, ink, brush-bar, overlay
  export/      dialog, raster, gif, png, zip, lottie, mp4
  playback/    loop, audio
  ui/          topbar, strips, left-panel, presets, floats, timeline, graph, popovers, color-picker,
               dialog, toast, layout, autofold, text-animators, icons, inspector/*
  actions/     index (A), map/*, layers, presets, align
  gestures/    canvas, drags, reorder, handles, timeline, cel-timeline, area-select
  events/      delegate (click, change, input, pointerdown router), keyboard
  styles/      00-host.css … 11-inspector-v8.css (source order)
```

## Phase 3: types

- Removed `// @ts-nocheck` from every file. `npm run typecheck` (tsc) is clean.
- `src/model/types.ts` describes the saved document: Layer, Prop, Key, Effect, Cel, Stroke, Marker, Project.
  `project.ts` and `schema.ts` use these types. They describe the existing data; no field was added.
- `strict` is still off. The prototype relies on loose JavaScript (objects grown field by field,
  optional arguments), so strict mode is a later clean-up, not part of the port.
- Two helper scripts in `scripts/types/` made the bulk changes, both type-only:
  - `optional-params.mjs` marks parameters the prototype leaves out as optional.
  - `annotate-open-objects.mjs` marks objects built up field by field as `any`.
- Browser APIs that TypeScript's built-in types do not cover (WebGPU, `webkitAudioContext`,
  the Claude host's `window.claude`) are reached through `as any` casts. No new packages were added.
- Class fields on `GifOut` use `declare`, so the compiled JavaScript is unchanged.
- Parity: 234/234 on the build. tsc is clean, and lint shows 0 errors (24 style warnings carried over
  from the prototype).

## Phase 4: unit tests

- Vitest (dev only) with happy-dom. `npm run test:unit` runs 25 tests in `tests/unit/`:
  - Animation: `bez`, `val`, `pose` (flips, behaviours), `mat`, `world` (parenting).
  - Export: `lzw` (round-trip through a reference decoder), `medianCut`, `zipStore` (CRC, offsets),
    `muxMp4` (box sizes, `stco` offset, sample sizes and keyframes), and the Lottie builders
    `lrgb`, `lprop`, `lgeom`, `lpaint`.
- To make them testable, `medianCut`, `lzw`, `muxMp4`, `lrgb`, `lprop`, `lgeom` and `lpaint` are now exported.
  Nothing else changed.
- `tests/unit/setup.ts` loads the page skeleton from `index.html`, because some modules look up their
  elements when they load, as the prototype did.
- `.github/workflows/ci.yml` runs typecheck, lint, unit tests and the build on GitHub. The screenshot
  parity suite stays local, because its reference images depend on the machine's fonts.
- Parity: 234/234 on the build.

## Phase 5: host adapter

- `src/host/save-file.ts` is the only code that knows where the app runs. Export Save calls it:
  1. Inside the Claude artifact host, it uses the host's downloads service, as the prototype did.
  2. On a touch device that can share files (iPad Safari), it opens the share sheet: Save to Files,
     or Save Video / Save Image for MP4 and GIF. Closing the sheet does nothing.
  3. Everywhere else, and if sharing fails, it uses a normal download link.
  Nothing is awaited before `navigator.share`, because Safari only allows it straight after the tap.
- `index.html` head: title "RippleFlow", `lang="en"`, a description, `viewport-fit=cover`.
  The `claude:viewport-fit-sides` meta is gone.
- `00-host.css` stays first in the cascade. It holds the base body styles and the safe-area padding.
  Only a comment explaining where it came from was added.
- New `tests/parity/11-host-save.spec.ts` (port only) stubs the share sheet. It checks that Save shares the
  file and does not download, and that closing the sheet shows no error.
- Parity: 238/238 on the build and on the dev server. Legacy: 234/234. Unit: 25/25.
- Not yet checked on a real iPad. Playwright WebKit has no share sheet.

## Phase 6: install and offline (PWA)

Nathan approved this phase (HANDOFF section 13, decision 3).

- `public/manifest.webmanifest`: name "RippleFlow", standalone, dark background `#0e0d0c` (`--bg`).
- Icon: `public/icon.svg` shows rings spreading from a point, in the app's accent blue on `--bg`.
  `node scripts/make-icons.mjs` renders the PNGs (192, 512, 180 for the iPad home screen). Replace the SVG
  and rerun the script to change the icon.
- `index.html` head: manifest, icons, `theme-color`, and the Apple web-app tags (black-translucent status
  bar; the safe-area padding in `00-host.css` keeps the UI clear of it).
- Service worker, hand-written with no libraries: `pwa/sw.template.js`. At build time, `pwa/vite-plugin-sw.ts`
  adds the list of built files and a version from their contents. It caches every file on install.
  Page loads go to the network first, so updates arrive at once, and use the cache when offline.
  A new build clears the old cache. The worker is registered only in the production build (`src/host/pwa.ts`).
- New `tests/parity/12-pwa.spec.ts` (build only): the manifest and icons load, and the app reloads with the
  network off.
- Parity: 242/242 on the build, 238/238 on the dev server. Unit: 25/25.

## Post-V1 edits: Notion test checklist, "Bugs/Fixes that need to be made"

These change the UI on purpose, so the screenshots and the legacy DOM comparison no longer apply (see below).
Work is local and on the Claude artifact copy only. Nothing has been pushed to GitHub since V1.

1. **Two-finger undo keeps the selection.** The first finger of the tap used to deselect (empty canvas) before the
   second landed. The selection from the moment the first finger touched is restored after undo/redo.
2. **Properties panel.**
   - Explainer text moved into small (i) buttons that open a pop-out (`info()` in `controls.ts`, pop-out in `popovers.ts`).
   - Header is one line, "Layer type – name", the name underlined and editable. The two-line header and the boxed rename field are gone.
   - Align is a pop-out button in the right strip, above Help. Easing moved down beside it.
   - Behaviours moved to the Effects tab as their own section. Duplicator has its own tab (right strip, under Effects).
   - Properties now has Transform, Layer, Appearance (and Fill), Text animators, Timing & links.
3. **Zoom pill.** Safe area and Grid buttons are gone. One header button, next to the ⋯ menu, cycles Off, Safe areas, Grid.
4. **Behaviours.** "Add behaviour" opens a menu like Add effect.
5. **Duplicator.** Own tab (item 2).
6. **Layer Hide / Lock / Solo** are small icons at the top of Transform.
7. **Frame by frame.** A header toggle (centre) opens a drawing workspace: left panel folded, a brush panel on the
   right (tool, brush, size, opacity, smoothing, colour, pressure, tilt, onion skin, cel stepping and adding),
   timeline at 30% height. Switching it off restores the panels, timeline and tool. New **pen smoothing**
   (Brush option, default 20%) steadies strokes and ends exactly where the pen lifts.

Interpretations to confirm with Nathan: "Easing tabs above the help button" is the Easing tab button moved down
beside Align; "Behaviours in the Effects tab" is one Behaviours section.

Tests: the controls that moved were updated, new tests cover selection after undo, info pop-outs, header, overlay
cycle, behaviours menu, Duplicator tab, workspace toggle and smoothing. Reference screenshots were re-taken
(`tests/reference/`). `10-dom-parity` is skipped unless `RF_LEGACY_PARITY=1`, because the DOM now differs from the
prototype on purpose. New styles are in `src/styles/12-edits.css`, loaded after the v8 inspector block.

Artifact copy: `npm run build:artifact` writes `dist-artifact/`; the page fragment is `dist-artifact/rippleflow.html`.

## Notion checklist, round 2: every unchecked item (2026-11-20)

- **Parenting.** A child now remembers where its parent was when they were linked (`l.pw`, `parentRef()` in
  `anim/pose.ts`), so moving a parent with no keyframes moves the child too.
- **Text keyboard.** `host/touch-guard.ts` shrinks the page to the visible area while the on-screen keyboard is open,
  so the field being edited stays in view.
- **Dash.** Dragging a field that has no value yet starts from its minimum instead of doing nothing; Gap and Offset
  get starting values as soon as Dash is on.
- **Duplicator grid.** Rows use Spacing Y (it was 0, so grid looked like a line); switching to grid fills it in.
- **Effects.** Glow and Outline colours, Drop shadow distance and angle, Roughen styles (smooth, jagged, torn),
  RGB split is now Chromatic aberration (lens or linear), Glitch has four styles plus an Offset that reaches outside
  the layer. Vignette, Pixelate and Halftone were rebuilt without large images or oversized filter areas (the cause of
  the Safari breakage). New **Shader fill** effect puts a shader inside any shape or photo. New **Bake effects into
  layer** (`fx/bake.ts`) turns a layer and its filter effects into one picture, keeping its movement.
- **Shaders.** The GPU canvas is now copied into a plain 2D canvas on the stage, so shader layers clip to the
  composition and scale with zoom in Safari.
- **Gestures.** Safari pinch-zoom, edge back-swipe, text selection and the long-press callout are blocked on the
  canvas; double-tap zoom is off.
- **Performance.** Undo history is capped at 60 steps (it grew without limit, which can crash Safari after long
  sessions). Dragging an effect slider redraws only that layer's filter.
- **iPhone layout.** No outer frame, tool strips scroll, the canvas fits above the settings sheet, and the timeline
  keeps room for the time readout.

Tests: `tests/parity/13-checklist-fixes.spec.ts` and a parenting unit test. The Add effect menu now lists 24.
Effects-tab reference screenshots were re-taken. Not testable without a device: the real keyboard, Home Screen safe
areas, Safari's back-swipe, and frame rate on an iPad.

## Full-screen fix (Safari and Home Screen app)

- **Black bars.** The app was drawn as a rounded card with a margin, plus the status bar and home bar space, so the dark
  page showed above and below it. The app now fills the screen. The system's space takes the header colour.
- **Scaling.** The app shell and the inspector's Animation section share the class name `anim`, so that section's
  padding, gaps and border were applied to the whole app. They are now cleared on the shell (`12-edits.css`).
- Reference screenshots were re-taken for this intended change. Not testable without a device: real status bar and home
  bar spacing on an iPad.
