import Phaser from 'phaser';

export const spawnShadowHitBurst = (
  scene: Phaser.Scene,
  x: number,
  y: number,
): void => {
  const cloud = scene.add.circle(x, y, 16, 0x120814, 0.72).setDepth(21);
  scene.tweens.add({
    targets: cloud,
    scale: 2.6,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.Out',
    onComplete: () => cloud.destroy(),
  });
  const count = 12;
  for (let i = 0; i < count; i += 1) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const dist = 22 + Math.random() * 26;
    const puff = scene.add.circle(x, y, 6 + (i % 3) * 3, i % 2 === 0 ? 0x1a0c24 : 0x4a2870, 0.95);
    puff.setDepth(21);
    scene.tweens.add({
      targets: puff,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist - 10,
      alpha: 0,
      scale: 1.7,
      duration: 240 + i * 10,
      ease: 'Cubic.Out',
      onComplete: () => puff.destroy(),
    });
  }
  for (let i = 0; i < 10; i += 1) {
    const speck = scene.add.rectangle(x, y, 4, 4, i % 2 === 0 ? 0x0a0610 : 0x6a48a0).setDepth(22);
    const ang = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 24;
    scene.tweens.add({
      targets: speck,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      alpha: 0,
      duration: 180 + i * 16,
      ease: 'Quad.Out',
      onComplete: () => speck.destroy(),
    });
  }
};

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
  const half = giant ? 1.05 : 0.78;
  const anim = { t: 0, alpha: 1 };
  g.setPosition(x, y);
  scene.tweens.add({
    targets: anim,
    t: 1,
    alpha: 0,
    duration: giant ? 520 : 260,
    ease: 'Cubic.Out',
    onUpdate: () => {
      g.clear();
      const a0 = angle - half;
      const a1 = a0 + half * 2 * Math.min(1, anim.t * 1.15);
      const persist = giant ? Math.min(1, anim.alpha * 1.35) : anim.alpha;
      g.lineStyle(giant ? 22 : 12, 0x120814, 0.5 * persist);
      g.beginPath();
      g.arc(0, 0, radius, a0, a1);
      g.strokePath();
      g.lineStyle(giant ? 13 : 7, 0x4a2870, 0.88 * persist);
      g.beginPath();
      g.arc(0, 0, radius, a0, a1);
      g.strokePath();
      g.lineStyle(giant ? 5 : 2.6, 0xe8d8ff, 0.95 * persist);
      g.beginPath();
      g.arc(0, 0, radius - (giant ? 12 : 6), a0, a1);
      g.strokePath();
      const claw = a1;
      const marks = giant ? 5 : 3;
      const spread = giant ? 0.2 : 0.18;
      for (let i = 0; i < marks; i += 1) {
        const a = claw + (i - (marks - 1) / 2) * spread;
        const inner = radius * (giant ? 0.28 : 0.45);
        const outer = radius * (giant ? 1.18 : 1.04);
        g.lineStyle(giant ? 7 : 2.8, 0x1a0c22, 0.62 * persist);
        g.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
        g.lineStyle(giant ? 3.4 : 1.6, 0xd8c4ff, 0.95 * persist);
        g.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
      }
    },
    onComplete: () => g.destroy(),
  });
};

export const drawClawMark = (g: Phaser.GameObjects.Graphics, x: number, y: number, now: number): void => {
  g.clear();
  g.setPosition(x, y);
  const pulse = 0.62 + Math.sin(now / 120) * 0.14;
  const draw = (width: number, color: number, alpha: number): void => {
    g.lineStyle(width, color, alpha * pulse);
    g.beginPath();
    g.moveTo(-10, -12);
    g.lineTo(-4, 10);
    g.moveTo(-2, -14);
    g.lineTo(1, 12);
    g.moveTo(6, -13);
    g.lineTo(8, 10);
    g.moveTo(12, -10);
    g.lineTo(13, 8);
    g.strokePath();
  };
  draw(4.2, 0x140818, 0.5);
  draw(2.2, 0x8a62c8, 0.92);
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
  const t = now / 70;
  const i = Phaser.Math.Clamp(intensity, 0.2, 1);
  g.fillStyle(0x1a0824, 0.22 * i);
  g.fillCircle(0, 2, 28 + Math.sin(t) * 3);
  for (let n = 0; n < 10; n += 1) {
    const a = t * (0.9 + n * 0.13) + n * 0.72;
    const r = 14 + (n % 4) * 5 + Math.sin(t * 1.7 + n) * 4;
    const px = Math.cos(a) * r;
    const py = Math.sin(a * 1.35) * r * 0.78 - 2;
    g.fillStyle(n % 2 === 0 ? 0x2a1038 : 0x5a3090, (0.42 + n * 0.03) * i);
    g.fillEllipse(px, py, 9 * i, 14 * i);
    g.fillStyle(0xb898e8, 0.32 * i);
    g.fillEllipse(px, py - 4, 4 * i, 7 * i);
  }
};
