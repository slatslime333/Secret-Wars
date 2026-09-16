import Phaser from 'phaser';
import { ensureAbilityIcons } from '../heroes/abilities/icons';
import { filterWitchSheet, preloadWitchSheet } from '../heroes/witchSprite';
import { filterColeSheet, preloadColeSheet } from '../heroes/coleSprite';
import { filterNinjaSheet, preloadNinjaSheet } from '../heroes/ninjaSprite';
import { filterRopeSheet, preloadRopeSheet } from '../heroes/ropeSprite';
import { filterDeathSheet, preloadDeathSheet } from '../heroes/deathSprite';
import { filterMenderSheet, preloadMenderSheet } from '../heroes/menderSprite';
import { filterShadowSheet, preloadShadowSheet } from '../heroes/shadowSprite';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    preloadWitchSheet(this);
    preloadColeSheet(this);
    preloadNinjaSheet(this);
    preloadRopeSheet(this);
    preloadDeathSheet(this);
    preloadMenderSheet(this);
    preloadShadowSheet(this);
  }

  create(): void {
    filterWitchSheet(this);
    filterColeSheet(this);
    filterNinjaSheet(this);
    filterRopeSheet(this);
    filterDeathSheet(this);
    filterMenderSheet(this);
    filterShadowSheet(this);
    ensureAbilityIcons(this);
    this.scene.start('Title');
  }
}
