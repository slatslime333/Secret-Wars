import Phaser from 'phaser';
import { adoptHud } from './layout/hudCamera';
import { COLORS, FONTS, hex } from './theme';

/** Brief centered KILL / ASSIST flash for the local player. */
export const spawnKillPopup = (
  scene: Phaser.Scene,
  kind: 'KILL' | 'ASSIST',
  victimName: string,
): void => {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const color = kind === 'KILL' ? COLORS.orange : COLORS.cyan;
  const label = scene.add
    .text(width / 2, height * 0.28, `${kind}  ${victimName.toUpperCase()}`, {
      fontFamily: FONTS.display,
      fontSize: kind === 'KILL' ? '36px' : '28px',
      color: hex(color),
      letterSpacing: 4,
      stroke: hex(COLORS.ink),
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(200)
    .setScale(1.18)
    .setAlpha(1);
  adoptHud(scene, label);

  scene.tweens.add({
    targets: label,
    scale: 1,
    duration: 140,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: label,
        alpha: 0,
        y: label.y - 18,
        duration: 720,
        delay: 180,
        ease: 'Quad.easeIn',
        onComplete: () => label.destroy(),
      });
    },
  });
};
