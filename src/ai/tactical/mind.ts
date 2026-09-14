import type { NinjaBody } from '../../heroes/NinjaBody';
import { TACTIC } from './constants';
import {
  byId,
  ensureScoreBuffer,
  pickScoredAction,
  riskOfSituation,
  scoreSituation,
  threatFromRisk,
} from './evaluate';
import type { TacticalField } from './field';
import { kitProfileOf, isRopeDisarmed, isShadowDry } from './kitProfile';
import { clusterRiskOf } from './spacing';
import { personalityFromSeed } from './personality';
import { pickRetreatGoal, type RetreatGoal } from './retreat';
import { scanProjectileThreat } from './shots';
import { GamePlanController } from './strategy';
import { assessSupport } from './supportSense';
import { objectiveHintFor } from '../../match/objectives/board';
import { scoreHintFor } from '../../match/scoreBoard';
import { assessObjective } from './objectiveIntel';
import { assessTeam } from './teamIntel';
import type {
  CombatantView,
  GamePlan,
  KitProfile,
  Personality,
  ScoredAction,
  Situation,
  TacticalAction,
  TacticalDebugInfo,
  TacticalKind,
  UnitFact,
} from './types';
import type { MoveHint } from './move';

export type TacticalIntent = {
  action: TacticalAction;
  target?: NinjaBody;
  ally?: NinjaBody;
  score: number;
  reason: string;
  threat: ReturnType<typeof threatFromRisk>;
  flankSign: number;
  commitUntil: number;
  hpAtCommit: number;
  enemyCountAtCommit: number;
  objEnemyAtCommit: number;
  objAllyAtCommit: number;
  objSelfProgressAtCommit: number;
  objEnemyProgressAtCommit: number;
  objPresentAtCommit: boolean;
  allyDangerAtCommit: boolean;
  goal?: RetreatGoal;
};

type Memory = {
  ref: NinjaBody;
  view: CombatantView;
  seenAt: number;
};

const AGGRESSIVE: ReadonlySet<TacticalAction> = new Set([
  'attack',
  'chase',
  'finish_target',
  'flank',
  'intercept',
  'assist_ally',
  'contest_objective',
]);

const labelOf = (unit?: NinjaBody): string => {
  if (!unit || unit.down) {
    return 'none';
  }
  if (unit.stats.role === 'minion') {
    return unit.stats.displayName;
  }
  return unit.stats.displayName;
};

/**
 * Per-CPU decision state. Perception comes from TacticalField; this class
 * commits to an action long enough to look intentional.
 */
export class TacticalMind {
  readonly personality: Personality;
  readonly kind: TacticalKind;
  readonly homeX: number;
  readonly homeY: number;
  intent: TacticalIntent;
  private nextThinkAt = 0;
  private readonly nearby: UnitFact[] = [];
  private nearbyCount = 0;
  private readonly allies: CombatantView[] = [];
  private readonly enemies: CombatantView[] = [];
  private readonly memory: Memory[] = [];
  private readonly bodyById = new Map<number, NinjaBody>();
  private readonly scores: ScoredAction[];
  private readonly situation: Situation;
  private readonly rngState: { s: number };
  private readonly slot: number;
  private readonly seed: string;
  private lastAllyCount = 0;
  private lastEnemyCount = 0;
  private lastStaminaRatio = 1;
  private kit?: KitProfile;
  private director?: GamePlanController;
  private readonly teamBuf: UnitFact[] = [];

  constructor(kind: TacticalKind, seed: string, homeX: number, homeY: number) {
    this.kind = kind;
    this.personality = personalityFromSeed(seed);
    this.homeX = homeX;
    this.homeY = homeY;
    this.seed = seed;
    this.slot = Math.floor(hashInt(seed) % 97);
    this.rngState = { s: hashInt(seed) || 1 };
    this.scores = ensureScoreBuffer();
    this.intent = {
      action: kind === 'minion' ? 'push_lane' : 'advance',
      score: 0,
      reason: 'spawn',
      threat: 'low',
      flankSign: hashInt(seed) % 2 === 0 ? 1 : -1,
      commitUntil: 0,
      hpAtCommit: 1,
      enemyCountAtCommit: 0,
      objEnemyAtCommit: 0,
      objAllyAtCommit: 0,
      objSelfProgressAtCommit: 0,
      objEnemyProgressAtCommit: 0,
      objPresentAtCommit: false,
      allyDangerAtCommit: false,
    };
    this.situation = {
      self: blankView(),
      allies: this.allies,
      enemies: this.enemies,
      currentTargetId: -1,
      kind,
      personality: this.personality,
      escapeOpen: true,
      homeX,
      homeY,
      vision: kind === 'minion' ? TACTIC.minionVision : TACTIC.heroVision,
    };
  }

