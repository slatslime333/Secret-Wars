# Secret Wars

A mobile-first 2D top-down action fighter built with Phaser, TypeScript, and Vite.

Demo 1 is a small playable combat prototype with **Ninja** as the only hero.
It is not the full 3v3 game.

See `docs/DEMO1.md` for scope, scene flow, the four-phase plan, and config map.

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

**Phase 2 — Body.** PLAY spawns Ninja in the arena. Move, aim with the
aura/hitmarker, and hit the dummy. Combo, block, and dash are Phase 3.
