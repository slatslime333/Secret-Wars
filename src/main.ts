import Phaser from 'phaser';
import { audioSettings } from './audio/AudioSettings';
import './style.css';
import { initOrientationHandling } from './orientation';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TitleScene } from './scenes/TitleScene';
import { getGameSize } from './ui/theme';

initOrientationHandling();
audioSettings.load();

const initialSize = getGameSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#070a12',
  width: initialSize.width,
  height: initialSize.height,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 5,
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

const onWindowResize = () => {
  const newSize = getGameSize();
  if (game.scale.width !== newSize.width || game.scale.height !== newSize.height) {
    game.scale.resize(newSize.width, newSize.height);
  }
};

window.addEventListener('resize', onWindowResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onWindowResize);
}
window.addEventListener('orientationchange', () => {
  setTimeout(onWindowResize, 100);
  setTimeout(onWindowResize, 300);
});
