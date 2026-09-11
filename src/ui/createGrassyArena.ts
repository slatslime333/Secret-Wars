import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { COLORS, FONTS, hex } from './theme';

/**
 * Grassy pixelated arena map for Secret Wars.
 * Features textured retro pixel grass tiles, dirt paths, stone perimeter borders,
 * wildflower tufts, and clean pixelated boundary markings.
 */
export const createGrassyArena = (scene: Phaser.Scene): void => {
  const { width, height, wallThickness } = ARENA;
  const graphics = scene.add.graphics().setDepth(0);

  // Outer base dark earth
  graphics.fillStyle(0x0a140d);
  graphics.fillRect(0, 0, width, height);

  // Grassy field within walls
  const fieldX = wallThickness;
  const fieldY = wallThickness;
  const fieldW = width - wallThickness * 2;
  const fieldH = height - wallThickness * 2;

  // Base grass tone
  graphics.fillStyle(0x285928);
  graphics.fillRect(fieldX, fieldY, fieldW, fieldH);

  // Pixelated checker grid of lush greens (16x16 pixel tiles)
  const tileSize = 20;
  for (let y = fieldY; y < fieldY + fieldH; y += tileSize) {
    for (let x = fieldX; x < fieldX + fieldW; x += tileSize) {
      // Deterministic pseudo-random pattern based on coordinates
      const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const rand = seed - Math.floor(seed);
      const isAlt = ((x + y) / tileSize) % 2 === 0;

      let color = isAlt ? 0x2e662e : 0x245224;
      if (rand > 0.78) {
        color = 0x367736; // bright lush patch
      } else if (rand < 0.15) {
        color = 0x1d441d; // deep shade patch
      }

      graphics.fillStyle(color, 1);
      graphics.fillRect(x, y, tileSize, tileSize);

      // Pixel tufts of grass blades
      if (rand > 0.65) {
        graphics.fillStyle(0x449644, 0.85);
        graphics.fillRect(x + 3, y + 4, 3, 6);
        graphics.fillRect(x + 7, y + 2, 3, 8);
        graphics.fillRect(x + 11, y + 5, 3, 5);
        graphics.fillStyle(0x183818, 0.7);
        graphics.fillRect(x + 4, y + 10, 8, 2);
      } else if (rand < 0.12) {
        // Small earth speck / pebble
        graphics.fillStyle(0x544732, 0.8);
        graphics.fillRect(x + 8, y + 8, 4, 3);
        graphics.fillStyle(0x231d14, 0.9);
        graphics.fillRect(x + 9, y + 11, 4, 1);
      } else if (rand > 0.48 && rand < 0.54) {
        // Small pixel wildflower (cyan or red comic accents)
        const flowerColor = rand > 0.51 ? COLORS.cyan : COLORS.redBright;
        graphics.fillStyle(flowerColor, 0.95);
        graphics.fillRect(x + 8, y + 7, 3, 3);
        graphics.fillStyle(COLORS.paper, 0.9);
        graphics.fillRect(x + 9, y + 8, 1, 1);
      }
    }
  }

  // Worn natural dirt sparring circle in the center arena
  const centerX = width / 2;
  const centerY = height / 2;
  graphics.fillStyle(0x3b3323, 0.28);
  graphics.fillEllipse(centerX, centerY, 480, 280);
  graphics.fillStyle(0x4a402c, 0.22);
  graphics.fillEllipse(centerX, centerY, 380, 220);

  // Subtle comic-style boundary lines cut into the turf
  graphics.lineStyle(2, COLORS.paper, 0.22);
  graphics.strokeEllipse(centerX, centerY, 520, 310);
  graphics.lineStyle(2, 0x1d441d, 0.5);
  graphics.strokeEllipse(centerX, centerY, 524, 314);

  // Center division marker (subtle grass cut line)
  graphics.lineStyle(2, COLORS.paper, 0.25);
  graphics.lineBetween(centerX, fieldY + 16, centerX, fieldY + fieldH - 16);

  // Stone/wood perimeter walls enclosing the field
  drawStonePerimeter(graphics, width, height, wallThickness);

  // Spawn pads embedded in the turf
  drawTurfSpawnPad(scene, ARENA.playerSpawn.x, ARENA.playerSpawn.y, COLORS.cyan, 'NINJA');
  drawTurfSpawnPad(scene, ARENA.enemySpawn.x, ARENA.enemySpawn.y, COLORS.redBright, 'CHASER');
};

const drawStonePerimeter = (
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  wall: number,
): void => {
  // Deep stone base
  graphics.fillStyle(0x1a211e);
  graphics.fillRect(0, 0, width, wall);
  graphics.fillRect(0, height - wall, width, wall);
  graphics.fillRect(0, 0, wall, height);
  graphics.fillRect(width - wall, 0, wall, height);

  // Pixelated stone brick pattern on perimeter
  const brickW = 32;
  const brickH = wall - 8;
  for (let x = 0; x < width; x += brickW) {
    // Top wall
    graphics.fillStyle(((x / brickW) % 2 === 0) ? 0x2d3832 : 0x242d28, 1);
    graphics.fillRect(x + 2, 4, brickW - 4, brickH);
    graphics.fillStyle(0x44534a, 0.6);
    graphics.fillRect(x + 2, 4, brickW - 4, 3);

    // Bottom wall
    graphics.fillStyle(((x / brickW) % 2 === 0) ? 0x242d28 : 0x2d3832, 1);
    graphics.fillRect(x + 2, height - wall + 4, brickW - 4, brickH);
    graphics.fillStyle(0x44534a, 0.6);
    graphics.fillRect(x + 2, height - wall + 4, brickW - 4, 3);
  }

  for (let y = 0; y < height; y += brickW) {
    // Left wall
    graphics.fillStyle(((y / brickW) % 2 === 0) ? 0x2d3832 : 0x242d28, 1);
    graphics.fillRect(4, y + 2, brickH, brickW - 4);

    // Right wall
    graphics.fillStyle(((y / brickW) % 2 === 0) ? 0x242d28 : 0x2d3832, 1);
    graphics.fillRect(width - wall + 4, y + 2, brickH, brickW - 4);
  }

  // Comic border lines
  graphics.lineStyle(3, COLORS.ink, 1);
  graphics.strokeRect(wall - 2, wall - 2, width - (wall - 2) * 2, height - (wall - 2) * 2);
  graphics.lineStyle(2, COLORS.paper, 0.45);
  graphics.strokeRect(wall, wall, width - wall * 2, height - wall * 2);
};

const drawTurfSpawnPad = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  accent: number,
  label: string,
): void => {
  const graphics = scene.add.graphics().setDepth(1);

  // Stone ring base
  graphics.fillStyle(0x1a211e, 0.85);
  graphics.fillCircle(x, y, 44);

  // Comic accent rings
  graphics.lineStyle(3, accent, 0.95);
  graphics.strokeCircle(x, y, 42);
  graphics.lineStyle(2, COLORS.paper, 0.5);
  graphics.strokeCircle(x, y, 32);

  // Inner glow
  graphics.fillStyle(accent, 0.22);
  graphics.fillCircle(x, y, 26);

  // Cross hair marker
  graphics.lineStyle(2, accent, 0.7);
  graphics.lineBetween(x - 14, y, x + 14, y);
  graphics.lineBetween(x, y - 14, x, y + 14);

  if (!label) {
    return;
  }

  scene.add
    .text(x, y + 54, label, {
      fontFamily: FONTS.display,
      fontSize: '11px',
      color: hex(COLORS.paper),
      letterSpacing: 2,
      stroke: hex(COLORS.ink),
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(2);
};