  get action(): TacticalAction {
    return this.intent.action;
  }

  get target(): NinjaBody | undefined {
    const target = this.intent.target;
    if (!target || target.down || !target.isPresent) {
      return undefined;
    }
    return target;
  }

  get goal(): RetreatGoal | undefined {
    return this.intent.goal;
  }

  get plan(): GamePlan | undefined {
    return this.director?.snapshot(this.kit?.preferredRange ?? this.situation.self.attackRange);
  }

  moveHint(): MoveHint | undefined {
    const kit = this.kit;
    const director = this.director;
    const self = this.situation.self;
    const mates = this.allies
      .filter((ally) => Math.hypot(ally.x - self.x, ally.y - self.y) < 190)
      .map((ally) => ({
        x: ally.x,
        y: ally.y,
        id: ally.id,
        kind: ally.kind,
        role: String(ally.role),
        attackRange: ally.attackRange,
      }));
    const clusterRisk = clusterRiskOf(self, this.allies, this.enemies);
    if (!kit && !director && mates.length === 0) {
      return undefined;
    }
    return {
      stance: kit?.stance,
      preferredRange: (kit?.preferredRange ?? self.attackRange) * (0.92 + this.personality.preferredDistance * 0.16),
      anchorX: director?.anchorX,
      anchorY: director?.anchorY,
      mates,
      clusterRisk,
      objective: this.situation.objective
        ? {
            kind: this.situation.objective.kind,
            x: this.situation.objective.x,
            y: this.situation.objective.y,
            radius: this.situation.objective.radius,
            huntX: this.situation.objective.enemyX,
            huntY: this.situation.objective.enemyY,
            guardX: this.situation.objective.allyX,
            guardY: this.situation.objective.allyY,
          }
        : undefined,
    };
  }

  situationView(): Situation {
    return this.situation;
  }

  wantsAbilities(): boolean {
    return this.kind === 'hero';
  }

  noteUltSaved(saved: boolean): void {
    this.director?.markUltSaved(saved);
  }

  think(now: number, self: NinjaBody, field: TacticalField, scene?: object, force = false): void {
    if (!force && now < this.nextThinkAt && !this.mustReconsider(now, self)) {
      return;
    }
    const jitter = this.personality.thinkJitterMs;
    const base = this.kind === 'minion' ? TACTIC.minionThinkMin : TACTIC.heroThinkMin;
    const span = this.kind === 'minion' ? TACTIC.minionThinkSpan : TACTIC.heroThinkSpan;
    this.nextThinkAt = now + base + (this.slot % span) + jitter;

    const selfFact = field.factOf(self);
    if (!selfFact) {
      this.intent.action = this.kind === 'minion' ? 'push_lane' : 'search_for_target';
      this.intent.target = undefined;
      this.intent.reason = 'absent';
      return;
    }

    this.gather(now, selfFact, field, scene);
    this.kit = kitProfileOf(self.stats.id, String(self.stats.role), self.stats.attackRange, {
      staminaRatio: selfFact.staminaRatio,
      abilityReady: selfFact.abilityReady,
      dashCharges: selfFact.dashCharges,
      rageRatio: selfFact.rageRatio,
      demonForm: selfFact.demonForm,
      transformLeftMs: selfFact.transformLeftMs,
    });
    this.situation.kit = this.kit;
    this.situation.hasAllySupport = self.kitHasAllySupport;
    const support = assessSupport(this.situation);
    this.situation.supportMode = support.mode;
    this.situation.supportFocusId = support.ally?.id ?? -1;
    this.situation.supportNeed = support.need;
    if (!this.director) {
      this.director = new GamePlanController(
        this.seed,
        this.slot,
        this.kit,
        this.personality,
        this.homeX,
        this.homeY,
      );
    }
    this.director.sync(now, this.situation, this.kit, this.intent.flankSign);
    const risk = riskOfSituation(this.situation);
    const threat = threatFromRisk(risk);
    const count = scoreSituation(this.situation, this.scores);
    const picked = pickScoredAction(this.scores, count, () => this.nextRand());
    if (!picked) {
      return;
    }

    const nextTarget = this.resolve(picked.targetId, true);
    const nextAlly = this.resolve(picked.allyId, false);
    const targetHeld =
      Boolean(this.intent.target) &&
      nextTarget !== this.intent.target &&
      this.intent.target &&
      !this.intent.target.down &&
      now < this.intent.commitUntil + this.personality.targetFixation * 420 &&
      picked.score < this.intent.score + 9 + this.personality.targetFixation * 12 &&
      picked.action !== 'protect_ally' &&
      picked.action !== 'escape' &&
      picked.action !== 'retreat';
    const same =
      picked.action === this.intent.action &&
      (nextTarget === this.intent.target || targetHeld) &&
      now < this.intent.commitUntil &&
      !this.mustReconsider(now, self);
    if (same || targetHeld) {
      this.intent.score = Math.max(this.intent.score, picked.score);
      this.intent.reason = targetHeld ? this.intent.reason : picked.reason;
      this.intent.threat = threat;
      return;
    }

    this.intent = {
      action: picked.action,
      target: nextTarget,
      ally: nextAlly,
      score: picked.score,
      reason: picked.reason,
      threat,
      flankSign: this.intent.flankSign,
      commitUntil: now + this.commitMs(picked.action),
      hpAtCommit: selfFact.hpRatio,
      enemyCountAtCommit: this.lastEnemyCount,
      objEnemyAtCommit: this.situation.objective?.occupyingEnemies ?? 0,
      objAllyAtCommit: this.situation.objective?.occupyingAllies ?? 0,
      objSelfProgressAtCommit: this.situation.objective?.selfProgress ?? 0,
      objEnemyProgressAtCommit: this.situation.objective?.enemyProgress ?? 0,
      objPresentAtCommit: Boolean(this.situation.objective),
      allyDangerAtCommit: this.allies.some(
        (ally) => ally.kind === 'hero' && ally.hpRatio < 0.32 && (ally.recentlyHit || ally.attacking),
      ),
      goal: this.goalFor(picked.action, nextAlly),
    };
  }

