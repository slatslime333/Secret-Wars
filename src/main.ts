import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { PlaceholderScene } from './scenes/PlaceholderScene';
import { TitleScene } from './scenes/TitleScene';
import { GAME_HEIGHT, GAME_WIDTH } from './ui/theme';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#070a12',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, TitleScene, HomeScene, PlaceholderScene],
});
