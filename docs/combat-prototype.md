# Secret Wars combat prototype

## Demo goal

The first match is a mobile-first combat sandbox. It establishes arena scale, touch input,
movement feel, directional combat, stamina pressure, and readable action feedback before
enemies, character sprites, abilities, minions, XP, scoring, or respawning are introduced.

## Ninja

Ninja is a **Medium Frontliner** and the baseline used to tune future heroes. Every rating is
75/99: Attack, Defense, Health, Stamina, Special Attack, Special Defense, Speed, and Attack
Speed. The prototype HUD uses 100 HP and 100 stamina; the ratings describe relative roster
strength rather than raw meter values.

## Implemented controls

- **Left joystick:** 360-degree movement. A light tilt walks; a committed tilt runs.
- **Right joystick:** aims the orbiting hit marker. Holding continuously performs quick light
  attacks. Three distinct taps inside the combo window make the third hit a heavy finisher.
- **Block:** a 0.35-second directional shield with a four-second cooldown.
- **Dash:** a short burst in the movement direction, or facing direction while stationary,
  with a four-second cooldown.

The right joystick owns aim whenever active. Otherwise, movement updates aim, and the last
direction is retained while idle. Final sprites only need north, south, east, and west-facing
animation sets even though movement remains fully analog.

## Combat feedback

- A persistent aura communicates normal attack range.
- The orbiting marker communicates current attack direction.
- Light attacks use a compact blade arc; heavy attacks use a wider, brighter arc and stronger
  screen feedback.
- Blocking places an energy wall close to the player.
- Dashing leaves stepped air-boost streaks behind the player.
- Attacks, blocking, and dashing consume stamina. Stamina recovers after a short delay.

## Animation/state roadmap

The character state model reserves:

1. IDLE
2. WALK
3. BLOCK
4. NORMAL ATTACK
5. HEAVY ATTACK
6. ABILITY 1
7. ABILITY 2
8. ULTIMATE
9. DASH
10. HURT / STUNNED

Only IDLE, WALK, BLOCK, NORMAL ATTACK, HEAVY ATTACK, and DASH are represented in this
rectangle-based pass. Character art and the remaining combat states come later.
