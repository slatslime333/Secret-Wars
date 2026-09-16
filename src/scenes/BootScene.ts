import Phaser from 'phaser';
import { ensureAbilityIcons } from '../heroes/abilities/icons';
import { filterWitchSheet, preloadWitchSheet } from '../heroes/witchSprite';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    preloadWitchSheet(this);
  }

  create(): void {
    filterWitchSheet(this);
    ensureAbilityIcons(this);
    this.scene.start('Title');
  }
}
