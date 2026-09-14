import Phaser from 'phaser';
import type { TeamId } from '../../config/hero';
import type { HeroDrawOptions } from '../heroDraw';
import { heroSheetReady } from './loadHeroPixels';
import { poseForDraw } from './pose';
import { heroDrawOrigin, heroDrawScale, heroFrameIndex, heroSheetKey, isPixelHeroId } from './spec';

export class HeroPixelView {
  readonly sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, heroId: string, team: TeamId) {
    const id = isPixelHeroId(heroId) ? heroId : 'ninja';
    this.sprite = scene.add.sprite(0, 0, heroSheetKey(id, team), 0);
    const origin = heroDrawOrigin(id);
    this.sprite.setOrigin(origin.x, origin.y);
    this.sprite.setScale(heroDrawScale(id));
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
