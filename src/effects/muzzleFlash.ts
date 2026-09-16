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

/** Small barrel explosion at the muzzle each time Mender fires a Pulse round. */
export const spawnBarrelExplosion = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): void => {
  const length = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / length;
  const ny = dirY / length;
  const bx = x + nx * 5;
  const by = y + ny * 5;
  const flash = scene.add.graphics().setDepth(24);
  const anim = { t: 0 };
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 92,
    ease: 'Cubic.Out',
    onUpdate: () => {
      flash.clear();
      const fade = 1 - anim.t;
      const grow = 0.45 + anim.t * 0.9;
      flash.fillStyle(0xff7a18, fade * 0.55);
      flash.fillCircle(bx, by, 11 * grow);
      flash.fillStyle(0xffc028, fade * 0.9);
      flash.fillCircle(bx, by, 7.2 * grow);
      flash.fillStyle(0xfff6c8, fade);
      flash.fillCircle(bx + nx * 2, by + ny * 2, 3.6 * fade);
      flash.fillStyle(0x7ae0ff, fade * 0.7);
      flash.fillCircle(bx + nx * 4, by + ny * 4, 2.1 * fade);
    },
    onComplete: () => flash.destroy(),
  });
  for (let i = 0; i < 7; i += 1) {
    const spread = (i - 3) * 0.22;
    const ang = Math.atan2(ny, nx) + spread;
    const dist = 10 + (i % 3) * 4;
    const speck = scene.add.rectangle(bx, by, 3, 3, i % 2 === 0 ? 0xfff4c8 : 0xff8a20).setDepth(25);
    scene.tweens.add({
      targets: speck,
      x: bx + Math.cos(ang) * dist,
      y: by + Math.sin(ang) * dist,
      alpha: 0,
      duration: 70 + i * 8,
      ease: 'Quad.Out',
      onComplete: () => speck.destroy(),
    });
  }
};
