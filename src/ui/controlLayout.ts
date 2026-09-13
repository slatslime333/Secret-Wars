import { getTouchControlLayout, type Point, type TouchControlLayout } from './touchLayout';

export const CONTROL_LAYOUT_STORAGE_KEY = 'secret-wars-control-layout';

export const CONTROL_IDS = [
  'leftStick',
  'rightStick',
  'block',
  'dash',
  'ability1',
  'ability2',
  'ultimate',
] as const;

export type ControlId = (typeof CONTROL_IDS)[number];

export type ControlPlacement = {
  nx: number;
  ny: number;
  scale: number;
};

export type SavedControlLayout = Partial<Record<ControlId, ControlPlacement>>;

export const CONTROL_LABEL: Record<ControlId, string> = {
  leftStick: 'MOVE',
  rightStick: 'AIM',
  block: 'SHIELD',
  dash: 'DASH',
  ability1: 'A1',
  ability2: 'A2',
  ultimate: 'ULT',
};

const MIN_SCALE = 0.65;
const MAX_SCALE = 1.75;
const EDGE = 10;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clampControlScale = (scale: number): number => clamp(scale, MIN_SCALE, MAX_SCALE);

export const loadControlLayout = (): SavedControlLayout => {
  try {
    const raw = localStorage.getItem(CONTROL_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as SavedControlLayout;
    const next: SavedControlLayout = {};
    for (const id of CONTROL_IDS) {
      const entry = parsed[id];
      if (!entry || typeof entry.nx !== 'number' || typeof entry.ny !== 'number') {
        continue;
      }
      next[id] = {
        nx: clamp(entry.nx, 0, 1),
        ny: clamp(entry.ny, 0, 1),
        scale: clampControlScale(typeof entry.scale === 'number' ? entry.scale : 1),
      };
    }
    return next;
  } catch {
    return {};
  }
};

export const saveControlLayout = (layout: SavedControlLayout): void => {
  try {
    localStorage.setItem(CONTROL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Private mode / blocked storage should not break the menu.
  }
};

export const clearControlLayout = (): void => {
  try {
    localStorage.removeItem(CONTROL_LAYOUT_STORAGE_KEY);
  } catch {
    // Ignore quota / privacy failures.
  }
};

export const defaultControlPlacement = (width: number, height: number): Record<ControlId, ControlPlacement> => {
  const layout = getTouchControlLayout(width, height);
  return {
    leftStick: toPlacement(layout.leftStick, width, height),
    rightStick: toPlacement(layout.rightStick, width, height),
    block: toPlacement(layout.block, width, height),
    dash: toPlacement(layout.dash, width, height),
    ability1: toPlacement(layout.ability1, width, height),
    ability2: toPlacement(layout.ability2, width, height),
    ultimate: toPlacement(layout.ultimate, width, height),
  };
};

export const mergeControlLayout = (
  width: number,
  height: number,
  saved: SavedControlLayout,
): Record<ControlId, ControlPlacement> => {
  const defaults = defaultControlPlacement(width, height);
  const merged = { ...defaults };
  for (const id of CONTROL_IDS) {
    const entry = saved[id];
    if (entry) {
      merged[id] = {
        nx: clamp(entry.nx, 0, 1),
        ny: clamp(entry.ny, 0, 1),
        scale: clampControlScale(entry.scale),
      };
    }
  }
  return merged;
};

const toPlacement = (point: Point, width: number, height: number): ControlPlacement => ({
  nx: point.x / Math.max(1, width),
  ny: point.y / Math.max(1, height),
  scale: 1,
});

const radiusOf = (id: ControlId, layout: TouchControlLayout, scale: number): number => {
  const base =
    id === 'leftStick' || id === 'rightStick'
      ? layout.radius
      : id === 'ultimate'
        ? layout.ultimateRadius
        : id === 'ability1' || id === 'ability2'
          ? layout.abilityRadius
          : layout.buttonRadius;
  return Math.round(base * scale);
};

export type ResolvedControl = Point & { r: number };

export const resolveControls = (
  width: number,
  height: number,
  saved: SavedControlLayout = loadControlLayout(),
): Record<ControlId, ResolvedControl> => {
  const base = getTouchControlLayout(width, height);
  const merged = mergeControlLayout(width, height, saved);
  const resolved = {} as Record<ControlId, ResolvedControl>;
  for (const id of CONTROL_IDS) {
    const entry = merged[id];
    const r = radiusOf(id, base, entry.scale);
    resolved[id] = {
      x: Math.round(clamp(entry.nx * width, r + EDGE, width - r - EDGE)),
      y: Math.round(clamp(entry.ny * height, r + EDGE, height - r - EDGE)),
      r,
    };
  }
  return resolved;
};

export const getBattleControlLayout = (width: number, height: number): TouchControlLayout => {
  const base = getTouchControlLayout(width, height);
  const resolved = resolveControls(width, height);
  return {
    ...base,
    radius: resolved.leftStick.r,
    buttonRadius: resolved.block.r,
    abilityRadius: resolved.ability1.r,
    ultimateRadius: resolved.ultimate.r,
    leftStick: { x: resolved.leftStick.x, y: resolved.leftStick.y },
    rightStick: { x: resolved.rightStick.x, y: resolved.rightStick.y },
    block: { x: resolved.block.x, y: resolved.block.y },
    dash: { x: resolved.dash.x, y: resolved.dash.y },
    ability1: { x: resolved.ability1.x, y: resolved.ability1.y },
    ability2: { x: resolved.ability2.x, y: resolved.ability2.y },
    ultimate: { x: resolved.ultimate.x, y: resolved.ultimate.y },
  };
};
