import Phaser from 'phaser';
import { COLORS, FONTS, hex } from '../ui/theme';

/** Fighting-game pop above the actor so combo / block / dash are readable. */
export const spawnCombatCallout = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
): void => {
  const label = scene.add
    .text(x, y - 40, text, {
      fontFamily: FONTS.display,
      fontSize: text.length > 6 ? '26px' : '22px',
      color: hex(color),
      stroke: hex(COLORS.ink),
      strokeThickness: 6,
      letterSpacing: 2,
    })
    .setOrigin(0.5)
    .setDepth(40);

  scene.tweens.add({
    targets: label,
    y: y - 72,
    alpha: 0,
    duration: 700,
    ease: 'Stepped',
    easeParams: [5],
    onComplete: () => label.destroy(),
  });
};
