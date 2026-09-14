import Phaser from 'phaser';
import type { TeamId } from '../../config/hero';
import type { HeroDrawOptions } from '../heroDraw';
import { heroSheetReady } from './loadHeroPixels';
import { poseForDraw } from './pose';
import { HERO_PIXEL_ORIGIN, HERO_PIXEL_SCALE, heroFrameIndex, heroSheetKey, isPixelHeroId } from './spec';

export class HeroPixelView {
  readonly sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, heroId: string, team: TeamId) {
    const id = isPixelHeroId(heroId) ? heroId : 'ninja';
    this.sprite = scene.add.sprite(0, 0, heroSheetKey(id, team), 0);
    this.sprite.setOrigin(HERO_PIXEL_ORIGIN.x, HERO_PIXEL_ORIGIN.y);
    this.sprite.setScale(HERO_PIXEL_SCALE);
    parent.add(this.sprite);
  }

  show(options: HeroDrawOptions, moving: boolean, now: number, down: boolean): void {
    const pose = poseForDraw(options, { moving, now, down });
    this.sprite.setFrame(heroFrameIndex(options.facing, pose));
    if (options.hitFlash && !down) {
      this.sprite.setTintFill(0xffffff);
    } else {
      this.sprite.clearTint();
    }
  }
}

export const tryAttachHeroPixelView = (
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  heroId: string,
  team: TeamId,
): HeroPixelView | undefined => {
  if (!heroSheetReady(scene, heroId, team)) {
    return undefined;
  }
  return new HeroPixelView(scene, parent, heroId, team);
};
