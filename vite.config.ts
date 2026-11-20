import { defineConfig } from 'vite';
import { serviceWorker } from './pwa/vite-plugin-sw';

// RippleFlow build settings.
// base './' keeps every asset path relative, so the built app works from any folder or GitHub Pages path.
// `vite build --mode artifact` makes the Claude artifact copy: fixed file names, no service worker, no source maps.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    base: './',
    plugins: artifact ? [] : [serviceWorker()], // sw.js is for offline use on the real site (phase 6)
    server: { port: 5180, strictPort: false },
    build: {
      target: 'safari16.4', // iPadOS 16.4+ is the primary target
      cssTarget: 'safari16.4',
      outDir: artifact ? 'dist-artifact' : 'dist',
      sourcemap: !artifact,
      cssMinify: false, // keep the CSS text as written, so the cascade is byte-for-byte the prototype's
      ...(artifact ? { rollupOptions: { output: { entryFileNames: 'assets/app.js', assetFileNames: 'assets/app[extname]' } } } : {}),
    },
  };
});
