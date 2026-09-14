import { OBJECTIVE, type ObjectiveKind } from '../../config/objective';
import type { CombatantView, Situation } from './types';

export type ObjectiveFamily = 'capture' | 'destroy' | 'shrine' | 'bounty';

export type ObjectivePlay =
  | 'free_take'
  | 'capture'
  | 'protect_capture'
  | 'contest_zone'
  | 'too_late'
  | 'hold_back'
  | 'attack_objective'
  | 'defend_objective'
  | 'pressure_defenders'
  | 'heal'
  | 'hunt_bounty'
  | 'guard_bounty';

export type ObjectiveIntel = {
  family: ObjectiveFamily;
  kind: ObjectiveKind;
  x: number;
  y: number;
  radius: number;
  dist: number;
  travelMs: number;
  inside: boolean;
  inHitRange: boolean;
  occAllies: number;
  occEnemies: number;
  nearAllies: number;
  nearEnemies: number;
  approachingEnemies: CombatantView[];
  alliesCloser: number;
  alliesHandling: boolean;
  free: boolean;
  dangerous: boolean;
  canArriveInTime: boolean;
  tooLate: boolean;
  selfCapturing: boolean;
  enemyCapturing: boolean;
  contested: boolean;
  decaying: boolean;
  selfProgress: number;
  enemyProgress: number;
  urgency: number;
  risk: number;
  focus?: CombatantView;
  ally?: CombatantView;
  play: ObjectivePlay;
  reason: string;
  debug: string;
};

const ZONE: ReadonlySet<ObjectiveKind> = new Set(['capture_zone', 'healing_shrine']);
const DESTROY: ReadonlySet<ObjectiveKind> = new Set(['golden_piggy', 'executioner']);

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

const hypot = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

export const familyOf = (kind: ObjectiveKind): ObjectiveFamily => {
  if (kind === 'capture_zone') {
    return 'capture';
  }
  if (kind === 'healing_shrine') {
    return 'shrine';
  }
  if (kind === 'bounty_target') {
    return 'bounty';
  }
  return 'destroy';
};

export const isZoneObjective = (kind: ObjectiveKind): boolean => ZONE.has(kind);

export const isDestroyObjective = (kind: ObjectiveKind): boolean => DESTROY.has(kind);

export const movingToward = (from: CombatantView, toX: number, toY: number): boolean => {
  const speed = Math.hypot(from.vx, from.vy);
  if (speed < 18) {
    return false;
  }
  const dx = toX - from.x;
  const dy = toY - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const dot = (from.vx * dx + from.vy * dy) / (speed * len);
  return dot > 0.35;
};

const occupancyRadius = (kind: ObjectiveKind, radius: number): number => {
  if (kind === 'golden_piggy') {
    return radius + 90;
  }
  if (kind === 'executioner') {
    return radius + 110;
  }
  if (kind === 'bounty_target') {
    return 56;
  }
  return radius;
};

