import type { CombatIdentity } from './combatIdentity';
import type { Personality } from './types';

/**
 * What the fighter is trying to do in the next moment.
 * Sits on top of TacticalMind. It does not replace the strategic plan.
 */
export type CombatPose =
  | 'APPROACH'
  | 'ENGAGE'
  | 'PRESSURE'
  | 'PUNISH'
  | 'DEFEND'
  | 'BAIT'
  | 'DISENGAGE'
  | 'CHASE'
  | 'RESET'
  | 'FINISH'
  | 'PEEL';

export type FightFlag =
  | 'OPENING'
  | 'TARGET_ATTACKING'
  | 'TARGET_RECOVERING'
  | 'TARGET_BLOCKING'
  | 'TARGET_LOW_STAMINA'
  | 'TARGET_LOW_HP'
  | 'TARGET_ISOLATED'
  | 'TARGET_SUPPORTED'
  | 'TARGET_ESCAPING'
  | 'SELF_VULNERABLE'
  | 'SELF_LOW_STAMINA'
  | 'ALLY_IN_DANGER'
  | 'ABILITY_THREAT'
  | 'PUNISH_WINDOW'
  | 'BAD_ENGAGEMENT'
  | 'GOOD_ENGAGEMENT';

export type SwingReason =
  | 'punish'
  | 'pressure'
  | 'poke'
  | 'combo'
  | 'finish'
  | 'interrupt'
  | 'shield-pressure'
  | 'protect'
  | 'force-reaction'
  | 'punish-recovery'
  | 'create-space'
  | 'hold';

/** How to treat an opponent who is using their shield. */
export type ShieldPlan = 'hold' | 'pressure' | 'bait' | 'break' | 'punish' | 'dash-around' | 'reset';

export type HabitKind =
  | 'attack-on-approach'
  | 'finisher'
  | 'attack-after-dash'
  | 'attack-after-hit'
  | 'same-ability'
  | 'shield-after-hit'
  | 'shield-low-hp'
  | 'dash-back'
  | 'retreat-dir'
  | 'favor-side'
  | 'retreat-direct'
  | 'chase-direct';

export type HabitRead = {
  attackOnApproach: number;
  finisher: number;
  shieldAfterHit: number;
  dashBack: number;
  sameAbility: number;
};

export const EMPTY_HABITS: HabitRead = {
  attackOnApproach: 0,
  finisher: 0,
  shieldAfterHit: 0,
  dashBack: 0,
  sameAbility: 0,
};

/** Plain fight facts. Callers fill one reused object. */
export type FightSample = {
  dist: number;
  selfRange: number;
  foeRange: number;
  closing: number;
  foeAttacking: boolean;
  foeStartup: boolean;
  foeActive: boolean;
  foeRecoveryMs: number;
  foeHitReactMs: number;
  foeBlocking: boolean;
  foeShield: number;
  foeStamina: number;
  foeDash: number;
  foeRecentDash: boolean;
  foeRecentAbility: boolean;
  foeWhiff: boolean;
  foeRecentHit: boolean;
  foeHp: number;
  foeAlliesNear: number;
  foePressured: boolean;
  selfHp: number;
  selfStamina: number;
  selfBlocking: boolean;
  selfDash: number;
  selfAbilityReady: boolean;
  selfRecovering: boolean;
  alliesNear: number;
  enemiesNear: number;
  allyDanger: boolean;
  allyCritical: boolean;
  knock: 'none' | 'self-far' | 'foe-far' | 'foe-isolated' | 'foe-react';
};

export type PoseRead = {
  pose: CombatPose;
  until: number;
  reason: string;
  punishConfidence: number;
  punishTake: boolean;
  shield: ShieldPlan;
  swing: SwingReason;
  flagText: string;
};

export const blankPose = (): PoseRead => ({
  pose: 'APPROACH',
  until: 0,
  reason: 'spawn',
  punishConfidence: 0,
  punishTake: false,
  shield: 'reset',
  swing: 'hold',
  flagText: '',
});

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export const habitBand = (confidence: number): 'low' | 'medium' | 'high' => {
  if (confidence >= 0.68) {
    return 'high';
  }
  if (confidence >= 0.38) {
    return 'medium';
  }
  return 'low';
};

