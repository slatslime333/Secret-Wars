/**
 * Demo 1 input tunables.
 *
 * Right stick owns the hit marker whenever it is held.
 * Movement may update facing only when the aim stick is idle.
 */
export const INPUT = {
  leftDeadzone: 0.18,
  rightDeadzone: 0.18,
  /** Mini ability/shield pads: high enough that a tap-hold keeps current facing. */
  aimPadDeadzone: 0.24,
  stickRadius: 68,
  mouseAimDeadzone: 12,
  keyboard: {
    up: 'W',
    down: 'S',
    left: 'A',
    right: 'D',
    attack: 'J',
    block: 'K',
    dash: 'L',
    ability1: 'Q',
    ability2: 'E',
    ultimate: 'F',
  },
} as const;
