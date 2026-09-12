import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

/**
 * Dedicated kick-connect gust. Not the square hit marker — directional air
 * streaks and a short expanding shock so the impact reads as a physical blow.
 */
export const spawnWindImpact = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): void => {
  const length = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / length;
  const ny = dirY / length;
  const angle = Math.atan2(ny, nx);
  const px = -ny;
  const py = nx;

  const ring = scene.add.graphics().setDepth(16);
  ring.setPosition(x, y);
  const ringAnim = { t: 0 };
  scene.tweens.add({
    targets: ringAnim,
    t: 1,
      duration: 180,
    ease: 'Cubic.Out',
    onUpdate: () => {
      ring.clear();
      const radius = 10 + ringAnim.t * 34;
      ring.lineStyle(5 - ringAnim.t * 3, COLORS.paper, 0.9 * (1 - ringAnim.t));
      ring.beginPath();
      ring.arc(0, 0, radius, angle - 0.95, angle + 0.95);
      ring.strokePath();
      ring.lineStyle(2, COLORS.cyan, 0.7 * (1 - ringAnim.t));
      ring.beginPath();
      ring.arc(0, 0, radius * 0.72, angle - 0.7, angle + 0.7);
      ring.strokePath();
    },
    onComplete: () => ring.destroy(),
  });

  for (let i = 0; i < 7; i += 1) {
    const spread = (i - 3) * 0.16;
    const sx = x + px * spread * 18 - nx * 4;
    const sy = y + py * spread * 18 - ny * 4;
    const streak = scene.add.rectangle(sx, sy, 26 + Math.abs(i - 3) * 4, 3.5, COLORS.paper, 0.95);
    streak.setRotation(angle + spread * 0.35).setDepth(16);
    scene.tweens.add({
      targets: streak,
      x: sx + nx * (28 + Math.abs(i - 3) * 6),
      y: sy + ny * (28 + Math.abs(i - 3) * 6),
      scaleX: 1.6,
      alpha: 0,
      duration: 120 + Math.abs(i - 3) * 14,
      ease: 'Cubic.Out',
      onComplete: () => streak.destroy(),
    });
  }

  for (let i = 0; i < 4; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const line = scene.add.rectangle(
      x + px * side * (8 + i * 3),
      y + py * side * (8 + i * 3),
      16,
      2,
      COLORS.cyan,
      0.85,
    );
    line.setRotation(angle + side * 0.55).setDepth(16);
    scene.tweens.add({
      targets: line,
      x: x + nx * 20 + px * side * (16 + i * 5),
      y: y + ny * 20 + py * side * (16 + i * 5),
      alpha: 0,
      duration: 110,
      ease: 'Quad.Out',
      onComplete: () => line.destroy(),
    });
  }
};