  debugInfo(self: NinjaBody): TacticalDebugInfo {
    const target = this.target;
    const maxHp = Math.max(1, self.stats.maxHealth);
    const team = assessTeam(this.situation);
    const obj = assessObjective(this.situation);
    const teamLine = team.allyInDanger
      ? `${team.debug}  LOW HP ALLY`
      : team.fightHandled
        ? `${team.debug}  FIGHT HANDLED`
        : team.debug;
    return {
      action: this.intent.action,
      targetLabel: labelOf(target),
      targetScore: Math.round(this.intent.score),
      threat: this.intent.threat,
      allyCount: this.lastAllyCount,
      enemyCount: this.lastEnemyCount,
      hp: `${Math.round((self.health / maxHp) * 100)}%`,
      reason: this.intent.reason,
      flanking: this.intent.action === 'flank',
      assisting: this.intent.action === 'assist_ally' || this.intent.action === 'protect_ally',
      strategy: this.director?.state ?? 'opening',
      opening: this.director?.opening ?? 'controlled_advance',
      preferredRange: Math.round(this.kit?.preferredRange ?? self.stats.attackRange),
      projectile: Boolean(this.situation.projectile?.willHit),
      regrouping: this.intent.action === 'regroup' || Boolean(this.director?.regrouping),
      savedUlt: Boolean(this.director?.savedUlt),
      team: teamLine,
      objective: obj?.debug,
    };
  }

  wantsAttack(): boolean {
    const action = this.intent.action;
    return (
      action === 'attack' ||
      action === 'finish_target' ||
      action === 'flank' ||
      action === 'chase' ||
      action === 'assist_ally' ||
      action === 'intercept' ||
      action === 'switch_target' ||
      action === 'wait_for_opening' ||
      action === 'farm_minions' ||
      action === 'contest_objective' ||
      (action === 'protect_ally' &&
        (this.kit?.stance === 'support' || this.kit?.stance === 'ranged' || this.situation.hasAllySupport)) ||
      (action === 'recover' && this.intent.goal?.kind === 'minions')
    );
  }

  wantsHold(): boolean {
    const action = this.intent.action;
    if (action === 'hold_position' || action === 'wait_for_opening' || action === 'regroup') {
      return true;
    }
    if (action === 'recover' && this.intent.goal) {
      const dx = this.intent.goal.x - this.situation.self.x;
      const dy = this.intent.goal.y - this.situation.self.y;
      return dx * dx + dy * dy < 42 * 42;
    }
    return false;
  }

