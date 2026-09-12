import Phaser from 'phaser';

/** Brief pixel-art muzzle burst at the barrel tip. */
export const spawnMuzzleFlash = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): void => {
  const graphics = scene.add.graphics().setDepth(22);
  const length = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / length;
  const ny = dirY / length;
  const anim = { t: 0 };
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 58,
    ease: 'Quad.Out',
    onUpdate: () => {
      graphics.clear();
      const fade = 1 - anim.t;
      const reach = 9 * fade;
      graphics.fillStyle(0xfff6c8, fade);
      graphics.fillCircle(x + nx * 2, y + ny * 2, 3.1 * fade);
      graphics.fillStyle(0xffc028, fade * 0.95);
      graphics.fillTriangle(
        x,
        y,
        x + nx * reach + ny * 3.2,
        y + ny * reach - nx * 3.2,
        x + nx * reach - ny * 3.2,
        y + ny * reach + nx * 3.2,
      );
      graphics.fillStyle(0xff7a18, fade * 0.85);
      graphics.fillCircle(x + nx * 6.5 * fade, y + ny * 6.5 * fade, 1.5);
    },
    onComplete: () => graphics.destroy(),
  });
};
