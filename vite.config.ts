import { defineConfig } from 'vite';

// GitHub Pages project sites are served under /Secret-Wars/, so production
// asset URLs must include that base path. Keep dev at / so `npm run dev` still
// works at the Vite default root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Secret-Wars/' : '/',
}));
