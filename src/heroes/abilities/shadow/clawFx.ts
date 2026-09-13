import Phaser from 'phaser';

export const spawnShadowSlash = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  radius: number,
  giant = false,
): void => {
  const g = scene.add.graphics().setDepth(20);
  const angle = Math.atan2(dirY, dirX);
  const half = giant ? 0.95 : 0.72;
  const anim = { t: 0, alpha: 1 };
  g.setPosition(x, y);
  scene.tweens.add({
    targets: anim,
    t: 1,
    alpha: 0,
    duration: giant ? 280 : 180,
    ease: 'Cubic.Out',
    onUpdate: () => {
      g.clear();
      const a0 = angle - half;
      const a1 = a0 + half * 2 * anim.t;
      g.lineStyle(giant ? 16 : 10, 0x1a1028, 0.28 * anim.alpha);
      g.beginPath();
      g.arc(0, 0, radius, a0, a1);
      g.strokePath();
      g.lineStyle(giant ? 8 : 5, 0x3a2458, 0.7 * anim.alpha);
      g.beginPath();
      g.arc(0, 0, radius, a0, a1);
      g.strokePath();
      g.lineStyle(giant ? 3 : 2, 0x8a70b8, 0.85 * anim.alpha);
      g.beginPath();
      g.arc(0, 0, radius - (giant ? 10 : 6), a0, a1);
      g.strokePath();
      const claw = a1;
      for (let i = -1; i <= 1; i += 1) {
        const a = claw + i * 0.18;
        const inner = radius * 0.45;
        const outer = radius * (giant ? 1.08 : 1.02);
        g.lineStyle(giant ? 4 : 2.4, 0x22102a, 0.5 * anim.alpha);
        g.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
        g.lineStyle(giant ? 2 : 1.4, 0xb8a0e0, 0.8 * anim.alpha);
        g.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
      }
    },
    onComplete: () => g.destroy(),
  });
};

export const drawClawMark = (g: Phaser.GameObjects.Graphics, x: number, y: number, now: number): void => {
  g.clear();
  g.setPosition(x, y);
  const pulse = 0.55 + Math.sin(now / 120) * 0.12;
  g.lineStyle(3, 0x140818, 0.45 * pulse);
  g.beginPath();
  g.moveTo(-6, -8);
  g.lineTo(-2, 6);
  g.moveTo(0, -9);
  g.lineTo(1, 7);
  g.moveTo(6, -8);
  g.lineTo(4, 6);
  g.strokePath();
  g.lineStyle(1.6, 0x6a48a0, 0.85 * pulse);
  g.beginPath();
  g.moveTo(-6, -8);
  g.lineTo(-2, 6);
  g.moveTo(0, -9);
  g.lineTo(1, 7);
  g.moveTo(6, -8);
  g.lineTo(4, 6);
  g.strokePath();
};

export const drawRageFire = (
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  now: number,
  intensity: number,
): void => {
  g.clear();
  g.setPosition(x, y);
  const t = now / 90;
  const i = Phaser.Math.Clamp(intensity, 0.2, 1);
  g.fillStyle(0x120814, 0.16 * i);
  g.fillCircle(0, 2, 22 + Math.sin(t) * 2);
  for (let n = 0; n < 6; n += 1) {
    const a = t * (0.7 + n * 0.11) + n * 1.1;
    const r = 10 + (n % 3) * 5 + Math.sin(t * 1.4 + n) * 3;
    const px = Math.cos(a) * r;
    const py = Math.sin(a * 1.3) * r * 0.7 - 4;
    g.fillStyle(n % 2 === 0 ? 0x2a1438 : 0x4a2870, (0.28 + n * 0.04) * i);
    g.fillEllipse(px, py, 7 * i, 11 * i);
    g.fillStyle(0x8a68c0, 0.18 * i);
    g.fillEllipse(px, py - 3, 3.2 * i, 5 * i);
  }
};