/** Confidence grows with repeats and falls when the behavior stops. */
export const habitConfidence = (hits: number, misses: number, ageMs: number): number => {
  const seen = hits + misses;
  if (seen <= 0) {
    return 0;
  }
  const rate = hits / seen;
  const volume = clamp(hits / 5, 0, 1);
  const decay = ageMs <= 900 ? 1 : ageMs >= 6400 ? 0.2 : 1 - (ageMs - 900) / 7000;
  return clamp(rate * volume * decay, 0, 1);
};

export const classifyFlags = (sample: FightSample, out: FightFlag[]): number => {
  out.length = 0;
  const push = (flag: FightFlag): void => {
    out.push(flag);
  };
  if (sample.dist > sample.selfRange * 1.2 && !sample.foeActive) {
    push('OPENING');
  }
  if (sample.foeStartup || sample.foeActive) {
    push('TARGET_ATTACKING');
  }
  if (sample.foeRecoveryMs > 45 || sample.foeWhiff) {
    push('TARGET_RECOVERING');
  }
  if (sample.foeBlocking) {
    push('TARGET_BLOCKING');
  }
  if (sample.foeStamina < 0.22) {
    push('TARGET_LOW_STAMINA');
  }
  if (sample.foeHp < 0.3) {
    push('TARGET_LOW_HP');
  }
  if (sample.foeAlliesNear <= 0) {
    push('TARGET_ISOLATED');
  } else {
    push('TARGET_SUPPORTED');
  }
  if (sample.closing < -0.34 && sample.dist > sample.selfRange * 0.9) {
    push('TARGET_ESCAPING');
  }
  if (sample.selfHp < 0.34 || sample.selfRecovering) {
    push('SELF_VULNERABLE');
  }
  if (sample.selfStamina < 0.22) {
    push('SELF_LOW_STAMINA');
  }
  if (sample.allyDanger) {
    push('ALLY_IN_DANGER');
  }
  if (sample.foeRecentAbility && sample.dist < sample.foeRange * 1.35) {
    push('ABILITY_THREAT');
  }
  if (punishSignals(sample) > 0) {
    push('PUNISH_WINDOW');
  }
  const outnumbered = sample.enemiesNear > sample.alliesNear + 0.5 && sample.selfHp < sample.foeHp - 0.08;
  if (outnumbered || (sample.selfHp < 0.28 && sample.foeHp > 0.45 && sample.enemiesNear >= 1)) {
    push('BAD_ENGAGEMENT');
  }
  if (
    (sample.foeHp < sample.selfHp - 0.08 && sample.foeAlliesNear <= 0) ||
    (sample.foeRecoveryMs > 80 && sample.selfHp > 0.35)
  ) {
    push('GOOD_ENGAGEMENT');
  }
  return out.length;
};

const punishSignals = (sample: FightSample): number => {
  let n = 0;
  if (sample.foeWhiff) {
    n += 2;
  }
  if (sample.foeRecoveryMs > 70) {
    n += 1;
  }
  if (sample.foeHitReactMs > 90) {
    n += 2;
  }
  if (sample.foeShield < 0.1 && !sample.foeBlocking) {
    n += 1;
  }
  if (sample.foeStamina < 0.12) {
    n += 1;
  }
  if (sample.foeRecentDash && sample.foeRecoveryMs > 40) {
    n += 1;
  }
  if (sample.foeRecentAbility && sample.foeRecoveryMs > 60) {
    n += 1;
  }
  if (sample.knock === 'foe-react' || sample.knock === 'foe-isolated') {
    n += 1;
  }
  if (sample.foePressured && sample.foeBlocking && sample.foeShield < 0.55) {
    n += 1;
  }
  return n;
};

export const punishRead = (
  sample: FightSample,
  personality: Personality,
  rng: () => number,
  habits: HabitRead = EMPTY_HABITS,
): { open: boolean; confidence: number; take: boolean } => {
  const signals = punishSignals(sample);
  if (signals <= 0) {
    return { open: false, confidence: 0, take: false };
  }
  const confidence = clamp(0.28 + signals * 0.16, 0, 0.94);
  let notice =
    (0.18 + personality.reactionQuality * 0.66) *
    confidence *
    (0.72 + personality.opportunism * 0.28);
  if (sample.foeRecoveryMs > 120) {
    notice += habits.finisher * 0.24;
  }
  if (sample.foeStartup && sample.closing > 0.25) {
    notice += habits.attackOnApproach * 0.18;
  }
  const take = rng() < clamp(notice, 0, 0.9);
  return { open: true, confidence, take };
};

