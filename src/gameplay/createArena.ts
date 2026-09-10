import Phaser from 'phaser';

export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 1000;
export const WALL_SIZE = 56;

export const ARENA_BOUNDS = new Phaser.Geom.Rectangle(
  WALL_SIZE + 18,
  WALL_SIZE + 18,
  ARENA_WIDTH - (WALL_SIZE + 18) * 2,
  ARENA_HEIGHT - (WALL_SIZE + 18) * 2,
);

const GRASS = {
  dark: 0x386f42,
  mid: 0x4f8b4c,
  light: 0x68a85a,
  shadow: 0x285634,
} as const;

const BRICK = {
  top: 0x9d6651,
  light: 0xc18362,
  dark: 0x623e3b,
  mortar: 0x392d31,
} as const;

export const createArena = (scene: Phaser.Scene): void => {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x10151d);
  graphics.fillRect(-70, -70, ARENA_WIDTH + 140, ARENA_HEIGHT + 140);
  graphics.fillStyle(GRASS.mid);
  graphics.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  for (let y = WALL_SIZE; y < ARENA_HEIGHT - WALL_SIZE; y += 32) {
    for (let x = WALL_SIZE; x < ARENA_WIDTH - WALL_SIZE; x += 32) {
      const checker = (x / 32 + y / 32) % 2 === 0;
      graphics.fillStyle(checker ? GRASS.mid : GRASS.dark, 0.34);
      graphics.fillRect(x, y, 32, 32);

      const seed = (x * 13 + y * 7) % 101;
      if (seed < 20) {
        graphics.fillStyle(seed < 10 ? GRASS.light : GRASS.shadow, 0.7);
        graphics.fillRect(x + 7 + (seed % 9), y + 9 + (seed % 7), 3, 7);
        graphics.fillRect(x + 11 + (seed % 5), y + 13 + (seed % 11), 2, 5);
      }
    }
  }

  graphics.lineStyle(2, GRASS.light, 0.13);
  for (let x = 80; x < ARENA_WIDTH; x += 128) {
    graphics.lineBetween(x, WALL_SIZE, x - 180, ARENA_HEIGHT - WALL_SIZE);
  }

  drawHorizontalWall(graphics, 0, true);
  drawHorizontalWall(graphics, ARENA_HEIGHT - WALL_SIZE, false);
  drawVerticalWall(graphics, 0);
  drawVerticalWall(graphics, ARENA_WIDTH - WALL_SIZE);

  graphics.lineStyle(4, BRICK.mortar, 0.9);
  graphics.strokeRect(WALL_SIZE, WALL_SIZE, ARENA_WIDTH - WALL_SIZE * 2, ARENA_HEIGHT - WALL_SIZE * 2);
};

const drawHorizontalWall = (
  graphics: Phaser.GameObjects.Graphics,
  y: number,
  top: boolean,
): void => {
  graphics.fillStyle(BRICK.dark);
  graphics.fillRect(0, y, ARENA_WIDTH, WALL_SIZE);
  graphics.fillStyle(BRICK.top);
  graphics.fillRect(0, y + (top ? 8 : 0), ARENA_WIDTH, 38);
  graphics.fillStyle(BRICK.light, 0.75);
  graphics.fillRect(0, y + (top ? 8 : 0), ARENA_WIDTH, 7);

  for (let row = 0; row < 2; row += 1) {
    const brickY = y + (top ? 9 : 1) + row * 19;
    for (let x = row % 2 === 0 ? -20 : 0; x < ARENA_WIDTH; x += 42) {
      graphics.lineStyle(2, BRICK.mortar, 0.8);
      graphics.strokeRect(x, brickY, 42, 19);
    }
  }
};

const drawVerticalWall = (graphics: Phaser.GameObjects.Graphics, x: number): void => {
  graphics.fillStyle(BRICK.dark);
  graphics.fillRect(x, 0, WALL_SIZE, ARENA_HEIGHT);
  graphics.fillStyle(BRICK.top);
  graphics.fillRect(x + 8, 0, 38, ARENA_HEIGHT);
  graphics.fillStyle(BRICK.light, 0.7);
  graphics.fillRect(x + 8, 0, 7, ARENA_HEIGHT);

  for (let row = 0; row < Math.ceil(ARENA_HEIGHT / 42); row += 1) {
    const brickY = row * 42 - 20;
    graphics.lineStyle(2, BRICK.mortar, 0.8);
    graphics.strokeRect(x + 9, brickY, 18, 42);
    graphics.strokeRect(x + 27, brickY + 21, 18, 42);
  }
};