  wantsEscape(): boolean {
    const action = this.intent.action;
    if (action === 'escape' || action === 'retreat') {
      return true;
    }
    return action === 'recover' && this.lastEnemyCount > 0;
  }

  private gather(now: number, selfFact: UnitFact, field: TacticalField, scene?: object): void {
    const vision = this.situation.vision;
    this.nearbyCount = field.queryNearby(selfFact.x, selfFact.y, vision, this.nearby);
    this.allies.length = 0;
    this.enemies.length = 0;
    this.bodyById.clear();
    copyView(this.situation.self, selfFact);
    this.situation.self.visible = true;
    this.situation.staminaTrend = selfFact.staminaRatio - this.lastStaminaRatio;
    this.lastStaminaRatio = selfFact.staminaRatio;
    this.situation.currentTargetId = -1;
    this.situation.escapeOpen = field.escapeOpen(selfFact.x, selfFact.y, this.homeX, this.homeY, scene);
    this.situation.homeX = this.homeX;
    this.situation.homeY = this.homeY;
    this.bodyById.set(selfFact.id, selfFact.ref);

    const seenNow = new Set<NinjaBody>();
    for (let i = 0; i < this.nearbyCount; i += 1) {
      const fact = this.nearby[i];
      this.bodyById.set(fact.id, fact.ref);
      if (fact.ref === selfFact.ref) {
        continue;
      }
      if (fact.team === selfFact.team) {
        this.allies.push(fact);
      } else {
        this.enemies.push(fact);
        this.remember(now, fact);
        seenNow.add(fact.ref);
      }
    }

    for (let i = this.memory.length - 1; i >= 0; i -= 1) {
      const item = this.memory[i];
      if (now - item.seenAt > TACTIC.memoryMs || item.ref.down || !item.ref.isPresent) {
        this.memory.splice(i, 1);
        continue;
      }
      if (seenNow.has(item.ref)) {
        continue;
      }
      item.view.visible = false;
      this.enemies.push(item.view);
      this.bodyById.set(item.view.id, item.ref);
    }

    const current = this.intent.target;
    if (current && !current.down) {
      const fact = field.factOf(current);
      if (fact) {
        this.situation.currentTargetId = fact.id;
      } else {
        const remembered = this.memory.find((item) => item.ref === current);
        if (remembered) {
          this.situation.currentTargetId = remembered.view.id;
        }
      }
    }

    this.lastAllyCount = this.allies.length;
    this.lastEnemyCount = this.enemies.filter((enemy) => enemy.visible).length;

    const teamN = field.fillAllies(selfFact.ref, this.teamBuf);
    const seenAlly = new Set(this.allies.map((ally) => ally.id));
    for (let i = 0; i < teamN; i += 1) {
      const fact = this.teamBuf[i];
      this.bodyById.set(fact.id, fact.ref);
      if (!seenAlly.has(fact.id)) {
        this.allies.push(fact);
        seenAlly.add(fact.id);
      }
    }
    const allyHeroes = this.allies.filter((ally) => ally.kind === 'hero');
    const nearestAlly = allyHeroes.reduce((best, ally) => {
      const d = Math.hypot(ally.x - selfFact.x, ally.y - selfFact.y);
      return !best || d < best.d ? { d } : best;
    }, undefined as { d: number } | undefined);
    this.situation.allyHeroCount = allyHeroes.length;
    this.situation.visibleHeroes = this.enemies.filter((enemy) => enemy.kind === 'hero' && enemy.visible).length;
    this.situation.lastSurvivor = this.kind === 'hero' && allyHeroes.length === 0;
    this.situation.isolated =
      this.kind === 'hero' && allyHeroes.length > 0 && (nearestAlly?.d ?? 9999) > 280;
    this.situation.now = now;
    this.situation.projectile = scanProjectileThreat(this.situation.self, this.personality, selfFact.ref.stats.bodyRadius);
    this.situation.objective = objectiveHintFor(selfFact.team);
    const score = scoreHintFor(selfFact.team);
    this.situation.teamScore = { self: score.self, enemy: score.enemy, lastKillAt: score.lastKillAt };
    this.situation.teamMomentum = score.momentum;
    this.lastAllyCount = allyHeroes.length;
  }

  private remember(now: number, fact: UnitFact): void {
    for (const item of this.memory) {
      if (item.ref === fact.ref) {
        copyView(item.view, fact);
        item.view.visible = true;
        item.seenAt = now;
        return;
      }
    }
    if (this.memory.length >= 8) {
      this.memory.shift();
    }
    this.memory.push({ ref: fact.ref, view: cloneView(fact), seenAt: now });
  }

