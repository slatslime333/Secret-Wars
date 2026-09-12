import Phaser from 'phaser';
import { audioSettings } from './audio/AudioSettings';
import './style.css';
import { getViewportSize } from './device';
import { initOrientationHandling } from './orientation';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MatchScene } from './scenes/MatchScene';
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
  gameRoot.style.left = `${offsetLeft}px`;
  gameRoot.style.top = `${offsetTop}px`;
  gameRoot.style.right = 'auto';
  gameRoot.style.bottom = 'auto';
  gameRoot.style.width = `${width}px`;
  gameRoot.style.height = `${height}px`;
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
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
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
  scene: [BootScene, TitleScene, MainMenuScene, SettingsScene, CharacterSelectScene, BattleScene, MatchScene],
});

(window as Window & { secretWars?: Phaser.Game }).secretWars = game;

const onWindowResize = () => {
  syncGameShell();
  const next = getGameSize(gameRoot?.clientWidth, gameRoot?.clientHeight);
  if (game.scale.width !== next.width || game.scale.height !== next.height) {
    game.scale.resize(next.width, next.height);
  }
};

window.addEventListener('resize', onWindowResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onWindowResize);
  window.visualViewport.addEventListener('scroll', onWindowResize);
}
window.addEventListener('orientationchange', () => {
  onWindowResize();
  setTimeout(onWindowResize, 50);
  setTimeout(onWindowResize, 150);
  setTimeout(onWindowResize, 400);
});
const screenOrientation = (
  window.screen as Screen & { orientation?: { addEventListener?: typeof window.addEventListener } }
).orientation;
screenOrientation?.addEventListener?.('change', () => {
  onWindowResize();
  setTimeout(onWindowResize, 150);
});
