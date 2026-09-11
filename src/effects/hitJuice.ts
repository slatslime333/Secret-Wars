import Phaser from 'phaser';
import { COLORS, FONTS, hex } from '../ui/theme';

type HitJuiceOptions = {
  damage: number;
  finisher?: boolean;
  blocked?: boolean;
  clash?: boolean;
  perfect?: boolean;
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
  const clash = Boolean(options.clash);
  const perfect = Boolean(options.perfect);
  const color = clash
    ? COLORS.yellow
    : blocked
      ? COLORS.cyan
      : finisher
        ? COLORS.yellow
        : COLORS.paper;
  spawnShards(scene, x, y, color, finisher || clash);
  const label = clash
    ? 'CLASH'
    : perfect
      ? 'PERFECT'
      : blocked
        ? 'BLOCKED'
        : String(options.damage);
  spawnDamagePop(scene, x, y - 18, label, color);
  scene.cameras.main.shake(
    clash ? 140 : finisher ? 160 : blocked ? 80 : 100,
    clash ? 0.012 : finisher ? 0.014 : 0.008,
  );
};

const spawnShards = (scene: Phaser.Scene, x: number, y: number, color: number, big: boolean): void => {
  const count = big ? 7 : 5;
  for (let i = 0; i < count; i += 1) {
    const shard = scene.add.rectangle(x, y, big ? 10 : 8, 4, color).setDepth(15);
    shard.setRotation(Math.random() * Math.PI);
    scene.tweens.add({
      targets: shard,
      x: x + (Math.random() - 0.5) * (big ? 64 : 46),
      y: y + (Math.random() - 0.5) * (big ? 64 : 46),
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
      fontSize: text.length > 4 ? '16px' : '20px',
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
