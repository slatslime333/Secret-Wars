import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { PLAYABLE_HEROES, type HeroId } from './roster';
import type { CardinalFacing } from './drawNinja';
import { applyWitchSprite, witchFrameIndex, witchSheetKey, WITCH_SHEET } from './witchSprite';

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
  const witchKey = witchSheetKey(options.team, rival);
  const witchSheet = scene.textures.exists(witchKey) ? witchKey : WITCH_SHEET;
  if (heroId === 'witch' && scene.textures.exists(witchSheet)) {
    const sprite = scene.add.sprite(x, y + 18, witchSheet, witchFrameIndex({ facing }));
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale * 0.72);
    applyWitchSprite(sprite, { facing });
    return sprite;
  }
  const art = scene.add.graphics();
  art.setPosition(x, y);
  art.setScale(scale);
  PLAYABLE_HEROES[heroId].draw(art, { facing, team: options.team, rival });
  return art;
};
