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

export const closestPointOnRect = (x: number, y: number, rect: Rect): Point => ({
  x: Math.max(rect.x, Math.min(x, rect.x + rect.w)),
  y: Math.max(rect.y, Math.min(y, rect.y + rect.h)),
});

export const circleHitsRect = (x: number, y: number, radius: number, rect: Rect): boolean => {
  const nearest = closestPointOnRect(x, y, rect);
  return Math.hypot(x - nearest.x, y - nearest.y) < radius;
};

/** True when the segment touches the rect, including endpoints inside it. */
export const segmentHitsRect = (x1: number, y1: number, x2: number, y2: number, rect: Rect): boolean => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rect.x, rect.x + rect.w - x1, y1 - rect.y, rect.y + rect.h - y1];
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) {
        return false;
      }
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > t1) {
        return false;
      }
      if (t > t0) {
        t0 = t;
      }
    } else {
      if (t < t0) {
        return false;
      }
      if (t < t1) {
        t1 = t;
      }
    }
  }
  return true;
};

/**
 * Push a circle out of a rect. Returns the resolved center, or undefined when
 * the circle is already clear.
 */
export const resolveCircleRect = (
  x: number,
  y: number,
  radius: number,
  rect: Rect,
): Point | undefined => {
  const nearest = closestPointOnRect(x, y, rect);
  const dx = x - nearest.x;
  const dy = y - nearest.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= radius) {
    return undefined;
  }
  if (dist > 0.001) {
    const push = radius - dist + 0.5;
    return { x: x + (dx / dist) * push, y: y + (dy / dist) * push };
  }
  const left = x - rect.x;
  const right = rect.x + rect.w - x;
  const top = y - rect.y;
  const bottom = rect.y + rect.h - y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) {
    return { x: rect.x - radius - 0.5, y };
  }
  if (min === right) {
    return { x: rect.x + rect.w + radius + 0.5, y };
  }
  if (min === top) {
    return { x, y: rect.y - radius - 0.5 };
  }
  return { x, y: rect.y + rect.h + radius + 0.5 };
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
