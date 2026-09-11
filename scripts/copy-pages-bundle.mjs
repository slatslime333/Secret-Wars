import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distJs = resolve(root, 'dist/assets/game.js');
const distCss = resolve(root, 'dist/assets/game.css');
const outDir = resolve(root, 'assets');

if (!existsSync(distJs) || !existsSync(distCss)) {
  console.error('Missing dist/assets/game.js or game.css. Run npm run build first.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(distJs, resolve(outDir, 'game.js'));
copyFileSync(distCss, resolve(outDir, 'game.css'));
console.log('Copied production bundle to assets/ for GitHub Pages.');
