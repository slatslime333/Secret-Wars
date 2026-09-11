import Phaser from 'phaser';
import { audioSettings } from './audio/AudioSettings';
import './style.css';
import { initOrientationHandling } from './orientation';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TitleScene } from './scenes/TitleScene';
import { GAME_HEIGHT, GAME_WIDTH } from './ui/theme';

// The game is built for a fixed 16:9 landscape canvas (960x540).
// Phaser FIT scaling letterboxes it on other aspect ratios, and a mobile
// overlay prompts touch-first users to rotate to landscape.
initOrientationHandling();
audioSettings.load();

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
    activePointers: 4,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, MainMenuScene, SettingsScene, BattleScene],
});
