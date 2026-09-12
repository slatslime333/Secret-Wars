import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { COLORS, FONTS, hex } from './theme';

/**
 * Grassy pixelated arena map for Secret Wars.
 * Features textured retro pixel grass tiles, dirt paths, stone perimeter borders,
 * wildflower tufts, and clean pixelated boundary markings.
 */
export const createGrassyArena = (scene: Phaser.Scene, playerLabel = 'NINJA'): void => {
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

  // Base grass tone: rich, vibrant meadow green
  graphics.fillStyle(0x387834);
  graphics.fillRect(fieldX, fieldY, fieldW, fieldH);

  // Pixelated checker grid of lush greens (16x16 pixel tiles)
  const tileSize = 20;
  for (let y = fieldY; y < fieldY + fieldH; y += tileSize) {
    for (let x = fieldX; x < fieldX + fieldW; x += tileSize) {
      // Deterministic pseudo-random pattern based on coordinates
      const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const rand = seed - Math.floor(seed);
      const isAlt = ((x + y) / tileSize) % 2 === 0;

      let color = isAlt ? 0x3d8538 : 0x337030;
      if (rand > 0.76) {
        color = 0x489642; // bright sunlit grass patch
      } else if (rand < 0.16) {
        color = 0x2b5f28; // deep emerald shade patch
      }

      graphics.fillStyle(color, 1);
      graphics.fillRect(x, y, tileSize, tileSize);

      // Pixel tufts of grass blades (crisp retro pixel art)
      if (rand > 0.55) {
        graphics.fillStyle(0x5cb554, 0.95);
        graphics.fillRect(x + 3, y + 4, 3, 7);
        graphics.fillRect(x + 7, y + 2, 3, 9);
        graphics.fillRect(x + 11, y + 5, 3, 6);
        graphics.fillStyle(0x214b1e, 0.85);
        graphics.fillRect(x + 4, y + 11, 8, 2);
      } else if (rand < 0.10) {
        // Small pebble / mossy rock
        graphics.fillStyle(0x605646, 0.85);
        graphics.fillRect(x + 8, y + 8, 4, 3);
        graphics.fillStyle(0x2c261e, 0.9);
        graphics.fillRect(x + 9, y + 11, 4, 1);
      } else if (rand > 0.40 && rand < 0.47) {
        // Small pixel wildflower (white daisies and red poppy accents)
        const flowerColor = rand > 0.43 ? 0xffffff : COLORS.redBright;
        graphics.fillStyle(flowerColor, 0.95);
        graphics.fillRect(x + 8, y + 7, 3, 3);
        graphics.fillStyle(COLORS.yellow, 1);
        graphics.fillRect(x + 9, y + 8, 1, 1);
      }
    }
  }

  // Worn natural dirt sparring circle in the center arena
  const centerX = width / 2;
  const centerY = height / 2;
  graphics.fillStyle(0x6d5c3f, 0.32);
  graphics.fillEllipse(centerX, centerY, 460, 270);
  graphics.fillStyle(0x827050, 0.24);
  graphics.fillEllipse(centerX, centerY, 360, 210);

  // Subtle natural grass cut boundary line
  graphics.lineStyle(2, 0x244c20, 0.55);
  graphics.strokeEllipse(centerX, centerY, 480, 290);

  // Center division marker (subtle grass cut line)
  graphics.lineStyle(1, 0x244c20, 0.45);
  graphics.lineBetween(centerX, fieldY + 16, centerX, fieldY + fieldH - 16);

  // Stone/wood perimeter walls enclosing the field
  drawStonePerimeter(graphics, width, height, wallThickness);

  // Spawn pads embedded in the turf
  drawTurfSpawnPad(scene, ARENA.playerSpawn.x, ARENA.playerSpawn.y, COLORS.cyan, playerLabel);
  drawTurfSpawnPad(scene, ARENA.enemySpawn.x, ARENA.enemySpawn.y, COLORS.redBright, 'RIVAL');
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
  graphics.lineStyle(2, accent, 0.75);
  graphics.strokeCircle(x, y, 42);
  graphics.lineStyle(1, 0x3d8538, 0.6);
  graphics.strokeCircle(x, y, 32);

  // Inner glow
  graphics.fillStyle(accent, 0.16);
  graphics.fillCircle(x, y, 26);

  // Cross hair marker
  graphics.lineStyle(1, accent, 0.6);
  graphics.lineBetween(x - 12, y, x + 12, y);
  graphics.lineBetween(x, y - 12, x, y + 12);

  if (!label) {
    return;
  }

  scene.add
    .text(x, y + 54, label, {
      fontFamily: FONTS.display,
      fontSize: '10px',
      color: hex(COLORS.paper),
      letterSpacing: 2,
      stroke: hex(COLORS.ink),
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setAlpha(0.65)
    .setDepth(2);
};