  private resolve(id: number, enemy: boolean): NinjaBody | undefined {
    if (id < 0) {
      return undefined;
    }
    const list = enemy ? this.enemies : this.allies;
    if (!byId(list, id)) {
      return undefined;
    }
    return this.bodyById.get(id);
  }

  private mustReconsider(now: number, self: NinjaBody): boolean {
    const intent = this.intent;
    if (now >= intent.commitUntil) {
      return true;
    }
    if (intent.target && (intent.target.down || !intent.target.isPresent)) {
      return true;
    }
    const hp = self.health / Math.max(1, self.stats.maxHealth);
    const kitLive = {
      staminaRatio: self.stamina / Math.max(1, self.stats.maxStamina),
      abilityReady: self.kitAbilityReady,
      dashCharges: self.kitDashCharges,
      rageRatio: self.demonRage,
      demonForm: self.demonForm,
      transformLeftMs: Math.max(0, self.demonTransformUntil - now),
    };
    if (isShadowDry(self.heroId, kitLive) && AGGRESSIVE.has(intent.action)) {
      return true;
    }
    if (
      self.heroId === 'demon' &&
      self.demonForm !== 'big' &&
      self.demonRage > 0.88 &&
      AGGRESSIVE.has(intent.action)
    ) {
      return true;
    }
    if (
      self.heroId === 'demon' &&
      self.demonForm === 'big' &&
      kitLive.transformLeftMs < 1600 &&
      (intent.action === 'chase' || intent.action === 'flank')
    ) {
      return true;
    }
    if (
      kitLive.staminaRatio < 0.12 &&
      AGGRESSIVE.has(intent.action) &&
      intent.action !== 'finish_target' &&
      intent.action !== 'assist_ally' &&
      !intent.allyDangerAtCommit
    ) {
      return true;
    }
    if (
      isRopeDisarmed(self.heroId, kitLive) &&
      (intent.action === 'chase' ||
        intent.action === 'flank' ||
        intent.action === 'finish_target' ||
        intent.action === 'intercept' ||
        intent.action === 'assist_ally')
    ) {
      return true;
    }
    if (intent.hpAtCommit - hp > 0.2) {
      return true;
    }
    if ((intent.action === 'recover' || intent.action === 'farm_minions') && intent.hpAtCommit - hp > 0.08) {
      return true;
    }
    if ((intent.action === 'recover' || intent.action === 'farm_minions') && hp > 0.72) {
      return true;
    }
    if ((intent.action === 'recover' || intent.action === 'farm_minions') && this.lastEnemyCount > intent.enemyCountAtCommit) {
      return true;
    }
    if (hp < TACTIC.criticalHp && AGGRESSIVE.has(intent.action) && intent.action !== 'finish_target') {
      return true;
    }
    if (this.lastEnemyCount >= intent.enemyCountAtCommit + 2 && AGGRESSIVE.has(intent.action)) {
      return true;
    }
    if (this.situation.projectile?.willHit && intent.action !== 'reposition' && intent.action !== 'escape') {
      return true;
    }
    if (this.situation.objective && this.situation.objective.urgency >= 0.75 && (intent.action === 'farm_minions' || intent.action === 'advance' || intent.action === 'search_for_target')) {
      return true;
    }
    if (this.situation.lastSurvivor && AGGRESSIVE.has(intent.action) && intent.action !== 'finish_target') {
      return true;
    }
    const live = objectiveHintFor(self.team);
    if (Boolean(live) !== intent.objPresentAtCommit) {
      return true;
    }
    if (live) {
      const idleFarm =
        intent.action === 'farm_minions' ||
        intent.action === 'advance' ||
        intent.action === 'search_for_target';
      const freeish =
        live.kind !== 'bounty_target' &&
        live.occupyingEnemies === 0 &&
        live.nearbyEnemies === 0 &&
        !live.contested;
      if (idleFarm && (live.urgency >= 0.62 || freeish)) {
        return true;
      }
      if (Math.abs(live.selfProgress - intent.objSelfProgressAtCommit) >= 0.14) {
        return true;
      }
      if (Math.abs(live.enemyProgress - intent.objEnemyProgressAtCommit) >= 0.12) {
        return true;
      }
      if (live.occupyingEnemies !== intent.objEnemyAtCommit || live.occupyingAllies !== intent.objAllyAtCommit) {
        return true;
      }
      if (live.contested && intent.action === 'farm_minions') {
        return true;
      }
    }
    const allyDanger = this.allies.some(
      (ally) => ally.kind === 'hero' && ally.hpRatio < 0.3 && (ally.recentlyHit || ally.attacking),
    );
    if (allyDanger && !intent.allyDangerAtCommit && intent.action !== 'protect_ally' && intent.action !== 'assist_ally') {
      return true;
    }
    if (this.lastEnemyCount + 1 <= intent.enemyCountAtCommit && intent.action === 'assist_ally' && live && live.occupyingEnemies === 0) {
      return true;
    }
    return false;
  }

