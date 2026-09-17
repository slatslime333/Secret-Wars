import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distJs = resolve(root, 'dist/assets/game.js');
const distCss = resolve(root, 'dist/assets/game.css');
const outDir = resolve(root, 'assets');
const indexHtml = resolve(root, 'index.html');
const publicDir = resolve(root, 'public');
const iconsOut = resolve(root, 'icons');

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

// Refresh PWA icons into public/ (Vite copies them into dist on build).
execFileSync(process.execPath, [resolve(root, 'scripts/generate-pwa-icons.mjs')], {
  stdio: 'inherit',
});

const copyPublicToRoot = (name) => {
  const src = resolve(publicDir, name);
  if (!existsSync(src)) {
    console.error(`Missing public/${name}`);
    process.exit(1);
  }
  copyFileSync(src, resolve(root, name));
};

copyPublicToRoot('manifest.webmanifest');

const swSource = readFileSync(resolve(publicDir, 'sw.js'), 'utf8');
const swStamped = swSource.replace(
  /secret-wars-offline-v[A-Za-z0-9._-]*/g,
  `secret-wars-offline-v${stamp}`,
);
writeFileSync(resolve(root, 'sw.js'), swStamped);
if (existsSync(resolve(root, 'dist'))) {
  writeFileSync(resolve(root, 'dist/sw.js'), swStamped);
  copyFileSync(resolve(publicDir, 'manifest.webmanifest'), resolve(root, 'dist/manifest.webmanifest'));
}

rmSync(iconsOut, { recursive: true, force: true });
mkdirSync(iconsOut, { recursive: true });
for (const icon of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
  const src = resolve(publicDir, 'icons', icon);
  copyFileSync(src, resolve(iconsOut, icon));
  if (existsSync(resolve(root, 'dist'))) {
    mkdirSync(resolve(root, 'dist/icons'), { recursive: true });
    copyFileSync(src, resolve(root, 'dist/icons', icon));
  }
}

console.log(`Copied production bundle to assets/ for GitHub Pages (cache ${stamp}).`);
console.log('Synced PWA manifest, service worker, and icons to repo root.');
