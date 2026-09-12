import Phaser from 'phaser';
import { COLORS } from '../../ui/theme';

export const ABILITY_ICON = {
  smokeBomb: 'ability-icon-smoke-bomb',
  backflipKick: 'ability-icon-backflip-kick',
  ninjaTornado: 'ability-icon-ninja-tornado',
} as const;

const SIZE = 128;
const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** Custom ability art — not letter/generic-symbol placeholders. */
export const ensureAbilityIcons = (scene: Phaser.Scene): void => {
  drawIfMissing(scene, ABILITY_ICON.smokeBomb, drawSmokeBomb);
  drawIfMissing(scene, ABILITY_ICON.backflipKick, drawBackflipKick);
  drawIfMissing(scene, ABILITY_ICON.ninjaTornado, drawNinjaTornado);
};

const drawIfMissing = (
  scene: Phaser.Scene,
  key: string,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): void => {
  if (scene.textures.exists(key)) {
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  draw(ctx, SIZE);
  scene.textures.addCanvas(key, canvas);
};

const ink = hex(COLORS.ink);
const paper = hex(COLORS.paper);
const orange = hex(COLORS.orange);
const yellow = hex(COLORS.yellow);
const cyan = hex(COLORS.cyan);
const panel = hex(COLORS.panel);

const drawSmokeBomb = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();

  const plume = (ox: number, oy: number, rx: number, ry: number, rot: number, color: string, alpha: number) => {
    ctx.save();
    ctx.translate(c + ox, c + oy);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  plume(-8, -18, 28, 16, -0.6, '#2a3344', 0.95);
  plume(10, -28, 22, 14, 0.4, '#3d4a5c', 0.9);
  plume(-22, -6, 18, 12, -0.2, '#1b2433', 0.88);
  plume(18, -8, 16, 11, 0.5, '#4a5568', 0.8);
  plume(0, -34, 14, 10, 0.1, paper, 0.35);
  plume(-14, -26, 10, 7, -0.8, cyan, 0.28);

  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(c + 1, c + 18, 22, 18, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b241c';
  ctx.beginPath();
  ctx.ellipse(c, c + 16, 20, 16, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = paper;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(c, c + 16, 20, 16, 0.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(c - 3, c - 6, 6, 12);
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c, c - 6);
  ctx.quadraticCurveTo(c + 10, c - 22, c + 4, c - 32);
  ctx.stroke();
  ctx.fillStyle = orange;
  ctx.beginPath();
  ctx.arc(c + 4, c - 33, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = paper;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(c - 7, c + 10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const drawBackflipKick = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = orange;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(c + 6, c + 4, 38, -2.4, 0.35);
  ctx.stroke();
  ctx.strokeStyle = paper;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c + 6, c + 4, 38, -2.2, 0.15);
  ctx.stroke();

  ctx.save();
  ctx.translate(c - 2, c + 4);
  ctx.rotate(-0.85);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#151515';
  ctx.beginPath();
  ctx.arc(0, -18, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paper;
  ctx.fillRect(-8, -8, 16, 5);
  ctx.fillStyle = cyan;
  ctx.fillRect(-10, 6, 8, 3);
  ctx.fillStyle = ink;
  ctx.fillRect(-4, 12, 7, 18);
  ctx.save();
  ctx.translate(6, 10);
  ctx.rotate(1.15);
  ctx.fillRect(-4, 0, 7, 28);
  ctx.restore();
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, 36);
  ctx.lineTo(18, 42);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = paper;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(c + 28, c - 10);
  ctx.lineTo(c + 44, c - 18);
  ctx.lineTo(c + 36, c - 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const drawNinjaTornado = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 8, c, c, c - 2);
  grad.addColorStop(0, '#3a2410');
  grad.addColorStop(1, '#121820');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();

  const spiral = (radius: number, width: number, color: string, start: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 36; i += 1) {
      const t = i / 36;
      const ang = start + t * Math.PI * 2.4;
      const r = radius * (0.25 + t * 0.75);
      const x = c + Math.cos(ang) * r;
      const y = c + Math.sin(ang) * r;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  };

  spiral(48, 9, orange, 0.2);
  spiral(42, 6, paper, 1.1);
  spiral(36, 4, yellow, 2.2);
  spiral(30, 3, cyan, 3.4);

  ctx.strokeStyle = paper;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 22, 0.4, 2.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, 16, 2.6, 4.6);
  ctx.stroke();

  ctx.save();
  ctx.translate(c + 4, c + 2);
  ctx.rotate(-0.55);
  ctx.fillStyle = paper;
  ctx.fillRect(-3, -26, 6, 40);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-2, -26);
  ctx.lineTo(14, -38);
  ctx.lineTo(4, -22);
  ctx.fill();
  ctx.fillStyle = orange;
  ctx.fillRect(-5, 12, 10, 6);
  ctx.restore();

  ctx.strokeStyle = yellow;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, -0.4, 1.1);
  ctx.stroke();
  ctx.strokeStyle = orange;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 2.2, 3.6);
  ctx.stroke();
};
