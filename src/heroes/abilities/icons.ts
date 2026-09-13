import Phaser from 'phaser';
import { COLORS } from '../../ui/theme';

export const CONTROL_ICON = {
  dash: 'control-icon-dash',
  shield: 'control-icon-shield',
} as const;

export const ABILITY_ICON = {
  smokeBomb: 'ability-icon-smoke-bomb',
  backflipKick: 'ability-icon-backflip-kick',
  ninjaTornado: 'ability-icon-ninja-tornado',
  electricBall: 'ability-icon-electric-ball',
  discharge: 'ability-icon-discharge',
  thunderstorm: 'ability-icon-thunderstorm',
  gunBarrage: 'ability-icon-gun-barrage',
  batSmash: 'ability-icon-bat-smash',
  batSweep: 'ability-icon-bat-sweep',
  ropeGrab: 'ability-icon-rope-grab',
  megaPunch: 'ability-icon-mega-punch',
  ropeSpray: 'ability-icon-rope-spray',
  tombstone: 'ability-icon-tombstone',
  hex: 'ability-icon-hex',
  tombstoneUlt: 'ability-icon-tombstone-ult',
  shadowClaw: 'ability-icon-shadow-claw',
  shadowDash: 'ability-icon-shadow-dash',
  shadowRage: 'ability-icon-shadow-rage',
} as const;

const SIZE = 128;
const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** Custom ability art — not letter/generic-symbol placeholders. */
export const ensureAbilityIcons = (scene: Phaser.Scene): void => {
  drawIfMissing(scene, ABILITY_ICON.smokeBomb, drawSmokeBomb);
  drawIfMissing(scene, ABILITY_ICON.backflipKick, drawBackflipKick);
  drawIfMissing(scene, ABILITY_ICON.ninjaTornado, drawNinjaTornado);
  drawIfMissing(scene, ABILITY_ICON.electricBall, drawElectricBall);
  drawIfMissing(scene, ABILITY_ICON.discharge, drawDischarge);
  drawIfMissing(scene, ABILITY_ICON.thunderstorm, drawThunderstorm);
  drawIfMissing(scene, ABILITY_ICON.gunBarrage, drawGunBarrage);
  drawIfMissing(scene, ABILITY_ICON.batSmash, drawBatSmash);
  drawIfMissing(scene, ABILITY_ICON.batSweep, drawBatSweep);
  drawIfMissing(scene, ABILITY_ICON.ropeGrab, drawRopeGrab);
  drawIfMissing(scene, ABILITY_ICON.megaPunch, drawMegaPunch);
  drawIfMissing(scene, ABILITY_ICON.ropeSpray, drawRopeSpray);
  drawIfMissing(scene, ABILITY_ICON.tombstone, drawTombstoneIcon);
  drawIfMissing(scene, ABILITY_ICON.hex, drawHexIcon);
  drawIfMissing(scene, ABILITY_ICON.tombstoneUlt, drawTombstoneUltIcon);
  drawIfMissing(scene, ABILITY_ICON.shadowClaw, drawShadowClawIcon);
  drawIfMissing(scene, ABILITY_ICON.shadowDash, drawShadowDashIcon);
  drawIfMissing(scene, ABILITY_ICON.shadowRage, drawShadowRageIcon);
  drawIfMissing(scene, CONTROL_ICON.dash, drawDashIcon);
  drawIfMissing(scene, CONTROL_ICON.shield, drawShieldIcon);
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

const drawElectricBall = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = '#102030';
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4aa8ff';
  ctx.beginPath();
  ctx.arc(c, c, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dff4ff';
  ctx.beginPath();
  ctx.arc(c - 5, c - 6, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cyan;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(c - 28, c + 8);
  ctx.lineTo(c - 8, c - 10);
  ctx.lineTo(c + 6, c + 4);
  ctx.lineTo(c + 26, c - 12);
  ctx.stroke();
};

const drawDischarge = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cyan;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = paper;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 40, 0.2, 2);
  ctx.stroke();
  ctx.fillStyle = '#4aa8ff';
  ctx.beginPath();
  ctx.arc(c, c, 8, 0, Math.PI * 2);
  ctx.fill();
};

