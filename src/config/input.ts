/**
 * Demo 1 input tunables.
 *
 * Right stick owns the hit marker whenever it is held.
 * Movement may update facing only when the aim stick is idle.
 */
export const INPUT = {
  leftDeadzone: 0.18,
  rightDeadzone: 0.18,
  /** Touch sticks ignore tiny thumb drift so aim does not twitch into an attack. */
  touchLeftDeadzone: 0.24,
  touchRightDeadzone: 0.3,
  /** Mobile aim assist: narrow cone, small pull. The stick still owns the aim. */
  aimAssistConeRad: 0.22,
  aimAssistPull: 0.16,
  aimAssistRangeMul: 1.35,
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
    block: 'SPACE',
    dash: 'SHIFT',
    ability1: 'Q',
    ability2: 'E',
    ultimate: 'F',
  },
} as const;
