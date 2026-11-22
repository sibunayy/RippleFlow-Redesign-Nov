// Builds the private Claude artifact copy of the app: npm run build:artifact
// Output: dist-artifact/rippleflow.html (a page fragment) plus assets/app.js and assets/app.css.
// The artifact host wraps the fragment in its own document, so the fragment has no <html>, <head> or <body>.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

execSync('npx vite build --mode artifact', { stdio: 'inherit' });
const h = fs.readFileSync('dist-artifact/index.html', 'utf8');
const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(h)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
const page = '<title>RippleFlow</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="stylesheet" href="assets/app.css">\n'
  + body + '\n<script type="module" src="assets/app.js"></script>\n';
fs.writeFileSync('dist-artifact/rippleflow.html', page);
console.log('wrote dist-artifact/rippleflow.html');
