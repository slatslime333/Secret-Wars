import { CombatStatus } from '../../combat/CombatStatus';
import { MATCH } from '../../config/match';
import { OBJECTIVE } from '../../config/objective';
import {
  describeObjectiveRewards,
  formatCooldownStat,
  formatLevelGrant,
  formatMulStat,
  selectStatusChips,
} from './format';

export type FeedbackCheck = { name: string; ok: boolean; detail: string };

const check = (name: string, ok: boolean, detail: string): FeedbackCheck => ({ name, ok, detail });

const scenarioCopy = (): FeedbackCheck[] => {
  const slow = formatMulStat(0.8, 'SPD');
  const haste = formatMulStat(1.2, 'SPD');
  const atkSlow = formatCooldownStat(1.3, 'ATK SPD');
  const atkHaste = formatMulStat(1.3, 'ATK SPD');
  const health = formatLevelGrant({
    level: 2,
    stat: 'maxHealth',
    amount: MATCH.growth.perLevel.maxHealth,
  });
  const defense = formatLevelGrant({
    level: 4,
    stat: 'defense',
    amount: MATCH.growth.perLevel.defense,
  });
  const damage = formatLevelGrant({
    level: 3,
    stat: 'attackDamage',
    amount: MATCH.growth.perLevel.attackDamage,
  });
  const piggy = describeObjectiveRewards({ kind: 'golden_piggy' });
  const bounty = describeObjectiveRewards({ kind: 'bounty_target', assassinBonus: true });
  const capture = describeObjectiveRewards({ kind: 'capture_zone' });
  const exec = describeObjectiveRewards({ kind: 'executioner' });
  const shrine = describeObjectiveRewards({ kind: 'healing_shrine' });
  return [
    check('speed multiplier copy', slow === '-20% SPD' && haste === '+20% SPD', `${slow} / ${haste}`),
    check(
      'attack-speed multiplier copy',
      atkSlow === '-30% ATK SPD' && atkHaste === '+30% ATK SPD',
      `${atkSlow} / ${atkHaste}`,
    ),
    check(
      'level-up copy uses growth table',
      health.level === 'LEVEL 2' &&
        health.stat === `+${MATCH.growth.perLevel.maxHealth} MAX HEALTH` &&
        defense.level === 'LEVEL 4' &&
        defense.stat === `+${MATCH.growth.perLevel.defense} DEFENSE` &&
        damage.stat === `+${MATCH.growth.perLevel.attackDamage} ATTACK DAMAGE`,
      `${health.stat} / ${damage.stat} / ${defense.stat}`,
    ),
    check(
      'objective rewards use live tunables',
      piggy.lines.includes('+1 LEVEL') &&
        piggy.lines.includes(`+${OBJECTIVE.scoreReward} SCORE`) &&
        capture.lines.includes('+1 LEVEL') &&
        bounty.lines.includes(`+${OBJECTIVE.bounty.levelReward} LEVELS`) &&
        bounty.lines.includes('+30% SPD') &&
        exec.lines.includes('+18% SPD') &&
        shrine.lines.some((line) => line.includes(`${OBJECTIVE.shrine.healPerSecond}`)),
      `piggy=${piggy.lines.join(',')} bounty=${bounty.lines.join(',')}`,
    ),
  ];
};

const scenarioLiveStatus = (): FeedbackCheck[] => {
  const status = new CombatStatus();
  status.applySlow(0, 800, 0.8);
  const slowed = status.playerFacingMods(100);
  const expired = status.playerFacingMods(900);
  status.applyHasteBuff(1_000, 800, 1.2, 1.3);
  const hasted = status.playerFacingMods(1_100);
  status.applyAttackSpeedSlow(2_000, 800, 1.3);
  const asSlow = status.playerFacingMods(2_100);
  status.applyDefenseBuff(3_000, 800, 1.25);
  const def = status.playerFacingMods(3_100);
  status.applySlow(4_000, 800, 0.8);
  status.applySlow(4_100, 800, 0.8);
  const refreshed = status.playerFacingMods(4_200);
  status.setZoneModifiers({ moveMul: 0.8, attackSpeedMul: 1, staminaDrainMul: 1 });
  const overlap = selectStatusChips(status.playerFacingMods(4_200));
  status.clearZoneModifiers();
  return [
    check(
      'slow chip from live status',
      slowed.some((chip) => chip.text === '-20% SPD' && !chip.buff) && expired.length === 0,
      slowed.map((chip) => chip.text).join(',') || 'empty',
    ),
    check(
      'haste chips from live status',
      hasted.some((chip) => chip.text === '+20% SPD' && chip.buff) &&
        hasted.some((chip) => chip.text === '+30% ATK SPD' && chip.buff),
      hasted.map((chip) => chip.text).join(','),
    ),
    check(
      'attack-speed slow chip from live status',
      asSlow.some((chip) => chip.text === '-30% ATK SPD' && !chip.buff),
      asSlow.map((chip) => chip.text).join(','),
    ),
    check(
      'defense chip from live status',
      def.some((chip) => chip.text === '+25% DEF' && chip.buff),
      def.map((chip) => chip.text).join(','),
    ),
    check(
      'refreshed slow stays one chip',
      refreshed.filter((chip) => chip.key === 'slow').length === 1,
      refreshed.map((chip) => `${chip.key}:${chip.text}`).join(','),
    ),
    check(
      'duplicate copy does not stack',
      overlap.filter((chip) => chip.text === '-20% SPD').length === 1,
      overlap.map((chip) => chip.text).join(','),
    ),
  ];
};

const scenarioGrowthCycle = (): FeedbackCheck => {
  const order = MATCH.growth.order;
  const ok =
    order[0] === 'maxHealth' &&
    order[1] === 'attackDamage' &&
    order[2] === 'defense' &&
    MATCH.growth.perLevel.maxHealth === 6 &&
    MATCH.growth.perLevel.attackDamage === 1.2 &&
    MATCH.growth.perLevel.defense === 1.4 &&
    MATCH.xp.maxLevel === 10;
  return check(
    'progression cycle unchanged',
    ok,
    `order=${order.join('→')} hp=${MATCH.growth.perLevel.maxHealth} dmg=${MATCH.growth.perLevel.attackDamage} def=${MATCH.growth.perLevel.defense}`,
  );
};

export const runCombatFeedbackChecks = (): FeedbackCheck[] => [
  ...scenarioCopy(),
  ...scenarioLiveStatus(),
  scenarioGrowthCycle(),
];
