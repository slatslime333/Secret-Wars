import Phaser from 'phaser';
import { ensureAbilityIcons } from '../heroes/abilities/icons';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    ensureAbilityIcons(this);
    this.scene.start('Title');
  }
}
