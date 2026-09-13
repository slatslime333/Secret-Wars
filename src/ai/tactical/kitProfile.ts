import type { KitProfile, KitStance } from './types';

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
    setupIds: [],
    defensiveIds: [],
    escapeIds: [],
    ultSaveUntilFoes: 2,
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

export const kitProfileOf = (heroId: string, role: string, attackRange: number): KitProfile => {
  const override = KIT_OVERRIDES[heroId] ?? {};
  const stance = override.stance ?? stanceFromRole(role, attackRange);
  const preferredMul = override.preferredRangeMul ?? (stance === 'ranged' || stance === 'support' ? 0.88 : 0.7);
  const minMul = override.comfortMinMul ?? (stance === 'ranged' || stance === 'support' ? 0.55 : 0.32);
  const maxMul = override.comfortMaxMul ?? (stance === 'ranged' || stance === 'support' ? 1.18 : 1.08);
  return {
    heroId,
    stance,
    preferredRange: attackRange * preferredMul,
    comfortMin: attackRange * minMul,
    comfortMax: attackRange * maxMul,
    wantsInitiate: override.wantsInitiate ?? (stance === 'melee'),
    wantsPoke: override.wantsPoke ?? (stance === 'ranged' || stance === 'support' || stance === 'skirmish'),
    wantsFlank: override.wantsFlank ?? (role === 'assassin' || role === 'disruptor'),
    wantsProtect: override.wantsProtect ?? (role === 'support' || role === 'tank' || role === 'ranged-tank'),
    setupIds: override.setupIds ?? [],
    defensiveIds: override.defensiveIds ?? [],
    escapeIds: override.escapeIds ?? [],
    ultSaveUntilFoes: override.ultSaveUntilFoes ?? 2,
  };
};
