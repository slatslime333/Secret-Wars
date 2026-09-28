import { combatIdentityOf } from './combatIdentity';
import {
  blankPose,
  classifyFlags,
  habitBand,
  habitConfidence,
  pickPose,
  punishRead,
  shieldPlanOf,
  shouldSwitchTarget,
  type FightFlag,
  type FightSample,
  type HabitRead,
  type PoseRead,
} from './combatPose';
import { formationLaneOf } from './spacing';
import { NEUTRAL_PERSONALITY, type Personality } from './types';

const failures: string[] = [];

const check = (name: string, ok: boolean, detail = ''): void => {
  if (!ok) {
    failures.push(`${name}${detail ? ` (${detail})` : ''}`);
    console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`);
    return;
  }
  console.log(`ok   ${name}`);
};

const mulberry = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const persona = (patch: Partial<Personality>): Personality => ({ ...NEUTRAL_PERSONALITY, ...patch });

const sample = (patch: Partial<FightSample>): FightSample => ({
  dist: 90,
  selfRange: 100,
  foeRange: 100,
  closing: 0,
  foeAttacking: false,
  foeStartup: false,
  foeActive: false,
  foeRecoveryMs: 0,
  foeHitReactMs: 0,
  foeBlocking: false,
  foeShield: 1,
  foeStamina: 0.8,
  foeDash: 2,
  foeRecentDash: false,
  foeRecentAbility: false,
  foeWhiff: false,
  foeRecentHit: false,
  foeHp: 0.8,
  foeAlliesNear: 0,
  foePressured: false,
  selfHp: 0.8,
  selfStamina: 0.8,
  selfBlocking: false,
  selfDash: 2,
  selfAbilityReady: true,
  selfRecovering: false,
  alliesNear: 1,
  enemiesNear: 1,
  allyDanger: false,
  allyCritical: false,
  knock: 'none',
  ...patch,
});

const habits = (patch: Partial<HabitRead> = {}): HabitRead => ({
  attackOnApproach: 0,
  finisher: 0,
  shieldAfterHit: 0,
  dashBack: 0,
  sameAbility: 0,
  ...patch,
});

const poseOf = (fight: FightSample, personality: Personality, identityId: string, habit = habits(), seed = 3): PoseRead => {
  const out = blankPose();
  const flags: FightFlag[] = [];
  return pickPose({
    now: 1000,
    sample: fight,
    personality,
    identity: combatIdentityOf(identityId),
    habits: habit,
    previous: blankPose(),
    rng: mulberry(seed),
    out,
    flags,
  });
};

const rate = (fight: FightSample, personality: Personality, habit = habits(), n = 80): number => {
  const rng = mulberry(11);
  let takes = 0;
  for (let i = 0; i < n; i += 1) {
    if (punishRead(fight, personality, rng, habit).take) {
      takes += 1;
    }
  }
  return takes / n;
};

const approach = sample({
  dist: 150,
  closing: 0.7,
  foeStartup: true,
  foeAttacking: true,
  selfRange: 100,
});
const learned = poseOf(approach, persona({ patience: 0.8, reactionQuality: 0.7 }), 'ninja', habits({ attackOnApproach: 0.72 }), 4);
check('scenario 1 approach habit baits', learned.pose === 'BAIT' || learned.swing === 'hold', learned.pose);

const freshHabit = habitConfidence(1, 0, 200);
const trainedHabit = habitConfidence(5, 1, 200);
check('scenario 1 confidence grows', freshHabit < 0.38 && trainedHabit >= 0.5, `${freshHabit.toFixed(2)} -> ${trainedHabit.toFixed(2)}`);

const afterHit = sample({ foeRecentHit: true, foeBlocking: false, foeShield: 0.8, dist: 80 });
const baitShield = shieldPlanOf(afterHit, persona({ patience: 0.7 }), habits({ shieldAfterHit: 0.7 }));
const pressing = shieldPlanOf(
  sample({ foeBlocking: true, foeShield: 0.32, foePressured: true, selfStamina: 0.6, dist: 70 }),
  persona({ aggression: 0.8, patience: 0.3 }),
  habits(),
);
check('scenario 2 bait after learned shield', baitShield === 'bait', baitShield);
check('scenario 2 pressure a weak shield', pressing === 'break' || pressing === 'pressure', pressing);

const whiff = sample({ foeWhiff: true, foeRecoveryMs: 180, dist: 70, foeHp: 0.7 });
const slow = persona({ reactionQuality: 0.2, opportunism: 0.3 });
const sharp = persona({ reactionQuality: 0.92, opportunism: 0.8 });
const finisherHabit = habits({ finisher: 0.8 });
const slowRate = rate(whiff, slow);
const sharpRate = rate(whiff, sharp, finisherHabit);
check('scenario 3-4 sharp punishes more than slow', sharpRate > slowRate + 0.25, `slow ${slowRate.toFixed(2)} sharp ${sharpRate.toFixed(2)}`);
const flags: FightFlag[] = [];
classifyFlags(whiff, flags);
check('scenario 4 whiff is a punish window', flags.includes('PUNISH_WINDOW') && flags.includes('TARGET_RECOVERING'));

const tired = poseOf(sample({ selfStamina: 0.1, dist: 60, foeHp: 0.7 }), persona({ caution: 0.7 }), 'ninja', habits(), 2);
check('scenario 5 low stamina holds or leaves', tired.swing === 'hold' || tired.pose === 'DISENGAGE', `${tired.pose}/${tired.swing}`);

const finish = poseOf(sample({ foeHp: 0.14, foeAlliesNear: 0, dist: 70, selfHp: 0.7 }), persona({ aggression: 0.6 }), 'cole', habits(), 6);
check('scenario 6 finish isolated low hp', finish.pose === 'FINISH' && finish.swing === 'finish', `${finish.pose}/${finish.swing}`);

const mender = poseOf(
  sample({ allyDanger: true, allyCritical: true, dist: 110, foeHp: 0.7 }),
  persona({ teamwork: 0.9, protectionInstinct: 0.9 }),
  'cole',
  habits(),
  8,
);
const selfish = poseOf(
  sample({ allyDanger: true, allyCritical: false, dist: 70, foeHp: 0.6, selfHp: 0.8 }),
  persona({ teamwork: 0.15, protectionInstinct: 0.15, aggression: 0.8 }),
  'shadow',
  habits(),
  8,
);
check('scenario 7 peeler turns to the ally', mender.pose === 'PEEL', mender.pose);
check('scenario 7 assassin does not always peel', selfish.pose !== 'PEEL', selfish.pose);

const lanes = [1, 2, 3].map((id) =>
  formationLaneOf({
    self: { x: 140, y: 40 * id, id, attackRange: 90, role: 'assassin', hpRatio: 0.9 },
    allies: [1, 2, 3]
      .filter((other) => other !== id)
      .map((other) => ({ x: 140, y: 40 * other, id: other, attackRange: 90, role: 'assassin', kind: 'hero' })),
    focus: { x: 0, y: 80 },
    stance: 'melee',
  }),
);
const frontCount = lanes.filter((lane) => lane === 'front').length;
check('scenario 8 formation is not three fronts', frontCount <= 2 && lanes.some((lane) => lane === 'left' || lane === 'right'), lanes.join(','));

const knocked = poseOf(sample({ knock: 'foe-far', foeHp: 0.6, dist: 220, selfRange: 90 }), persona({ patience: 0.6 }), 'death', habits(), 5);
const isolatedKnock = poseOf(
  sample({ knock: 'foe-isolated', foeHp: 0.4, dist: 160, closing: -0.5 }),
  persona({ aggression: 0.7 }),
  'ninja',
  habits(),
  5,
);
check('scenario 9 far knock resets', knocked.pose === 'RESET', knocked.pose);
check(
  'scenario 9 isolated knock commits',
  isolatedKnock.pose === 'CHASE' || isolatedKnock.pose === 'PUNISH' || isolatedKnock.pose === 'FINISH',
  isolatedKnock.pose,
);

const blocking = sample({ foeBlocking: true, foeShield: 0.8, dist: 70, selfStamina: 0.7 });
const patient = shieldPlanOf(blocking, persona({ patience: 0.85, aggression: 0.3 }), habits());
const bully = shieldPlanOf(
  sample({ foeBlocking: true, foeShield: 0.3, foePressured: true, dist: 70, selfStamina: 0.6 }),
  persona({ patience: 0.2, aggression: 0.85 }),
  habits(),
);
check('scenario 10 patient baits a full shield', patient === 'bait' || patient === 'hold', patient);
check('scenario 10 aggression pressures a low shield', bully === 'break' || bully === 'pressure', bully);

const stale = habitConfidence(5, 1, 7000);
check('scenario 11 confidence decays', habitBand(trainedHabit) !== 'low' && habitBand(stale) === 'low', `${trainedHabit.toFixed(2)} -> ${stale.toFixed(2)}`);

const trade = sample({ dist: 48, selfRange: 100, foeRange: 110, selfHp: 0.62, foeHp: 0.62, selfStamina: 0.55, enemiesNear: 1 });
const witch = poseOf(trade, NEUTRAL_PERSONALITY, 'witch', habits(), 9);
const cole = poseOf(trade, NEUTRAL_PERSONALITY, 'cole', habits(), 9);
check('scenario 12 frontliner and ranged differ', cole.pose === 'PRESSURE' && (witch.pose === 'RESET' || witch.pose === 'DISENGAGE'), `witch ${witch.pose} cole ${cole.pose}`);

const brave = poseOf(sample({ selfHp: 0.31, foeActive: true, dist: 70, foeHp: 0.6 }), persona({ caution: 0.15, aggression: 0.9, bravery: 0.9 }), 'cole', habits(), 12);
const careful = poseOf(sample({ selfHp: 0.31, foeActive: true, dist: 70, foeHp: 0.6 }), persona({ caution: 0.9, aggression: 0.2, bravery: 0.2 }), 'cole', habits(), 12);
check('same hero different personality', brave.pose !== careful.pose, `brave ${brave.pose} careful ${careful.pose}`);

const stuck = shouldSwitchTarget(
  {
    currentScore: 20,
    nextScore: 24,
    msSinceSwitch: 200,
    currentPunish: false,
    nextPunish: true,
    nextFinish: false,
    nextProtected: false,
    allyNeedsPeel: false,
  },
  persona({ targetFixation: 0.8, reactionQuality: 0.4 }),
);
const ready = shouldSwitchTarget(
  {
    currentScore: 20,
    nextScore: 40,
    msSinceSwitch: 1600,
    currentPunish: false,
    nextPunish: true,
    nextFinish: false,
    nextProtected: false,
    allyNeedsPeel: false,
  },
  persona({ targetFixation: 0.3, reactionQuality: 0.7 }),
);
check('target switch waits out the cooldown', stuck === false && ready === true);

if (failures.length > 0) {
  throw new Error(`${failures.length} fight-read checks failed: ${failures.join('; ')}`);
}
console.log('\nfight read ok');
