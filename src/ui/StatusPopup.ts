import Phaser from 'phaser';
import { adoptHud } from './layout/hudCamera';
import { COLORS, FONTS, hex } from './theme';

/** Screen-space flash when the local player is stunned or paralyzed. */
export const spawnStatusPopup = (scene: Phaser.Scene, kind: 'STUNNED' | 'PARALYZED'): void => {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const color = kind === 'PARALYZED' ? COLORS.cyan : COLORS.yellow;
  const label = scene.add
    .text(width / 2, height * 0.34, kind, {
      fontFamily: FONTS.display,
      fontSize: '34px',
      color: hex(color),
      letterSpacing: 5,
      stroke: hex(COLORS.ink),
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(200)
    .setScale(1.16)
    .setAlpha(1);
  adoptHud(scene, label);

  scene.tweens.add({
    targets: label,
    scale: 1,
    duration: 120,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: label,
        alpha: 0,
        y: label.y - 16,
        duration: 640,
        delay: 220,
        ease: 'Quad.easeIn',
        onComplete: () => label.destroy(),
      });
    },
  });
};
