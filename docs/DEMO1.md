# Secret Wars — Demo 1

This is the working contract for the first playable demo. Read this file plus the
folder you are changing. Do not reload the entire repository or the original
design dump unless a rule here is actually missing.

## Identity

SECRET WARS is a 2D top-down action fighter. Demo 1 is **not** the full 3v3 game.

It must feel fast, tanky, impactful, chaotic, and like a living pixel comic:
dark ink, paper whites, cyan/red contrast, choppy stepped motion. Original art
only. Do not copy Pokémon characters, sprites, UI, or logos.

The question Demo 1 has to answer:

> Is the core combat fun and responsive?

## Player-facing loop

```
Boot → Title → Main Menu ⇄ Settings
                 ↓ PLAY
               Battle → MENU / ESC → Main Menu
```

PLAY must enter a real battle scene, never a placeholder card.

Demo 1 battle contents (by the end of Phase 4):

- One player hero, one simple enemy, one medium arena
- Move, independent aim, basic attack, 3-hit combo, block, dash
- Health, stamina, knockback, hit feedback
- Restart or return to menu

## Four phases

Work one phase at a time. Do not start the next phase until the gate passes.

| Phase | Goal | Touch | Gate |
| --- | --- | --- | --- |
| **1 Shell** | Menus and PLAY open an empty arena | `scenes/`, `ui/`, `config/`, `audio/` | Title → Menu → Settings → Battle → back |
| **2 Body** | Walk, aim, hit a stationary dummy | `input/`, `heroes/`, Battle, hit detection | Independent aim; dummy takes a hit |
| **3 Fight feel** | HP, knockback, stamina, combo, block, dash | `combat/`, `config/` | All verbs work vs dummy. Checkpoints: numbers → combo → block → dash |
| **4 Opponent** | Chaser enemy, HUD, restart, light juice | `ai/`, battle HUD | The 17-point list below |

Freeze finished phases. After Phase 2, do not rewrite movement unless a later
phase proves it is broken.

## Config map

Change gameplay numbers here, not inside scenes:

- `src/config/combat.ts` — damage, stamina costs, block/dash timings, knockback
- `src/config/hero.ts` — demo hero health, stamina, move speed
- `src/config/input.ts` — stick deadzones, keyboard bindings
- `src/config/arena.ts` — arena size, wall thickness, spawn points
- `src/config/audio.ts` — default volumes, storage key
- `src/ui/theme.ts` — colors, fonts, canvas size

Volume lives in `src/audio/AudioSettings.ts` and persists in localStorage.

## Architecture rules

- One concern per file. Keep files roughly 150–250 lines.
- `Battle` orchestrates. Combat math does not live in the scene forever.
- Player and enemy share one hero body later. AI is a driver, not a second combat system.
- Names should be obvious: `CombatSystem`, `DashController`, `PlayerController`.
- Comments explain why and important rules, not every line.
- Do not build empty 3v3 / minion / XP frameworks. Folders are created when the phase needs them.

## Intentionally not in Demo 1

Hero roster, unique abilities, 3v3, 3-minute match clock, minion waves, XP,
minion heal, hero score, respawn, advanced AI, campaign, shops, equipment,
online multiplayer, saves.

Remembered for later, not implemented now:

- Minion kills grant XP and a small heal. Hero kills grant team score, not XP.
- Dead heroes grant the enemy 1 point and wait 15 seconds to respawn.

## Demo 1 complete when

1. Launch Secret Wars
2. See the original visual identity
3. Navigate title and menu
4. Open settings (music, SFX, PC fullscreen, controls help)
5. Press PLAY
6. Enter an actual battle (not a placeholder)
7. Control a hero
8. Aim attacks independently of movement
9. Attack something
10. See health and damage
11. Experience knockback
12. Use stamina
13. Test the 3-hit combo
14. Test block (0.35s, 4s cooldown)
15. Test dash (4s cooldown)
16. Fight a basic enemy
17. Restart or return to the menu

Phase 1 only needs items 1–6, with battle as an empty arena you can leave.
