import type { StatGrowthKey } from '../../config/match';
import { OBJECTIVE, type ObjectiveKind } from '../../config/objective';
import { objectiveScoreLine } from '../../config/score';
import type { LevelGrant } from '../../match/Progression';

export type StatusChipInfo = {
  key: string;
  text: string;
  buff: boolean;
};

export type ObjectiveRewardView = {
  title: string;
  lines: string[];
};

const STAT_LABEL: Record<StatGrowthKey, string> = {
  maxHealth: 'MAX HEALTH',
  attackDamage: 'ATTACK DAMAGE',
  defense: 'DEFENSE',
};

/** `0.8` → `-20`, `1.3` → `+30`. */
export const signedPercent = (mul: number): number => Math.round((mul - 1) * 100);

/** Cooldown 1.3× means attacks are 30% slower → `-30`. */
export const cooldownPercent = (mul: number): number => -Math.round((mul - 1) * 100);

export const formatSignedStat = (pct: number, label: string): string | undefined => {
  if (!pct) {
    return undefined;
  }
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% ${label}`;
};

export const formatMulStat = (mul: number, label: string): string | undefined =>
  formatSignedStat(signedPercent(mul), label);

export const formatCooldownStat = (mul: number, label: string): string | undefined =>
  formatSignedStat(cooldownPercent(mul), label);

export const formatLevelAmount = (amount: number): string => {
  if (Number.isInteger(amount)) {
    return `${amount}`;
  }
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
};

export const formatLevelGrant = (grant: LevelGrant): { headline: string; level: string; stat: string } => ({
  headline: 'LEVEL UP!',
  level: `LEVEL ${grant.level}`,
  stat: `+${formatLevelAmount(grant.amount)} ${STAT_LABEL[grant.stat]}`,
});

const TITLE: Record<ObjectiveKind, string> = {
  capture_zone: 'OBJECTIVE COMPLETE!',
  golden_piggy: 'OBJECTIVE COMPLETE!',
  bounty_target: 'OBJECTIVE COMPLETE!',
  healing_shrine: 'OBJECTIVE COMPLETE!',
  executioner: 'OBJECTIVE COMPLETE!',
  war_banner: 'OBJECTIVE COMPLETE!',
  rage_zone: 'OBJECTIVE COMPLETE!',
  meteor_storm: 'OBJECTIVE COMPLETE!',
};

export type ObjectiveRewardContext = {
  kind: ObjectiveKind;
  winner?: 'alpha' | 'bravo';
  assassinBonus?: boolean;
};

const xpShareLine = (fraction: number): string => `+${Math.round(fraction * 100)}% LEVEL XP`;

export const describeObjectiveRewards = (ctx: ObjectiveRewardContext): ObjectiveRewardView => {
  const lines: string[] = [];
  switch (ctx.kind) {
    case 'capture_zone': {
      const score = objectiveScoreLine(ctx.kind);
      if (score) {
        lines.push(score);
      }
      lines.push(xpShareLine(OBJECTIVE.capture.xpShare));
      const spd = formatMulStat(OBJECTIVE.capture.moveMul, 'SPD');
      if (spd) {
        lines.push(`${spd}  10s`);
      }
      break;
    }
    case 'golden_piggy': {
      const score = objectiveScoreLine(ctx.kind);
      if (score) {
        lines.push(score);
      }
      lines.push(xpShareLine(OBJECTIVE.piggy.xpShare));
      break;
    }
    case 'bounty_target': {
      const score = objectiveScoreLine(ctx.kind);
      if (score) {
        lines.push(score);
      }
      lines.push(`+${OBJECTIVE.bounty.levelReward} LEVEL`);
      break;
    }
    case 'healing_shrine':
      lines.push(`HEAL ${OBJECTIVE.shrine.healPerSecond}/S WHILE HELD`);
      break;
    case 'executioner': {
      const score = objectiveScoreLine(ctx.kind);
      if (score) {
        lines.push(score);
      }
      const spd = formatMulStat(OBJECTIVE.executioner.moveMul, 'SPD');
      const atk = formatMulStat(OBJECTIVE.executioner.attackMul, 'ATK SPD');
      const stam = formatMulStat(OBJECTIVE.executioner.staminaMul, 'STAM');
      if (spd) {
        lines.push(spd);
      }
      if (atk) {
        lines.push(atk);
      }
      if (stam) {
        lines.push(stam);
      }
      lines.push(xpShareLine(OBJECTIVE.executioner.xpShare));
      break;
    }
    case 'war_banner': {
      const score = objectiveScoreLine(ctx.kind);
      if (score) {
        lines.push(score);
      }
      lines.push(xpShareLine(OBJECTIVE.banner.xpShare));
      break;
    }
    case 'rage_zone':
    case 'meteor_storm':
      break;
  }
  return { title: TITLE[ctx.kind], lines };
};

const magnitude = (text: string): number => {
  const match = text.match(/-?\d+/);
  return match ? Math.abs(Number(match[0])) : 0;
};

/** Cap visible chips and drop duplicate copy from overlapping sources. */
export const selectStatusChips = (mods: StatusChipInfo[], max = 3): StatusChipInfo[] => {
  const unique: StatusChipInfo[] = [];
  const seen = new Set<string>();
  for (const mod of mods) {
    if (seen.has(mod.text)) {
      continue;
    }
    seen.add(mod.text);
    unique.push(mod);
  }
  if (unique.length <= max) {
    return unique;
  }
  return [...unique].sort((a, b) => magnitude(b.text) - magnitude(a.text)).slice(0, max);
};
