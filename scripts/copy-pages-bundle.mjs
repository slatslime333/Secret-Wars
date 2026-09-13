import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distJs = resolve(root, 'dist/assets/game.js');
const distCss = resolve(root, 'dist/assets/game.css');
const outDir = resolve(root, 'assets');
const indexHtml = resolve(root, 'index.html');

if (!existsSync(distJs) || !existsSync(distCss)) {
  console.error('Missing dist/assets/game.js or game.css. Run npm run build first.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(distJs, resolve(outDir, 'game.js'));
copyFileSync(distCss, resolve(outDir, 'game.css'));

const stamp = createHash('sha256').update(readFileSync(distJs)).digest('hex').slice(0, 8);
let html = readFileSync(indexHtml, 'utf8');
html = html.replace(/assets\/game\.css\?v=[A-Za-z0-9._-]+/g, `assets/game.css?v=${stamp}`);
html = html.replace(/assets\/game\.js\?v=[A-Za-z0-9._-]+/g, `assets/game.js?v=${stamp}`);
writeFileSync(indexHtml, html);

console.log(`Copied production bundle to assets/ for GitHub Pages (cache ${stamp}).`);
