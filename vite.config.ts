import { defineConfig } from 'vite';

// GitHub Pages project sites are served under /Secret-Wars/, so production
// asset URLs must include that base path. Keep dev at / so `npm run dev` still
// works at the Vite default root.
//
// Stable asset names let the repo-root Pages deploy load `assets/game.js`
// without hashing. The live site is set to "deploy from branch /", not the
// Vite `dist` artifact, so those files have to exist in git.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Secret-Wars/' : '/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/game.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) {
            return 'assets/game.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
}));