  private commitMs(action: TacticalAction): number {
    const stick = this.personality.targetFixation * 180 + this.personality.decisionConfidence * 80;
    if (action === 'flank') {
      return TACTIC.flankCommit + this.slot * 2 + stick;
    }
    if (action === 'wait_for_opening' || action === 'hold_position') {
      return 640 + this.slot * 3 + stick * 0.4;
    }
    if (action === 'retreat' || action === 'escape') {
      return 720 + this.personality.retreatWillingness * 80;
    }
    if (action === 'recover') {
      return 1480 + this.slot * 4;
    }
    if (action === 'farm_minions') {
      return 920 + this.personality.patience * 120;
    }
    if (action === 'push_lane' || action === 'advance' || action === 'search_for_target' || action === 'regroup' || action === 'contest_objective') {
      return 880 + this.personality.independence * 80;
    }
    return TACTIC.commitMin + (this.slot % TACTIC.commitSpan) + stick;
  }

  private goalFor(action: TacticalAction, ally?: NinjaBody): RetreatGoal | undefined {
    if (action === 'recover') {
      return pickRetreatGoal(this.situation, 'cover');
    }
    if (action === 'regroup') {
      if (ally) {
        return { kind: 'safe', x: ally.x, y: ally.y };
      }
      return this.director
        ? { kind: 'safe', x: this.director.anchorX, y: this.director.anchorY }
        : undefined;
    }
    if (action === 'farm_minions') {
      return pickRetreatGoal(this.situation, 'minions');
    }
    if (action === 'retreat' || action === 'escape') {
      return pickRetreatGoal(this.situation, 'any');
    }
    return undefined;
  }

  private nextRand(): number {
    this.rngState.s = (Math.imul(1664525, this.rngState.s) + 1013904223) >>> 0;
    return this.rngState.s / 4294967296;
  }
}

const hashInt = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const blankView = (): CombatantView => ({
  id: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  aimX: 1,
  aimY: 0,
  team: 'alpha',
  kind: 'hero',
  role: 'generalist',
  heroId: '',
  hpRatio: 1,
  staminaRatio: 1,
  attackRange: 40,
  moveSpeed: 140,
  defense: 10,
  power: 1,
  attacking: false,
  stunned: false,
  recentlyHit: false,
  canAttack: true,
  lastAttackerId: -1,
  visible: true,
  blocking: false,
  abilityReady: true,
  dashCharges: 2,
  rageRatio: 0,
  demonForm: 'little',
  transformLeftMs: 0,
});

const copyView = (dest: CombatantView, src: CombatantView): void => {
  dest.id = src.id;
  dest.x = src.x;
  dest.y = src.y;
  dest.vx = src.vx;
  dest.vy = src.vy;
  dest.aimX = src.aimX;
  dest.aimY = src.aimY;
  dest.team = src.team;
  dest.kind = src.kind;
  dest.role = src.role;
  dest.heroId = src.heroId;
  dest.hpRatio = src.hpRatio;
  dest.staminaRatio = src.staminaRatio;
  dest.attackRange = src.attackRange;
  dest.moveSpeed = src.moveSpeed;
  dest.defense = src.defense;
  dest.power = src.power;
  dest.attacking = src.attacking;
  dest.stunned = src.stunned;
  dest.recentlyHit = src.recentlyHit;
  dest.canAttack = src.canAttack;
  dest.lastAttackerId = src.lastAttackerId;
  dest.visible = src.visible;
  dest.blocking = src.blocking;
  dest.abilityReady = src.abilityReady;
  dest.dashCharges = src.dashCharges;
  dest.rageRatio = src.rageRatio;
  dest.demonForm = src.demonForm;
  dest.transformLeftMs = src.transformLeftMs;
};

const cloneView = (src: CombatantView): CombatantView => {
  const dest = blankView();
  copyView(dest, src);
  return dest;
};
