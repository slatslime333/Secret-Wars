# Secret Wars

A mobile-first 2D top-down action fighter built with Phaser, TypeScript, and Vite.

Demo 1 is a small playable combat prototype with **Ninja** as the only hero.
It is not the full 3v3 game.

See `docs/DEMO1.md` for scope, scene flow, the four-phase plan, and config map.

## Live site

GitHub Pages is set to deploy the `main` branch root, not the Vite `dist` folder.
That means `/src/main.ts` cannot run in the browser. The committed files
`assets/game.js` and `assets/game.css` are the playable production bundle.

After gameplay changes, refresh that bundle:

```bash
npm run build:pages
```

Do not merge `devin/1789022920-mobile-combat` (PR #6). Demo 1 on `main` already
replaced that prototype, and merging it would fight the current scenes.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Current status

**Phase 4 — Opponent.** A chasing enemy, KO restart, and hit juice.
Demo 1 is playable end to end.
