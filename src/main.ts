import Phaser from 'phaser';
import { audioSettings } from './audio/AudioSettings';
import './style.css';
import { getViewportSize } from './device';
import { initOrientationHandling } from './orientation';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TitleScene } from './scenes/TitleScene';
import { getGameSize } from './ui/theme';

initOrientationHandling();
audioSettings.load();

const gameRoot = document.getElementById('game');

const syncGameShell = (): void => {
  if (!gameRoot) {
    return;
  }
  const { width, height, offsetLeft, offsetTop } = getViewportSize();
  gameRoot.style.position = 'fixed';
  gameRoot.style.left = `${Math.round(offsetLeft)}px`;
  gameRoot.style.top = `${Math.round(offsetTop)}px`;
  gameRoot.style.width = `${Math.round(width)}px`;
  gameRoot.style.height = `${Math.round(height)}px`;
};

syncGameShell();
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
    expandParent: false,
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
  syncGameShell();
  const newSize = getGameSize();
  if (game.scale.width !== newSize.width || game.scale.height !== newSize.height) {
    game.scale.resize(newSize.width, newSize.height);
  }
  game.scale.refresh();
};

window.addEventListener('resize', onWindowResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onWindowResize);
}
window.addEventListener('orientationchange', () => {
  setTimeout(onWindowResize, 100);
  setTimeout(onWindowResize, 300);
});

window.addEventListener('resize', onWindowResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onWindowResize);
}
window.addEventListener('orientationchange', () => {
  setTimeout(onWindowResize, 100);
  setTimeout(onWindowResize, 300);
});
