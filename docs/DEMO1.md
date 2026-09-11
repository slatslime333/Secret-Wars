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

## Ninja is the only hero

Ninja is the first and only playable character. Average generalist. Every
primary rating is **70/99**. That 70 is a design rating — convert it through
`src/config/ratings.ts` / `src/config/ninja.ts`. Do not hardcode 70 in combat
code. Do not add a roster or character select.

Ninja's melee range is **low-to-medium**. He is not a zoner.

The aura / hit marker around Ninja **is** the attack-direction system. Do not
replace it with a generic "swing toward cursor" with no readable hit area.

## Player-facing loop

```
Boot → Title → Main Menu ⇄ Settings
                 ↓ PLAY
               Battle (Ninja vs dummy) → MENU / ESC → Main Menu
```

PLAY must enter a real battle. Spawn as Ninja. Control immediately.

## Four phases

| Phase | Goal | Touch | Gate |
| --- | --- | --- | --- |
| **1 Shell** | Menus and PLAY open an arena | `scenes/`, `ui/`, `config/` | Title → Menu → Settings → Battle → back |
| **2 Body** | Ninja walks, aims, hits a dummy | `input/`, `heroes/`, `combat/` | Independent aim; dummy takes a hit |
| **3 Fight feel** | Combo finisher, block, dash, stamina empty | `combat/`, `config/` | Checkpoints: combo → block → dash |
| **4 Opponent** | Chaser enemy, restart, juice | `ai/`, HUD polish | The 17-point list below |

Phase 2 includes light damage, knockback, stamina drain, and hit feedback so a
hit can be evaluated. Combo / block / dash remain Phase 3.

## Config map

- `src/config/ninja.ts` — 70/99 ratings and converted gameplay values
- `src/config/ratings.ts` — `fromRating()`
- `src/config/combat.ts` — arc, stamina cost, block/dash timings
- `src/config/input.ts` — sticks, keyboard, right-stick priority
- `src/config/arena.ts` — medium battlefield size and spawns
- `src/ui/theme.ts` — colors, canvas size

## Input

- Mobile: left stick move, right stick aim + hold-to-quick-attack
- Right stick **wins** the hit marker while held
- PC: WASD/arrows move, mouse aim, hold click or J to attack
- Block K / dash L exist in config only until Phase 3

## Architecture rules

- One concern per file. Keep files roughly 150–250 lines.
- `Battle` orchestrates. Hit math lives in `combat/`.
- Future heroes can copy `NinjaBody`; do not build a roster now.
- Names should be obvious. Comments explain why.

## Intentionally not in Demo 1

Hero roster, unique abilities, 3v3, match clock, minion waves, XP, scoring,
respawn, advanced AI, campaign, shops, online, saves.

Remembered for later:

- Minion kills grant XP and a small heal. Hero kills grant team score, not XP.
- Dead heroes grant the enemy 1 point and wait 15 seconds to respawn.

## Conflicts resolved in Phase 2

- Phase 1 used a temporary name "Warden". **Ninja** is the source of truth.
- Phase 1 arena was viewport-sized. Phase 2 uses a larger world + camera follow.
- An older unmerged prototype used 75/99. Spec is **70/99**.
- Combo, block, and dash are specified for the finished demo, not this phase.

## Demo 1 complete when

1. Launch Secret Wars
2. See the original visual identity
3. Navigate title and menu
4. Open settings
5. Press PLAY
6. Enter an actual battle
7. Control Ninja
8. Aim with the aura/hitmarker independently of movement
9. Attack the dummy
10. See health and damage
11. Experience knockback
12. Use stamina
13. Test the 3-hit combo
14. Test block (0.35s, 4s cooldown)
15. Test dash (4s cooldown)
16. Fight a basic enemy
17. Restart or return to the menu

Phase 2 needs items 1–12 except full stamina-empty feel can be proven by holding
attack, plus return to menu. Items 13–16 are Phases 3–4.
