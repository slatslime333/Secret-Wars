import Phaser from 'phaser';

/** Shared rope strand stroke used by dash, grab, wrap, and spray. */
export const strokeRope = (
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width = 3.2,
  alpha = 1,
): void => {
  g.lineStyle(width + 1.6, 0x5a3014, alpha);
  g.lineBetween(x0, y0, x1, y1);
  g.lineStyle(width, 0xc4894a, alpha);
  g.lineBetween(x0, y0, x1, y1);
  g.fillStyle(0x8a5228, alpha);
  g.fillCircle(x1, y1, Math.max(2, width * 0.7));
};

export const drawRopeWrap = (g: Phaser.GameObjects.Graphics, x: number, y: number, now: number): void => {
  g.clear();
  g.setPosition(x, y);
  const wobble = Math.sin(now / 90) * 0.8;
  g.lineStyle(4.5, 0x5a3014, 0.95);
  g.strokeEllipse(0, 2, 22 + wobble, 16);
  g.lineStyle(2.8, 0xc4894a, 1);
  g.strokeEllipse(0, 2, 22 + wobble, 16);
  g.lineStyle(3.6, 0x6a3a14, 0.9);
  g.strokeEllipse(1, -4, 16, 12);
  g.lineStyle(2.2, 0xb56b32, 1);
  g.strokeEllipse(1, -4, 16, 12);
  g.lineStyle(3.2, 0x5a3014, 0.85);
  g.beginPath();
  g.arc(-6, 6, 10, 0.4, 3.1);
  g.strokePath();
  g.lineStyle(2, 0xc4894a, 1);
  g.beginPath();
  g.arc(-6, 6, 10, 0.4, 3.1);
  g.strokePath();
};
