import Phaser from 'phaser';
import { COLORS, FONTS, hex } from '../ui/theme';

type HitJuiceOptions = {
  damage: number;
  finisher?: boolean;
  heavy?: boolean;
  blocked?: boolean;
  clash?: boolean;
  perfect?: boolean;
  shake?: boolean;
};

/** Paper shards and damage pop. Camera punch is reserved for ultimates. */
export const playHitJuice = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: HitJuiceOptions,
): void => {
  const blocked = Boolean(options.blocked);
  const finisher = Boolean(options.finisher);
  const heavy = Boolean(options.heavy);
  const clash = Boolean(options.clash);
  const perfect = Boolean(options.perfect);
  const color = clash
    ? COLORS.yellow
    : blocked
      ? COLORS.cyan
      : finisher
        ? COLORS.yellow
        : COLORS.paper;
  spawnShards(scene, x, y, color, finisher || clash, heavy);
  const label = clash
    ? 'CLASH'
    : perfect
      ? 'PERFECT'
      : blocked
        ? 'BLOCKED'
        : String(options.damage);
  spawnDamagePop(scene, x, y - 18, label, color);
};

/** Short camera punch for ultimates only. */
export const playUltimateShake = (scene: Phaser.Scene): void => {
  scene.cameras.main.shake(220, 0.012);
};

/** Camera punch by impact tier. Light hits stay still. */
export const playImpactShake = (
  scene: Phaser.Scene,
  kind: 'strong' | 'finisher' | 'clash' | 'perfect' | 'ability',
): void => {
  const duration = kind === 'finisher' ? 90 : kind === 'strong' ? 42 : kind === 'ability' ? 80 : kind === 'perfect' ? 60 : 72;
  const intensity =
    kind === 'finisher' ? 0.0054 : kind === 'strong' ? 0.0016 : kind === 'ability' ? 0.0046 : kind === 'perfect' ? 0.005 : 0.0062;
  scene.cameras.main.shake(duration, intensity);
};

const spawnShards = (scene: Phaser.Scene, x: number, y: number, color: number, big: boolean, heavy = false): void => {
  const count = big ? 9 : heavy ? 6 : 4;
  const span = big ? 78 : heavy ? 52 : 28;
  for (let i = 0; i < count; i += 1) {
    const shard = scene.add.rectangle(x, y, big ? 11 : heavy ? 8 : 6, big ? 5 : 3, color).setDepth(15);
    shard.setRotation(Math.random() * Math.PI);
    scene.tweens.add({
      targets: shard,
      x: x + (Math.random() - 0.5) * span,
      y: y + (Math.random() - 0.5) * span,
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