export const shieldPlanOf = (sample: FightSample, personality: Personality, habits: HabitRead): ShieldPlan => {
  const facingAway = sample.closing < -0.28 && sample.foeBlocking && sample.dist < sample.foeRange * 1.25;
  if (!sample.foeBlocking) {
    if (sample.foeShield < 0.22 && (sample.foeRecoveryMs > 40 || sample.foeRecentHit)) {
      return 'punish';
    }
    if (habits.shieldAfterHit >= 0.38 && sample.foeRecentHit) {
      return 'bait';
    }
    return 'reset';
  }
  if (facingAway && personality.flankTendency > 0.4) {
    return 'dash-around';
  }
  if (sample.foeShield < 0.4 || (sample.foePressured && sample.foeShield < 0.62)) {
    return sample.selfStamina > 0.2 ? 'break' : 'reset';
  }
  if (habits.shieldAfterHit >= 0.5 || personality.patience > 0.62) {
    return 'bait';
  }
  if (personality.aggression > 0.58 && sample.selfStamina > 0.3) {
    return 'pressure';
  }
  if (sample.selfStamina < 0.22) {
    return 'reset';
  }
  return 'hold';
};

const poseRank = (pose: CombatPose): number => {
  switch (pose) {
    case 'DEFEND':
      return 9;
    case 'PUNISH':
      return 8;
    case 'PEEL':
      return 7;
    case 'FINISH':
      return 6;
    case 'DISENGAGE':
      return 5;
    case 'PRESSURE':
    case 'BAIT':
    case 'CHASE':
      return 4;
    case 'ENGAGE':
    case 'RESET':
      return 3;
    default:
      return 2;
  }
};

/**
 * Pick a combat intent. Keeps the previous pose until its window ends
 * unless something more urgent shows up.
 */
