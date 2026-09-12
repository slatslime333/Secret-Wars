import type { Point, Rect } from './types';

export const rectsOverlap = (a: Rect, b: Rect, pad = 0): boolean =>
  a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

export const pointInRect = (x: number, y: number, rect: Rect): boolean =>
  x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;

export const inflate = (rect: Rect, amount: number): Rect => ({
  x: rect.x - amount,
  y: rect.y - amount,
  w: rect.w + amount * 2,
  h: rect.h + amount * 2,
});

export const circleHitsRect = (x: number, y: number, radius: number, rect: Rect): boolean => {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return Math.hypot(x - nearestX, y - nearestY) < radius;
};

export const gapBetween = (a: Rect, b: Rect): number => {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if (dx === 0 && dy === 0) {
    return 0;
  }
  if (dx === 0) {
    return dy;
  }
  if (dy === 0) {
    return dx;
  }
  return Math.hypot(dx, dy);
};

export const centerOf = (rect: Rect): Point => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});

export const rectArea = (rect: Rect): number => rect.w * rect.h;
