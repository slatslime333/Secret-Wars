import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { COLORS, FONTS, hex } from './theme';

/**
 * Demo 1 combat pit. Placeholder geometry, Secret Wars palette —
 * dark ink floor, paper walls, cyan/red sides. Not a menu card.
 */
export const createArena = (scene: Phaser.Scene): void => {
  const { width, height, wallThickness } = ARENA;
  const graphics = scene.add.graphics();

  graphics.fillStyle(COLORS.ink);
  graphics.fillRect(0, 0, width, height);

  graphics.fillStyle(COLORS.inkSoft);
  graphics.fillRect(wallThickness, wallThickness, width - wallThickness * 2, height - wallThickness * 2);

  for (let y = wallThickness; y < height - wallThickness; y += 24) {
    for (let x = wallThickness; x < width - wallThickness; x += 24) {
      const checker = ((x + y) / 24) % 2 === 0;
      graphics.fillStyle(checker ? 0x101827 : 0x0c1220, 0.9);
      graphics.fillRect(x, y, 24, 24);
    }
  }

  graphics.fillStyle(COLORS.cyan, 0.07);
  graphics.fillRect(wallThickness, wallThickness, width / 2 - wallThickness, height - wallThickness * 2);
  graphics.fillStyle(COLORS.red, 0.08);
  graphics.fillRect(width / 2, wallThickness, width / 2 - wallThickness, height - wallThickness * 2);

  graphics.lineStyle(2, COLORS.paper, 0.16);
  for (let x = wallThickness + 48; x < width - wallThickness; x += 64) {
    graphics.lineBetween(x, wallThickness, x - 70, height - wallThickness);
  }

  graphics.lineStyle(3, COLORS.paper, 0.35);
  graphics.lineBetween(width / 2, wallThickness + 8, width / 2, height - wallThickness - 8);
  graphics.lineStyle(5, COLORS.ink, 0.55);
  graphics.lineBetween(width / 2 + 6, wallThickness + 8, width / 2 + 6, height - wallThickness - 8);

  drawWalls(graphics, width, height, wallThickness);
  drawSpawnPad(scene, ARENA.playerSpawn.x, ARENA.playerSpawn.y, COLORS.cyan, '');
  drawSpawnPad(scene, ARENA.enemySpawn.x, ARENA.enemySpawn.y, COLORS.redBright, '');
};

const drawWalls = (
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  wall: number,
): void => {
  graphics.fillStyle(0x1c2433);
  graphics.fillRect(0, 0, width, wall);
  graphics.fillRect(0, height - wall, width, wall);
  graphics.fillRect(0, 0, wall, height);
  graphics.fillRect(width - wall, 0, wall, height);

  graphics.fillStyle(COLORS.paper);
  graphics.fillRect(0, 0, width, 8);
  graphics.fillRect(0, height - 8, width, 8);
  graphics.fillRect(0, 0, 8, height);
  graphics.fillRect(width - 8, 0, 8, height);

  graphics.lineStyle(3, COLORS.ink);
  graphics.strokeRect(6, 6, width - 12, height - 12);
  graphics.lineStyle(2, COLORS.cyan, 0.7);
  graphics.strokeRect(wall - 4, wall - 4, width - (wall - 4) * 2, height - (wall - 4) * 2);
};

const drawSpawnPad = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  accent: number,
  label: string,
): void => {
  const graphics = scene.add.graphics();
  graphics.lineStyle(3, accent, 0.9);
  graphics.strokeCircle(x, y, 42);
  graphics.lineStyle(2, COLORS.paper, 0.35);
  graphics.strokeCircle(x, y, 28);
  graphics.fillStyle(accent, 0.18);
  graphics.fillCircle(x, y, 22);

  if (!label) {
    return;
  }

  scene.add
    .text(x, y + 58, label, {
      fontFamily: FONTS.body,
      fontSize: '12px',
      fontStyle: 'bold',
      color: hex(COLORS.paper),
      letterSpacing: 3,
      stroke: hex(COLORS.ink),
      strokeThickness: 4,
    })
    .setOrigin(0.5);
};
