import Phaser from 'phaser';

/** Purple magical swirl used for Hex buffs and ultimate debuffs. */
export const drawMagicVortex = (
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  now: number,
  tint = 0x9b4dff,
  radius = 22,
): void => {
  graphics.clear();
  graphics.setPosition(x, y);
  const spin = now / 140;
  graphics.lineStyle(3, tint, 0.22);
  graphics.strokeCircle(0, 0, radius + 4);
  for (let i = 0; i < 3; i += 1) {
    const a0 = spin + i * 2.1;
    const a1 = a0 + 1.4;
    graphics.lineStyle(i === 0 ? 3 : 2, tint, 0.55 - i * 0.1);
    graphics.beginPath();
    graphics.arc(0, 0, radius - i * 4, a0, a1);
    graphics.strokePath();
  }
  graphics.fillStyle(tint, 0.12);
  graphics.fillCircle(0, 0, radius * 0.45);
};

export const drawTombstone = (graphics: Phaser.GameObjects.Graphics, rise: number): void => {
  graphics.clear();
  const h = 16 * rise;
  graphics.fillStyle(0x070a12, 0.4 * rise);
  graphics.fillEllipse(0, 8, 14, 5);
  graphics.fillStyle(0x2a2a32, 1);
  graphics.fillRoundedRect(-7, 8 - h, 14, h, 3);
  graphics.fillStyle(0x3a3a44, 1);
  graphics.fillRoundedRect(-6, 8 - h + 2, 12, Math.max(2, h - 4), 3);
  graphics.fillStyle(0x9b4dff, 0.7 * rise);
  graphics.fillCircle(0, 8 - h + 6, 2);
};
