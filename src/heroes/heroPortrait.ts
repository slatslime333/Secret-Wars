import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { PLAYABLE_HEROES, type HeroId } from './roster';
import type { CardinalFacing } from './drawNinja';
import { WITCH_SHEET, applyWitchSprite, witchFrameIndex } from './witchSprite';

export type HeroPortraitOptions = {
  facing?: CardinalFacing;
  team?: TeamId;
  rival?: boolean;
  scale?: number;
};

/** Graphics for procedural heroes; the packed witch sheet when it is loaded. */
export const presentHero = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  heroId: HeroId,
  options: HeroPortraitOptions = {},
): Phaser.GameObjects.GameObject => {
  const facing = options.facing ?? 'south';
  const scale = options.scale ?? 1;
  const rival = Boolean(options.rival) || options.team === 'bravo';
  if (heroId === 'witch' && scene.textures.exists(WITCH_SHEET)) {
    const sprite = scene.add.sprite(x, y + 18, WITCH_SHEET, witchFrameIndex({ facing }));
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale * 0.72);
    applyWitchSprite(sprite, { facing, rival });
    return sprite;
  }
  const art = scene.add.graphics();
  art.setPosition(x, y);
  art.setScale(scale);
  PLAYABLE_HEROES[heroId].draw(art, { facing, team: options.team, rival });
  return art;
};
