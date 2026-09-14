/** Shared war-torn battlefield colors. Muted, ink-outlined, Secret Wars. */
export const ENV = {
  ink: 0x101410,
  inkSoft: 0x1a211e,
  paper: 0xe8e0cc,
  concrete: 0x5e645c,
  concreteLite: 0x7a8276,
  concreteDark: 0x3e443c,
  asphalt: 0x3a403c,
  asphaltLite: 0x4a524c,
  asphaltDark: 0x2a302c,
  sidewalk: 0x6a7068,
  sidewalkLite: 0x7e867c,
  curb: 0x8a9086,
  rust: 0x8a4a28,
  rustLite: 0xa85a32,
  metal: 0x4a524c,
  metalLite: 0x6a746c,
  olive: 0x3a4a32,
  oliveLite: 0x526844,
  oliveDark: 0x2a3424,
  sand: 0xb8a46a,
  sandLite: 0xd0bc82,
  sandDark: 0x8a7848,
  wood: 0x8a5a2c,
  woodLite: 0xc48a40,
  woodDark: 0x6b431f,
  crate: 0xc48a40,
  crateLite: 0xe0b060,
  crateDark: 0x6b431f,
  brick: 0x6e5a4a,
  brickLite: 0x8a6e58,
  brickDark: 0x4a3a30,
  burn: 0x2a1c14,
  burnLite: 0x3a2818,
  fire: 0xe07028,
  fireCore: 0xf4c45a,
  glass: 0x2a3a40,
  canopy: 0x245018,
  canopyLite: 0x3a7a28,
  canopyTip: 0x6aaa40,
  trunk: 0x7a4a22,
  trunkDark: 0x1a1208,
  dirt: 0x5a4e38,
  dirtDark: 0x4a4030,
  grass: 0x3a6234,
} as const;

export const rgb = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export const fillPx = (
  ctx: CanvasRenderingContext2D,
  color: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void => {
  ctx.fillStyle = rgb(color);
  ctx.fillRect(x, y, w, h);
};

export const strokePx = (
  ctx: CanvasRenderingContext2D,
  color: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void => {
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
};