export const pickPose = (args: {
  now: number;
  sample: FightSample;
  personality: Personality;
  identity: CombatIdentity;
  habits: HabitRead;
  previous: PoseRead;
  rng: () => number;
  out: PoseRead;
  flags: FightFlag[];
}): PoseRead => {
  const { now, sample, personality, identity, habits, previous, rng, out, flags } = args;
  const prevPose = previous.pose;
  const prevUntil = previous.until;
  const prevSwing = previous.swing;
  const prevTake = previous.punishTake;
  const prevConf = previous.punishConfidence;
  const prevReason = previous.reason;
  classifyFlags(sample, flags);
  const punish = punishRead(sample, personality, rng, habits);
  const shield = shieldPlanOf(sample, personality, habits);
  const inRange = sample.dist <= sample.selfRange * 1.12;
  const scores: Array<{ pose: CombatPose; score: number; reason: string }> = [];
  const add = (pose: CombatPose, score: number, reason: string): void => {
    scores.push({ pose, score, reason });
  };

  if (sample.selfRecovering && sample.foeActive && sample.dist < sample.foeRange * 1.2) {
    add('DEFEND', 80 + personality.caution * 12, 'under attack');
  } else if (sample.selfHp < 0.36 && sample.foeActive && sample.dist < sample.foeRange * 1.15) {
    add('DEFEND', 48 + personality.caution * 28 - identity.trade * 18 - personality.bravery * 10, 'incoming threat');
  } else if (flags.includes('ABILITY_THREAT') && sample.selfHp < 0.42) {
    add('DEFEND', 40 + personality.caution * 16 - identity.trade * 10, 'ability threat');
  }
  if (punish.open) {
    const takeBoost = punish.take ? 28 : -6;
    add(
      'PUNISH',
      36 + punish.confidence * 34 + personality.opportunism * 8 + identity.burst * 6 + takeBoost,
      punish.take ? 'punish window' : 'saw window',
    );
  }
  if (sample.allyDanger) {
    const peel =
      identity.peel * 44 +
      personality.teamwork * 24 +
      personality.protectionInstinct * 14 +
      (sample.allyCritical ? 24 : 0);
    if (peel > 32) {
      add('PEEL', peel, sample.allyCritical ? 'ally critical' : 'ally pressed');
    }
  }
  if (sample.foeHp < 0.28 && sample.foeAlliesNear <= 0 && sample.selfHp > 0.22) {
    add('FINISH', 40 + (0.28 - sample.foeHp) * 80 + personality.aggression * 8 + identity.commit * 4, 'isolated low hp');
  }
  if (shield === 'bait' || shield === 'hold') {
    add('BAIT', 24 + personality.patience * 22 + habits.shieldAfterHit * 18 - personality.aggression * 8, 'shield mind game');
  }
  if (shield === 'pressure' || shield === 'break') {
    add('PRESSURE', 30 + personality.aggression * 14 + identity.trade * 8 + (shield === 'break' ? 10 : 0), 'shield pressure');
  }
  if (flags.includes('BAD_ENGAGEMENT') || sample.selfStamina < 0.16 || sample.knock === 'self-far') {
    add(
      'DISENGAGE',
      28 + personality.caution * 16 + personality.retreatWillingness * 12 + identity.rangeKeep * 6 - identity.trade * 14,
      sample.selfStamina < 0.16 ? 'low stamina' : 'bad engagement',
    );
  }
  if (flags.includes('TARGET_ESCAPING') && sample.foeHp < 0.55 && !flags.includes('BAD_ENGAGEMENT')) {
    add('CHASE', 26 + personality.aggression * 12 + identity.mobility * 8 - identity.burst * 10, 'target leaving');
  }
  if (sample.knock === 'foe-far' && sample.foeHp > 0.35) {
    add('RESET', 32 + personality.patience * 8 + identity.burst * 6, 'knocked out');
  } else if (sample.knock === 'foe-isolated') {
    add('CHASE', 30 + identity.mobility * 8, 'isolated by knockback');
  }
  if (!inRange) {
    add('APPROACH', 22 + identity.mobility * 6 + (flags.includes('OPENING') ? 8 : 0) - identity.rangeKeep * 4, 'closing distance');
  } else if (!punish.open && shield !== 'bait') {
    add('ENGAGE', 20 + identity.commit * 8 + personality.aggression * 6, 'in range');
    add('PRESSURE', 16 + identity.trade * 10 + (sample.foeStamina < 0.28 ? 8 : 0), 'sustain');
  }
  if (inRange && identity.rangeKeep > 0.6 && sample.dist < sample.selfRange * 0.62 && identity.trade < 0.45) {
    add('RESET', 34 + identity.rangeKeep * 14 - identity.trade * 8, 'too close');
  }
  if (inRange && identity.trade > 0.75 && sample.selfStamina > 0.25 && !flags.includes('BAD_ENGAGEMENT')) {
    add('PRESSURE', 36 + identity.trade * 12 + personality.aggression * 6, 'frontline trade');
  }
  if (habits.attackOnApproach >= 0.5 && sample.closing > 0.3 && !inRange) {
    add('BAIT', 22 + habits.attackOnApproach * 16 + personality.patience * 8, 'expect approach swing');
  }

  let best = scores[0] ?? { pose: 'APPROACH' as CombatPose, score: 1, reason: 'default' };
  for (const item of scores) {
    if (item.score > best.score) {
      best = item;
    }
  }

  const committed = now < prevUntil && prevPose !== 'APPROACH';
  const urgent = poseRank(best.pose) >= 8 || (best.pose === 'PEEL' && sample.allyCritical) || (best.pose === 'FINISH' && sample.foeHp < 0.16);
  const kept = committed && !urgent && poseRank(best.pose) <= poseRank(prevPose) + 1;
  if (kept) {
    best = { pose: prevPose, score: best.score, reason: prevReason };
  }

  const swing = kept
    ? prevSwing
    : swingReasonOf(best.pose, sample, personality, identity, shield, punish.take, habits);
  const holdMs = 320 + personality.decisionConfidence * 180 + (best.pose === 'BAIT' ? 140 : 0);
  out.pose = best.pose;
  out.until = kept ? prevUntil : now + holdMs;
  out.reason = best.reason;
  out.punishConfidence = kept ? Math.max(prevConf, punish.confidence) : punish.confidence;
  out.punishTake = kept ? prevTake : punish.take;
  out.shield = shield;
  out.swing = swing;
  out.flagText = flags.join(',');
  return out;
};