const drawThunderstorm = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = '#101820';
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a3344';
  ctx.beginPath();
  ctx.ellipse(c, c - 18, 36, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c - 8, c - 10);
  ctx.lineTo(c + 4, c + 8);
  ctx.lineTo(c - 6, c + 10);
  ctx.lineTo(c + 10, c + 32);
  ctx.stroke();
  ctx.strokeStyle = cyan;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c + 16, c - 8);
  ctx.lineTo(c + 22, c + 14);
  ctx.stroke();
};

const drawGunBarrage = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = '#2a1c14';
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(c - 28, c - 6, 44, 12);
  ctx.fillRect(c + 8, c - 10, 8, 20);
  ctx.fillStyle = paper;
  ctx.fillRect(c + 16, c - 3, 18, 5);
  ctx.fillStyle = orange;
  ctx.fillRect(c + 32, c - 2, 10, 4);
  ctx.fillStyle = yellow;
  ctx.fillRect(c + 40, c - 10, 5, 5);
  ctx.fillRect(c + 46, c + 2, 5, 5);
  ctx.fillRect(c + 38, c + 10, 5, 5);
};

const drawBatSmash = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 18, c - 28);
  ctx.lineTo(c + 16, c + 26);
  ctx.stroke();
  ctx.strokeStyle = '#c68654';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(c - 18, c - 28);
  ctx.lineTo(c + 16, c + 26);
  ctx.stroke();
  ctx.fillStyle = '#d8d4c8';
  ctx.beginPath();
  ctx.arc(c + 4, c + 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c - 2, c - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = orange;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c + 8, c + 22, 22, 0.2, 2.2);
  ctx.stroke();
};

const drawBatSweep = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = '#121014';
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = orange;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(c, c, 38, -0.4, 2.4);
  ctx.stroke();
  ctx.strokeStyle = '#c68654';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, 30, 0.2, 3.2);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(c, c, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c02028';
  ctx.beginPath();
  ctx.moveTo(c - 6, c - 8);
  ctx.lineTo(c - 2, c - 2);
  ctx.lineTo(c - 8, c - 1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c + 6, c - 8);
  ctx.lineTo(c + 2, c - 2);
  ctx.lineTo(c + 8, c - 1);
  ctx.fill();
};

const drawRopeGrab = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a3014';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(c - 28, c + 18);
  ctx.quadraticCurveTo(c + 8, c - 36, c + 30, c - 8);
  ctx.stroke();
  ctx.strokeStyle = '#c4894a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(c - 28, c + 18);
  ctx.quadraticCurveTo(c + 8, c - 36, c + 30, c - 8);
  ctx.stroke();
  ctx.strokeStyle = orange;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c + 28, c - 8, 12, -0.4, 4.2);
  ctx.stroke();
  ctx.fillStyle = '#8a5228';
  ctx.beginPath();
  ctx.arc(c - 28, c + 18, 6, 0, Math.PI * 2);
  ctx.fill();
};

const drawMegaPunch = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5228';
  ctx.beginPath();
  ctx.ellipse(c, c + 8, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4894a';
  ctx.beginPath();
  ctx.ellipse(c, c + 4, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = orange;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c - 6, c - 8);
  ctx.lineTo(c + 4, c - 34);
  ctx.lineTo(c + 14, c - 10);
  ctx.stroke();
  ctx.fillStyle = yellow;
  ctx.beginPath();
  ctx.moveTo(c - 2, c - 36);
  ctx.lineTo(c + 18, c - 28);
  ctx.lineTo(c + 6, c - 18);
  ctx.fill();
};

const drawRopeSpray = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5228';
  ctx.beginPath();
  ctx.arc(c, c, 12, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? '#c4894a' : '#5a3014';
    ctx.lineWidth = i % 2 === 0 ? 4 : 5;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 10, c + Math.sin(a) * 10);
    ctx.lineTo(c + Math.cos(a) * 42, c + Math.sin(a) * 42);
    ctx.stroke();
  }
  ctx.fillStyle = '#b428e0';
  ctx.beginPath();
  ctx.moveTo(c, c - 8);
  ctx.lineTo(c + 5, c + 2);
  ctx.lineTo(c - 5, c + 2);
  ctx.fill();
};

const drawTombstoneIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a32';
  ctx.fillRect(c - 18, c - 8, 16, 28);
  ctx.fillRect(c + 2, c - 8, 16, 28);
  ctx.fillStyle = '#9b4dff';
  ctx.beginPath();
  ctx.arc(c - 10, c + 2, 3, 0, Math.PI * 2);
  ctx.arc(c + 10, c + 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0ead8';
  ctx.beginPath();
  ctx.arc(c - 22, c + 18, 7, 0, Math.PI * 2);
  ctx.arc(c + 22, c + 18, 7, 0, Math.PI * 2);
  ctx.fill();
};

const drawHexIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9b4dff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#c090ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 18, 0.4, 4);
  ctx.stroke();
  ctx.fillStyle = '#3cdb5c';
  ctx.beginPath();
  ctx.arc(c, c, 8, 0, Math.PI * 2);
  ctx.fill();
};

const drawTombstoneUltIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9b4dff';
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(c, c, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2a2a32';
  ctx.fillRect(c - 10, c - 6, 20, 30);
  ctx.fillStyle = '#f0ead8';
  ctx.beginPath();
  ctx.arc(c - 22, c + 16, 7, 0, Math.PI * 2);
  ctx.arc(c, c + 22, 7, 0, Math.PI * 2);
  ctx.arc(c + 22, c + 16, 7, 0, Math.PI * 2);
  ctx.fill();
};

const drawShadowClawIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1028';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(c + 6, c + 4, 28, 22, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#8a68c0';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 18, c + 16);
  ctx.lineTo(c + 8, c - 8);
  ctx.lineTo(c + 28, c - 22);
  ctx.stroke();
  ctx.strokeStyle = '#c8b8e8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c - 10, c + 18);
  ctx.lineTo(c + 16, c - 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 4, c + 22);
  ctx.lineTo(c + 22, c + 2);
  ctx.stroke();
};

const drawShadowDashIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a3470';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(c - 28, c + 10);
  ctx.lineTo(c + 24, c - 12);
  ctx.stroke();
  ctx.strokeStyle = '#b8a0e0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c - 20, c + 16);
  ctx.lineTo(c + 18, c - 6);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(c - 8, c + 4, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paper;
  ctx.fillRect(c - 12, c, 8, 3);
};

const drawShadowRageIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = '#120814';
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1438';
  ctx.beginPath();
  ctx.ellipse(c, c + 6, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6a48a0';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(c - 8, c - 10, 10, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c + 10, c - 8, 9, 16, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#c8b8e8';
  ctx.beginPath();
  ctx.arc(c, c - 4, 6, 0, Math.PI * 2);
  ctx.fill();
};

const drawDashIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = orange;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 30, c - 14);
  ctx.lineTo(c + 6, c - 14);
  ctx.moveTo(c - 34, c);
  ctx.lineTo(c + 14, c);
  ctx.moveTo(c - 28, c + 14);
  ctx.lineTo(c + 4, c + 14);
  ctx.stroke();
  ctx.fillStyle = yellow;
  ctx.beginPath();
  ctx.moveTo(c + 8, c - 26);
  ctx.lineTo(c + 42, c);
  ctx.lineTo(c + 8, c + 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.moveTo(c + 14, c - 16);
  ctx.lineTo(c + 34, c);
  ctx.lineTo(c + 14, c + 16);
  ctx.closePath();
  ctx.fill();
};

const drawShieldIcon = (ctx: CanvasRenderingContext2D, size: number): void => {
  const c = size / 2;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cyan;
  ctx.beginPath();
  ctx.moveTo(c, c - 36);
  ctx.quadraticCurveTo(c + 34, c - 28, c + 32, c + 4);
  ctx.quadraticCurveTo(c + 28, c + 28, c, c + 40);
  ctx.quadraticCurveTo(c - 28, c + 28, c - 32, c + 4);
  ctx.quadraticCurveTo(c - 34, c - 28, c, c - 36);
  ctx.fill();
  ctx.fillStyle = '#1a3040';
  ctx.beginPath();
  ctx.moveTo(c, c - 26);
  ctx.quadraticCurveTo(c + 22, c - 20, c + 20, c + 2);
  ctx.quadraticCurveTo(c + 18, c + 20, c, c + 30);
  ctx.quadraticCurveTo(c - 18, c + 20, c - 20, c + 2);
  ctx.quadraticCurveTo(c - 22, c - 20, c, c - 26);
  ctx.fill();
  ctx.strokeStyle = paper;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(c, c - 22);
  ctx.lineTo(c, c + 24);
  ctx.moveTo(c - 14, c - 2);
  ctx.lineTo(c + 14, c - 2);
  ctx.stroke();
};


