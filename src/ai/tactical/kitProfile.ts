import type { KitProfile, KitStance } from './types';

export type KitLiveFlags = {
  staminaRatio: number;
  abilityReady?: boolean;
  dashCharges?: number;
  rageRatio?: number;
  demonForm?: 'little' | 'transforming' | 'big' | 'bat';
  transformLeftMs?: number;
};

const abilityReadyOf = (live: KitLiveFlags): boolean => live.abilityReady !== false;

const dashChargesOf = (live: KitLiveFlags): number => live.dashCharges ?? 2;

/** Shadow with no stamina, no kit, and no dashes should stop committing. */
export const isShadowDry = (heroId: string, live: KitLiveFlags): boolean =>
  heroId === 'shadow' && live.staminaRatio < 0.34 && !abilityReadyOf(live) && dashChargesOf(live) <= 0;

/** Rope without a grab/punch/spray ready should stay at poke range. */
export const isRopeDisarmed = (heroId: string, live: KitLiveFlags): boolean =>
  heroId === 'rope' && !abilityReadyOf(live);

type KitOverride = Partial<Omit<KitProfile, 'heroId' | 'preferredRange' | 'comfortMin' | 'comfortMax'>> & {
  preferredRangeMul?: number;
  comfortMinMul?: number;
  comfortMaxMul?: number;
};

/**
 * Per-hero fighting identity. Personality biases how a kit is played;
 * these values describe what the kit wants in the first place.
 * Add an entry here when a new character ships — do not rewrite the mind.
 */
const KIT_OVERRIDES: Record<string, KitOverride> = {
  witch: {
    stance: 'ranged',
    preferredRangeMul: 0.9,
    comfortMinMul: 0.58,
    comfortMaxMul: 1.18,
    wantsInitiate: false,
    wantsPoke: true,
    wantsFlank: true,
    wantsProtect: true,
    pressureBias: 0.42,
    setupIds: ['witch-tombstone'],
    defensiveIds: ['witch-hex'],
    escapeIds: [],
    ultSaveUntilFoes: 2,
  },
  rope: {
    stance: 'ranged',
    preferredRangeMul: 0.88,
    comfortMinMul: 0.55,
    comfortMaxMul: 1.2,
    wantsInitiate: false,
    wantsPoke: true,
    wantsFlank: true,
    wantsProtect: true,
    pressureBias: 0.4,
    setupIds: [],
    defensiveIds: ['rope-mega-punch'],
    escapeIds: [],
    ultSaveUntilFoes: 2,
  },
  ninja: {
    stance: 'melee',
    preferredRangeMul: 0.72,
    comfortMinMul: 0.35,
    comfortMaxMul: 1.05,
    wantsInitiate: true,
    wantsPoke: false,
    wantsFlank: true,
    wantsProtect: false,
    pressureBias: 0.84,
    setupIds: ['ninja-smoke-bomb'],
    defensiveIds: ['ninja-smoke-bomb'],
    escapeIds: ['ninja-smoke-bomb', 'ninja-backflip-kick'],
    ultSaveUntilFoes: 2,
  },
  shadow: {
    stance: 'melee',
    preferredRangeMul: 0.7,
    comfortMinMul: 0.3,
    comfortMaxMul: 1.05,
    wantsInitiate: true,
    wantsPoke: false,
    wantsFlank: true,
    wantsProtect: false,
    pressureBias: 0.94,
    setupIds: [],
    defensiveIds: [],
    escapeIds: ['shadow-dash'],
    ultSaveUntilFoes: 2,
  },
  cole: {
    stance: 'skirmish',
    preferredRangeMul: 0.78,
    comfortMinMul: 0.4,
    comfortMaxMul: 1.15,
    wantsInitiate: true,
    wantsPoke: true,
    wantsFlank: false,
    wantsProtect: true,
    pressureBias: 0.68,
    setupIds: ['cole-electric-ball'],
    defensiveIds: ['cole-discharge'],
    escapeIds: [],
    ultSaveUntilFoes: 2,
  },
  death: {
    stance: 'melee',
    preferredRangeMul: 0.74,
    comfortMinMul: 0.35,
    comfortMaxMul: 1.1,
    wantsInitiate: true,
    wantsPoke: true,
    wantsFlank: false,
    wantsProtect: true,
    pressureBias: 0.78,
    setupIds: [],
    defensiveIds: [],
    escapeIds: [],
    ultSaveUntilFoes: 2,
  },
  mender: {
    stance: 'support',
    preferredRangeMul: 0.86,
    comfortMinMul: 0.5,
    comfortMaxMul: 1.18,
    wantsInitiate: false,
    wantsPoke: true,
    wantsFlank: false,
    wantsProtect: true,
    pressureBias: 0.36,
    setupIds: [],
    defensiveIds: ['mender-guardian-angel', 'mender-soul-dash'],
    escapeIds: ['mender-soul-dash'],
    ultSaveUntilFoes: 2,
  },
  demon: {
    stance: 'ranged',
    preferredRangeMul: 0.9,
    comfortMinMul: 0.58,
    comfortMaxMul: 1.2,
    wantsInitiate: false,
    wantsPoke: true,
    wantsFlank: true,
    wantsProtect: false,
    pressureBias: 0.4,
    setupIds: ['demon-hellfire'],
    defensiveIds: ['demon-hellfire', 'demon-hell-bat'],
    escapeIds: ['demon-hell-bat'],
    ultSaveUntilFoes: 9,
  },
};

