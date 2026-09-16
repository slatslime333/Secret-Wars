import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { PLAYABLE_HEROES, type HeroId } from './roster';
import type { CardinalFacing } from './drawNinja';
import { applyWitchSprite, witchFrameIndex, witchSheetKey, WITCH_SHEET } from './witchSprite';
import { applyColeSprite, coleFrameIndex, coleSheetKey, COLE_SHEET } from './coleSprite';
import { applyNinjaSprite, ninjaFrameIndex, ninjaSheetKey, NINJA_SHEET } from './ninjaSprite';
import { applyRopeSprite, ropeFrameIndex, ropeSheetKey, ROPE_SHEET } from './ropeSprite';

export type HeroPortraitOptions = {
  facing?: CardinalFacing;
  team?: TeamId;
  rival?: boolean;
  scale?: number;
};

/** Graphics for procedural heroes; packed sheets for Witch, Cole, Ninja, and Rope Man. */
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
  const coleKey = coleSheetKey(options.team, rival);
  const coleSheet = scene.textures.exists(coleKey) ? coleKey : COLE_SHEET;
  if (heroId === 'cole' && scene.textures.exists(coleSheet)) {
    const sprite = scene.add.sprite(x, y + 18, coleSheet, coleFrameIndex({ facing }));
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale * 0.72);
    applyColeSprite(sprite, { facing });
    return sprite;
  }
  const ninjaKey = ninjaSheetKey(options.team, rival);
  const ninjaSheet = scene.textures.exists(ninjaKey) ? ninjaKey : NINJA_SHEET;
  if (heroId === 'ninja' && scene.textures.exists(ninjaSheet)) {
    const sprite = scene.add.sprite(x, y + 18, ninjaSheet, ninjaFrameIndex({ facing }));
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale * 0.72);
    applyNinjaSprite(sprite, { facing });
    return sprite;
  }
  const ropeKey = ropeSheetKey(options.team, rival);
  const ropeSheet = scene.textures.exists(ropeKey) ? ropeKey : ROPE_SHEET;
  if (heroId === 'rope' && scene.textures.exists(ropeSheet)) {
    const sprite = scene.add.sprite(x, y + 18, ropeSheet, ropeFrameIndex({ facing }));
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale * 0.72);
    applyRopeSprite(sprite, { facing });
    return sprite;
  }
  const art = scene.add.graphics();
  art.setPosition(x, y);
  art.setScale(scale);
  PLAYABLE_HEROES[heroId].draw(art, { facing, team: options.team, rival });
  return art;
};