export const swingReasonOf = (
  pose: CombatPose,
  sample: FightSample,
  personality: Personality,
  identity: CombatIdentity,
  shield: ShieldPlan,
  punishTake: boolean,
  habits: HabitRead,
): SwingReason => {
  const inRange = sample.dist <= sample.selfRange * 1.14;
  if (sample.selfStamina < 0.14 && pose !== 'FINISH' && !(pose === 'PUNISH' && punishTake && sample.foeHp < 0.2)) {
    return 'hold';
  }
  if (pose === 'BAIT' || pose === 'RESET' || pose === 'DISENGAGE' || pose === 'APPROACH') {
    return 'hold';
  }
  if (pose === 'DEFEND') {
    return sample.foeRecoveryMs > 80 && personality.aggression > 0.6 ? 'interrupt' : 'hold';
  }
  if (!punishTake && pose === 'PUNISH') {
    return 'hold';
  }
  if ((shield === 'bait' || shield === 'hold') && pose !== 'PUNISH' && pose !== 'FINISH' && pose !== 'PEEL') {
    return 'hold';
  }
  if (shield === 'reset' && sample.foeBlocking && pose !== 'PUNISH' && pose !== 'FINISH') {
    return 'hold';
  }
  if (sample.foeActive && sample.dist < sample.foeRange * 1.05 && personality.reactionQuality < 0.75 && pose !== 'PUNISH') {
    return 'hold';
  }
  if (!inRange && pose !== 'CHASE') {
    return 'hold';
  }
  if (pose === 'PUNISH') {
    return sample.foeRecoveryMs > 50 || sample.foeWhiff ? 'punish-recovery' : 'punish';
  }
  if (pose === 'FINISH') {
    return 'finish';
  }
  if (pose === 'PEEL') {
    return 'protect';
  }
  if (shield === 'pressure' || shield === 'break') {
    return 'shield-pressure';
  }
  if (pose === 'PRESSURE') {
    return habits.finisher >= 0.55 ? 'force-reaction' : identity.commit > 0.6 ? 'combo' : 'pressure';
  }
  if (pose === 'CHASE') {
    return inRange ? 'pressure' : 'hold';
  }
  if (pose === 'ENGAGE') {
    return identity.rangeKeep > 0.6 ? 'poke' : 'pressure';
  }
  if (identity.rangeKeep > 0.7) {
    return 'create-space';
  }
  return 'poke';
};

export type RetargetOffer = {
  currentScore: number;
  nextScore: number;
  msSinceSwitch: number;
  currentPunish: boolean;
  nextPunish: boolean;
  nextFinish: boolean;
  nextProtected: boolean;
  allyNeedsPeel: boolean;
};

/** True when a new target is clearly better and the fighter has stayed long enough. */
export const shouldSwitchTarget = (offer: RetargetOffer, personality: Personality): boolean => {
  const cooldown = 780 + (1 - personality.reactionQuality) * 420 + personality.targetFixation * 380;
  if (offer.msSinceSwitch < cooldown) {
    return false;
  }
  let need = 8 + personality.targetFixation * 10;
  if (offer.nextPunish && !offer.currentPunish) {
    need -= 4;
  }
  if (offer.nextFinish) {
    need -= 3;
  }
  if (offer.allyNeedsPeel) {
    need -= 5;
  }
  if (offer.nextProtected) {
    need += 6;
  }
  if (offer.currentPunish && !offer.nextPunish) {
    need += 8;
  }
  return offer.nextScore > offer.currentScore + need;
};

export const poseAbilityNudge = (
  pose: CombatPose | undefined,
  tags: { damage?: boolean; burst?: boolean; finish?: boolean; peel?: boolean; escape?: boolean; defense?: boolean },
): number => {
  if (!pose) {
    return 0;
  }
  const offense = Boolean(tags.damage || tags.burst || tags.finish);
  if (pose === 'PUNISH' && (tags.burst || tags.finish)) {
    return 9;
  }
  if (pose === 'FINISH' && (tags.finish || tags.burst)) {
    return 11;
  }
  if (pose === 'PEEL' && (tags.peel || tags.defense)) {
    return 12;
  }
  if (pose === 'DISENGAGE' && tags.escape) {
    return 14;
  }
  if ((pose === 'DISENGAGE' || pose === 'BAIT' || pose === 'RESET') && offense) {
    return -12;
  }
  if (pose === 'PRESSURE' && tags.damage && !tags.finish) {
    return 4;
  }
  if (pose === 'DEFEND' && (tags.defense || tags.escape)) {
    return 8;
  }
  return 0;
};