const stanceFromRole = (role: string, attackRange: number): KitStance => {
  if (role === 'minion' && attackRange > 80) {
    return 'ranged';
  }
  if (role === 'ranged' || role === 'ranged-tank') {
    return 'ranged';
  }
  if (role === 'support') {
    return 'support';
  }
  if (role === 'assassin' || role === 'disruptor') {
    return 'melee';
  }
  if (role === 'frontliner' || role === 'tank') {
    return 'melee';
  }
  if (attackRange >= 160 && role !== 'minion') {
    return 'skirmish';
  }
  return 'melee';
};

export const isRangedLike = (role: string, attackRange: number, stance?: KitStance): boolean => {
  if (stance) {
    return stance === 'ranged' || stance === 'support';
  }
  return role === 'ranged' || role === 'ranged-tank' || role === 'support' || (role === 'minion' && attackRange > 80);
};

export const kitProfileOf = (
  heroId: string,
  role: string,
  attackRange: number,
  live?: KitLiveFlags,
): KitProfile => {
  let override = KIT_OVERRIDES[heroId] ?? {};
  let stance = override.stance ?? stanceFromRole(role, attackRange);
  let preferredMul = override.preferredRangeMul ?? (stance === 'ranged' || stance === 'support' ? 0.88 : 0.7);
  let minMul = override.comfortMinMul ?? (stance === 'ranged' || stance === 'support' ? 0.55 : 0.32);
  let maxMul = override.comfortMaxMul ?? (stance === 'ranged' || stance === 'support' ? 1.18 : 1.08);
  let wantsInitiate = override.wantsInitiate ?? stance === 'melee';
  let wantsPoke = override.wantsPoke ?? (stance === 'ranged' || stance === 'support' || stance === 'skirmish');
  if (heroId === 'rope' && live) {
    if (isRopeDisarmed(heroId, live)) {
      preferredMul = 0.94;
      minMul = 0.62;
      maxMul = 1.12;
      wantsInitiate = false;
      wantsPoke = true;
    } else {
      preferredMul = 0.76;
      minMul = 0.4;
      maxMul = 1.02;
      wantsInitiate = true;
      wantsPoke = true;
    }
  }
  if (heroId === 'shadow' && live && isShadowDry(heroId, live)) {
    preferredMul = 0.84;
    minMul = 0.52;
    maxMul = 1.1;
    wantsInitiate = false;
    wantsPoke = true;
  }
  if (heroId === 'demon' && live) {
    const form = live.demonForm ?? 'little';
    const rage = live.rageRatio ?? 0;
    const left = live.transformLeftMs ?? 0;
    if (form === 'big') {
      stance = 'melee';
      preferredMul = left > 0 && left < 2200 ? 0.78 : 0.68;
      minMul = left > 0 && left < 1800 ? 0.42 : 0.28;
      maxMul = 1.08;
      wantsInitiate = !(left > 0 && left < 1400) && (live.staminaRatio > 0.18);
      wantsPoke = false;
      override = { ...override, pressureBias: left < 1800 ? 0.7 : 0.92, wantsFlank: true, wantsProtect: true };
    } else {
      stance = 'ranged';
      wantsInitiate = false;
      wantsPoke = true;
      if (rage > 0.86) {
        preferredMul = 0.96;
        minMul = 0.68;
        maxMul = 1.22;
      } else if (rage > 0.55) {
        preferredMul = 0.92;
        minMul = 0.62;
        maxMul = 1.2;
      } else {
        preferredMul = 0.9;
        minMul = 0.58;
        maxMul = 1.2;
      }
      if (live.staminaRatio < 0.22 || form === 'transforming') {
        preferredMul = Math.max(preferredMul, 0.98);
        minMul = Math.max(minMul, 0.7);
      }
    }
  }
  return {
    heroId,
    stance,
    preferredRange: attackRange * preferredMul,
    comfortMin: attackRange * minMul,
    comfortMax: attackRange * maxMul,
    wantsInitiate,
    wantsPoke,
    wantsFlank: override.wantsFlank ?? (role === 'assassin' || role === 'disruptor'),
    wantsProtect: override.wantsProtect ?? (role === 'support' || role === 'tank' || role === 'ranged-tank'),
    pressureBias:
      override.pressureBias ??
      (stance === 'melee' ? 0.8 : stance === 'skirmish' ? 0.64 : stance === 'support' ? 0.38 : 0.44),
    setupIds: override.setupIds ?? [],
    defensiveIds: override.defensiveIds ?? [],
    escapeIds: override.escapeIds ?? [],
    ultSaveUntilFoes: override.ultSaveUntilFoes ?? 2,
  };
};
