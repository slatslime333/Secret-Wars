import Phaser from 'phaser';
import { ensureAbilityIcons } from '../heroes/abilities/icons';
import { preloadHeroPixels, prepareHeroPixelTextures } from '../heroes/pixel';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    preloadHeroPixels(this);
  }

  create(): void {
    prepareHeroPixelTextures(this);
    ensureAbilityIcons(this);
    this.scene.start('Title');
  }
}