export const assessObjective = (
  situation: Situation,
  extras: { handledNearby?: boolean; risk?: number } = {},
): ObjectiveIntel | undefined => {
  const obj = situation.objective;
  if (!obj) {
    return undefined;
  }
  const { self, allies, enemies, personality } = situation;
  const family = familyOf(obj.kind);
  const focusPoint =
    family === 'bounty' && obj.enemyX !== undefined
      ? { x: obj.enemyX, y: obj.enemyY ?? obj.y }
      : { x: obj.x, y: obj.y };
  const dist = hypot(self.x, self.y, focusPoint.x, focusPoint.y);
  const speed = Math.max(90, self.moveSpeed);
  const travelMs = (dist / speed) * 1000;
  const occR = occupancyRadius(obj.kind, obj.radius);
  const nearR = occR + 220;
  const heroAllies = allies.filter((ally) => ally.kind === 'hero');
  const heroEnemies = enemies.filter((enemy) => enemy.kind === 'hero');
  const visibleEnemies = heroEnemies.filter((enemy) => enemy.visible);

  let occAllies = 0;
  let occEnemies = 0;
  let nearAllies = 0;
  let nearEnemies = 0;
  let alliesCloser = 0;
  let ally: CombatantView | undefined;
  let focus: CombatantView | undefined;
  let focusD = 9999;
  for (const friend of heroAllies) {
    const d = hypot(friend.x, friend.y, obj.x, obj.y);
    if (d <= occR) {
      occAllies += 1;
    }
    if (d <= nearR) {
      nearAllies += 1;
      if (!ally || d < hypot(ally.x, ally.y, obj.x, obj.y)) {
        ally = friend;
      }
    }
    if (hypot(friend.x, friend.y, focusPoint.x, focusPoint.y) + 36 < dist) {
      alliesCloser += 1;
    }
  }
  const approachingEnemies: CombatantView[] = [];
  for (const enemy of visibleEnemies) {
    const d = hypot(enemy.x, enemy.y, obj.x, obj.y);
    if (d <= occR) {
      occEnemies += 1;
    }
    if (d <= nearR) {
      nearEnemies += 1;
    }
    if (d < focusD) {
      focus = enemy;
      focusD = d;
    }
    if (movingToward(enemy, obj.x, obj.y) && d > occR && d < 560) {
      approachingEnemies.push(enemy);
    }
  }
  if (family === 'bounty' && obj.enemyX !== undefined) {
    const marked = visibleEnemies.find(
      (enemy) => hypot(enemy.x, enemy.y, obj.enemyX ?? enemy.x, obj.enemyY ?? enemy.y) < 56,
    );
    if (marked) {
      focus = marked;
    }
  }
  if (family === 'bounty' && obj.allyX !== undefined) {
    const markedAlly = heroAllies.find(
      (friend) => hypot(friend.x, friend.y, obj.allyX ?? friend.x, obj.allyY ?? friend.y) < 56,
    );
    if (markedAlly) {
      ally = markedAlly;
    }
  }

  const inside = dist <= obj.radius * (family === 'destroy' ? 1.15 : 1);
  const inHitRange = dist <= obj.radius + self.attackRange * 1.05;
  const contested = obj.contested || (occAllies > 0 && occEnemies > 0);
  const enemyCapturing =
    family === 'capture' &&
    ((obj.owner && obj.owner !== self.team && obj.enemyProgress > 0.02) || (occEnemies > 0 && obj.owner !== self.team));
  const selfCapturing =
    family === 'capture' &&
    ((obj.owner === self.team && obj.selfProgress > 0.02 && !contested) || (inside && occEnemies === 0));
  const remainingCaptureMs = family === 'capture' ? (1 - obj.enemyProgress) * OBJECTIVE.capture.captureMs : 0;
  const remainingDestroyMs =
    family === 'destroy' ? (1 - obj.enemyProgress) * (obj.kind === 'golden_piggy' ? 30 : 40) * 380 : 0;
  const remainMs = family === 'capture' ? remainingCaptureMs : family === 'destroy' ? remainingDestroyMs : 12_000;
  const canArriveInTime = inside || travelMs + 380 < remainMs * 0.98 || remainMs > 9000;
  const tooLate =
    !inside &&
    ((family === 'capture' && enemyCapturing && obj.enemyProgress >= 0.84 && travelMs > remainingCaptureMs + 200) ||
      (family === 'destroy' && occEnemies > 0 && obj.enemyProgress >= 0.9 && travelMs > remainingDestroyMs + 400));

  const perceivedClear = nearEnemies === 0 && occEnemies === 0 && approachingEnemies.length === 0;
  const hudEnemyHold = family === 'capture' && obj.owner !== self.team && obj.enemyProgress > 0.08;
  const free =
    perceivedClear &&
    !contested &&
    !hudEnemyHold &&
    canArriveInTime &&
    self.hpRatio > 0.22 &&
    self.staminaRatio > 0.1 &&
    !tooLate;
  const dangerous =
    (nearEnemies >= 3 && nearAllies === 0) ||
    (nearEnemies >= 2 && nearAllies === 0 && self.hpRatio < 0.55) ||
    (occEnemies >= occAllies + 2 && self.hpRatio < 0.5 && !inside);
  const alliesHandling =
    occAllies >= 1 &&
    occEnemies === 0 &&
    approachingEnemies.length === 0 &&
    !inside &&
    (family === 'capture' || family === 'shrine' || family === 'destroy');

  let urgency = obj.urgency;
  if (family === 'capture') {
    urgency = 0.32 + obj.selfProgress * 0.34 + obj.enemyProgress * 0.5;
    if (contested) {
      urgency += 0.12;
    }
    if (obj.decaying && obj.owner === self.team) {
      urgency += 0.18;
    }
    if (free) {
      urgency = Math.max(urgency, 0.62);
    }
    if (enemyCapturing && obj.enemyProgress >= 0.72 && canArriveInTime) {
      urgency = Math.max(urgency, 0.86);
    }
    if (selfCapturing && obj.selfProgress >= 0.7) {
      urgency = Math.max(urgency, 0.74);
    }
    if (tooLate) {
      urgency *= 0.25;
    }
  } else if (family === 'destroy') {
    urgency = 0.28 + obj.selfProgress * 0.4 + obj.enemyProgress * 0.52;
    if (occEnemies > 0 && obj.enemyProgress > 0.2) {
      urgency = Math.max(urgency, 0.72);
    }
    if (free) {
      urgency = Math.max(urgency, 0.64);
    }
    if (obj.selfProgress >= 0.75) {
      urgency = Math.max(urgency, 0.78);
    }
  } else if (family === 'shrine') {
    urgency = 0.26 + (self.hpRatio < 0.62 ? (1 - self.hpRatio) * 0.4 : 0);
    if (contested) {
      urgency += 0.14;
    }
    if (self.hpRatio > 0.82 && !contested) {
      urgency *= 0.55;
    }
  } else {
    urgency = obj.urgency;
  }
  urgency = clamp(urgency + (extras.handledNearby ? 0.08 : 0), 0, 1);

  const localRisk = clamp(
    (extras.risk ?? 0) * 0.5 +
      nearEnemies * 0.12 -
      nearAllies * 0.08 +
      (self.hpRatio < 0.28 ? 0.2 : 0) +
      (dangerous ? 0.22 : 0),
    0,
    1,
  );

  let play: ObjectivePlay = 'hold_back';
  let reason = 'watch the objective';
  if (family === 'capture') {
    if (tooLate) {
      play = 'too_late';
      reason = 'too late to contest';
    } else if (dangerous && self.hpRatio < personality.retreatHp + 0.08) {
      play = 'hold_back';
      reason = 'objective is dangerous';
    } else if (inside && occEnemies > 0) {
      play = 'contest_zone';
      reason = 'fight on the zone';
    } else if (selfCapturing || (inside && obj.owner === self.team)) {
      play = 'protect_capture';
      reason = obj.selfProgress >= 0.7 ? 'protect the capture' : 'hold the zone';
    } else if (enemyCapturing && canArriveInTime) {
      play = 'contest_zone';
      reason = obj.enemyProgress >= 0.7 ? 'stop the capture' : 'contest the zone';
    } else if (alliesHandling) {
      play = 'hold_back';
      reason = 'allies handling capture';
    } else if (free) {
      play = 'free_take';
      reason = 'free capture';
    } else {
      play = 'capture';
      reason = contested ? 'contest the zone' : 'take the zone';
    }
  } else if (family === 'destroy') {
    if (tooLate) {
      play = 'too_late';
      reason = 'too late to stop it';
    } else if (dangerous && self.hpRatio < 0.32) {
      play = 'hold_back';
      reason = 'cannot contest safely';
    } else if (occEnemies > 0 && (obj.enemyProgress > 0.2 || approachingEnemies.length > 0)) {
      play = 'defend_objective';
      reason = 'defend the objective';
    } else if (occEnemies > 0 && !free) {
      play = 'pressure_defenders';
      reason = 'clear defenders first';
    } else if (alliesHandling && obj.selfProgress < 0.7) {
      play = 'hold_back';
      reason = 'allies on the objective';
    } else if (free || perceivedClear) {
      play = 'attack_objective';
      reason = 'attack the objective';
    } else {
      play = 'attack_objective';
      reason = 'pressure the objective';
    }
  } else if (family === 'shrine') {
    if (dangerous && self.hpRatio < 0.28) {
      play = 'hold_back';
      reason = 'shrine is unsafe';
    } else if (self.hpRatio < 0.62 && !dangerous) {
      play = 'heal';
      reason = 'take the shrine';
    } else if (contested && (self.hpRatio < 0.72 || occAllies > 0)) {
      play = 'contest_zone';
      reason = 'contest the shrine';
    } else if (alliesHandling && self.hpRatio > 0.7) {
      play = 'hold_back';
      reason = 'allies holding shrine';
    } else if (free && self.hpRatio < 0.82) {
      play = 'heal';
      reason = 'free shrine';
    } else {
      play = 'hold_back';
      reason = 'shrine is optional';
    }
  } else {
    const selfMarked =
      obj.allyX !== undefined && hypot(obj.allyX, obj.allyY ?? self.y, self.x, self.y) < 48;
    if (selfMarked) {
      play = 'hunt_bounty';
      reason = 'marked, hunt or survive';
    } else if (ally && (ally.hpRatio < 0.55 || occEnemies > 0)) {
      play = 'guard_bounty';
      reason = 'cover the bounty ally';
    } else {
      play = 'hunt_bounty';
      reason = 'hunt the bounty';
    }
  }

  const kindLabel =
    obj.kind === 'capture_zone'
      ? 'capture'
      : obj.kind === 'golden_piggy'
        ? 'piggy'
        : obj.kind === 'executioner'
          ? 'executioner'
          : obj.kind === 'healing_shrine'
            ? 'shrine'
            : 'bounty';

  return {
    family,
    kind: obj.kind,
    x: focusPoint.x,
    y: focusPoint.y,
    radius: obj.radius,
    dist,
    travelMs,
    inside,
    inHitRange,
    occAllies,
    occEnemies,
    nearAllies,
    nearEnemies,
    approachingEnemies,
    alliesCloser,
    alliesHandling,
    free,
    dangerous,
    canArriveInTime,
    tooLate,
    selfCapturing,
    enemyCapturing,
    contested,
    decaying: obj.decaying,
    selfProgress: obj.selfProgress,
    enemyProgress: obj.enemyProgress,
    urgency,
    risk: localRisk,
    focus,
    ally,
    play,
    reason,
    debug: `${kindLabel} ${play} u${urgency.toFixed(2)} d${Math.round(dist)} ${contested ? 'contest' : free ? 'free' : dangerous ? 'hot' : alliesHandling ? 'handled' : ''}`,
  };
};
