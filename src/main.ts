import Phaser from 'phaser';
import { audioSettings } from './audio';
import { cameraPrefs } from './config/cameraPrefs';
import './style.css';
import { getViewportSize } from './device';
import { registerServiceWorker } from './pwa';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MatchFormatScene } from './scenes/MatchFormatScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MatchScene } from './scenes/MatchScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ControlLayoutScene } from './scenes/ControlLayoutScene';
import { SimulatorSetupScene } from './scenes/SimulatorSetupScene';
import { RosterDraftScene } from './scenes/RosterDraftScene';
import { TitleScene } from './scenes/TitleScene';
import { getGameSize } from './ui/theme';
import { applyBackingStore, installBackingStore } from './ui/layout/backingStore';

audioSettings.load();
cameraPrefs.load();
registerServiceWorker();

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
  scene: [BootScene, TitleScene, MainMenuScene, SettingsScene, ControlLayoutScene, CharacterSelectScene, MatchFormatScene, RosterDraftScene, SimulatorSetupScene, BattleScene, MatchScene],
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
});

installBackingStore(game);
guardGameLoop(game);

(window as Window & { secretWars?: Phaser.Game }).secretWars = game;

const onWindowResize = () => {
  syncGameShell();
  const next = getGameSize(gameRoot?.clientWidth, gameRoot?.clientHeight);
  if (game.scale.width !== next.width || game.scale.height !== next.height) {
    game.scale.resize(next.width, next.height);
  }
  applyBackingStore(game);
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

/**
 * Phaser schedules the next animation frame only after the step returns.
 * A throw inside update or render leaves the loop running with no further frames.
 * Rebind the frame callback to the guarded step; wake() later binds these methods.
 */
function guardGameLoop(game: Phaser.Game): void {
  const loop = game.loop as Phaser.Core.TimeStep & {
    _target: number;
    step: (time: number) => void;
    stepLimitFPS: (time: number) => void;
  };
  const protect = (run: (time: number) => void): ((time: number) => void) => {
    const bound = run.bind(loop);
    return (time: number) => {
      try {
        bound(time);
      } catch (error) {
        console.error(error);
      }
    };
  };
  loop.step = protect(loop.step);
  loop.stepLimitFPS = protect(loop.stepLimitFPS);
  loop.raf.stop();
  const next = loop.hasFpsLimit ? loop.stepLimitFPS.bind(loop) : loop.step.bind(loop);
  loop.raf.start(next, loop.forceSetTimeOut, loop._target);
}
