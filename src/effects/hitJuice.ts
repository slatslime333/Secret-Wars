import Phaser from 'phaser';
import { COLORS, FONTS, hex } from '../ui/theme';

type HitJuiceOptions = {
  damage: number;
  finisher?: boolean;
  blocked?: boolean;
};

/** Paper shards, damage pop, and a stepped camera punch. */
export const playHitJuice = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: HitJuiceOptions,
): void => {
  const blocked = Boolean(options.blocked);
  const finisher = Boolean(options.finisher);
  spawnShards(scene, x, y, blocked ? COLORS.cyan : finisher ? COLORS.yellow : COLORS.paper);
  spawnDamagePop(scene, x, y - 18, blocked ? 'BLOCKED' : String(options.damage), blocked ? COLORS.cyan : finisher ? COLORS.yellow : COLORS.paper);
  scene.cameras.main.shake(finisher ? 160 : blocked ? 70 : 100, finisher ? 0.014 : 0.008);
};

const spawnShards = (scene: Phaser.Scene, x: number, y: number, color: number): void => {
  for (let i = 0; i < 5; i += 1) {
    const shard = scene.add.rectangle(x, y, 8, 4, color).setDepth(15);
    shard.setRotation(Math.random() * Math.PI);
    scene.tweens.add({
      targets: shard,
      x: x + (Math.random() - 0.5) * 46,
      y: y + (Math.random() - 0.5) * 46,
      alpha: 0,
      duration: 160 + i * 30,
      ease: 'Stepped',
      easeParams: [4],
      onComplete: () => shard.destroy(),
    });
  }
};

const spawnDamagePop = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
): void => {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: FONTS.display,
      fontSize: text === 'BLOCKED' ? '16px' : '20px',
      color: hex(color),
      stroke: hex(COLORS.ink),
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(41);

  scene.tweens.add({
    targets: label,
    y: y - 34,
    alpha: 0,
    duration: 520,
    ease: 'Stepped',
    easeParams: [5],
    onComplete: () => label.destroy(),
  });
};
