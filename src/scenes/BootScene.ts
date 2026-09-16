import Phaser from 'phaser';
import { ensureAbilityIcons } from '../heroes/abilities/icons';
import { filterWitchSheet, preloadWitchSheet } from '../heroes/witchSprite';
import { filterColeSheet, preloadColeSheet } from '../heroes/coleSprite';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    preloadWitchSheet(this);
    preloadColeSheet(this);
  }

  create(): void {
    filterWitchSheet(this);
    filterColeSheet(this);
    ensureAbilityIcons(this);
    this.scene.start('Title');
  }
}
