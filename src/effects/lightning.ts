import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

const BOLT = 0x7ecbff;
const CORE = 0xdff4ff;

const jagged = (
  graphics: Phaser.GameObjects.Graphics,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segs: number,
  jitter: number,
): void => {
  const dx = bx - ax;
  const dy = by - ay;
  graphics.beginPath();
  graphics.moveTo(ax, ay);
  for (let i = 1; i < segs; i += 1) {
    const t = i / segs;
    const px = -dy;
    const py = dx;
    const len = Math.hypot(px, py) || 1;
    const off = (Math.random() - 0.5) * jitter;
    graphics.lineTo(ax + dx * t + (px / len) * off, ay + dy * t + (py / len) * off);
  }
  graphics.lineTo(bx, by);
  graphics.strokePath();
};

export const spawnLightningBolt = (
  scene: Phaser.Scene,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  options: { life?: number; heavy?: boolean } = {},
): void => {
  const life = options.life ?? 140;
  const heavy = Boolean(options.heavy);
  const bolt = scene.add.graphics().setDepth(17);
  bolt.lineStyle(heavy ? 5 : 3, CORE, 0.95);
  jagged(bolt, ax, ay, bx, by, heavy ? 7 : 5, heavy ? 16 : 10);
  bolt.lineStyle(heavy ? 2.4 : 1.6, BOLT, 0.9);
  jagged(bolt, ax, ay, bx, by, heavy ? 6 : 4, heavy ? 12 : 8);
  scene.tweens.add({
    targets: bolt,
    alpha: 0,
    duration: life,
    ease: 'Quad.In',
    onComplete: () => bolt.destroy(),
  });
};

export const spawnLightningArc = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  aimX: number,
  aimY: number,
  range: number,
  halfArc: number,
): void => {
  const angle = Math.atan2(aimY, aimX);
  const fx = scene.add.graphics().setDepth(16);
  fx.setPosition(x, y);
  const anim = { t: 0 };
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 180,
    ease: 'Cubic.Out',
    onUpdate: () => {
      fx.clear();
      const reach = range * (0.55 + anim.t * 0.45);
      fx.lineStyle(7, CORE, 0.55 * (1 - anim.t * 0.4));
      fx.beginPath();
      fx.arc(0, 0, reach, angle - halfArc, angle + halfArc);
      fx.strokePath();
      fx.lineStyle(3, BOLT, 0.95 * (1 - anim.t * 0.2));
      fx.beginPath();
      fx.arc(0, 0, reach, angle - halfArc, angle + halfArc);
      fx.strokePath();
    },
    onComplete: () => fx.destroy(),
  });

  const tips = 5;
  for (let i = 0; i < tips; i += 1) {
    const a = angle - halfArc + (halfArc * 2 * i) / (tips - 1);
    spawnLightningBolt(scene, x + Math.cos(a) * 18, y + Math.sin(a) * 18, x + Math.cos(a) * range, y + Math.sin(a) * range, {
      life: 120,
      heavy: i === 2,
    });
  }
};

export const spawnShockwaveRing = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
): void => {
  const ring = scene.add.graphics().setDepth(16);
  ring.setPosition(x, y);
  const anim = { t: 0 };
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 220,
    ease: 'Cubic.Out',
    onUpdate: () => {
      ring.clear();
      const r = 12 + anim.t * radius;
      ring.lineStyle(8 - anim.t * 5, CORE, 0.85 * (1 - anim.t));
      ring.strokeCircle(0, 0, r);
      ring.lineStyle(3, BOLT, 0.8 * (1 - anim.t));
      ring.strokeCircle(0, 0, r * 0.72);
    },
    onComplete: () => ring.destroy(),
  });
};

export const spawnStormWarning = (scene: Phaser.Scene, x: number, y: number, radius: number, life: number): void => {
  const ring = scene.add.graphics().setDepth(14);
  ring.setPosition(x, y);
  ring.lineStyle(2, COLORS.yellow, 0.8);
  ring.strokeCircle(0, 0, radius);
  ring.fillStyle(0x4aa8ff, 0.12);
  ring.fillCircle(0, 0, radius);
  scene.tweens.add({
    targets: ring,
    alpha: 0.25,
    duration: life,
    yoyo: true,
    repeat: 1,
    onComplete: () => ring.destroy(),
  });
};
