import { ARENA } from '../../config/arena';
import type { NinjaBody } from '../../heroes/NinjaBody';
import { battlefieldOf } from '../../map';
import { TACTIC } from './constants';
import type { TacticalKind, UnitFact } from './types';

const COLS = Math.ceil(ARENA.width / TACTIC.cellSize);
const ROWS = Math.ceil(ARENA.height / TACTIC.cellSize);

const combatPowerOf = (body: NinjaBody): number => {
  const stats = body.stats;
  const raw = stats.attackDamage * 1.4 + stats.maxHealth * 0.05 + stats.defense * 0.4 + stats.moveSpeed * 0.02;
  const roleMul = stats.role === 'minion' ? 0.42 : 1;
  return Math.max(0.25, (raw * roleMul) / 18);
};

/**
 * Shared, staggered world snapshot. Brains query nearby facts instead of
 * scanning the full roster every frame.
 */
export class TacticalField {
  private readonly facts: UnitFact[] = [];
  private factCount = 0;
  private nextRefreshAt = 0;
  private readonly cells: number[][] = Array.from({ length: COLS * ROWS }, () => []);
  private readonly indexOf = new Map<NinjaBody, number>();
  private readonly stableId = new WeakMap<NinjaBody, number>();
  private nextStableId = 1;

  refresh(now: number, bodies: readonly NinjaBody[], force = false): void {
    if (!force && now < this.nextRefreshAt && this.factCount > 0) {
      return;
    }
    this.nextRefreshAt = now + TACTIC.fieldRefreshMs;
    this.indexOf.clear();
    for (const cell of this.cells) {
      cell.length = 0;
    }
    let count = 0;
    for (const body of bodies) {
      if (body.down || !body.isPresent) {
        continue;
      }
      const fact = this.claimFact(count);
      this.fillFact(fact, body, this.idOf(body), now);
      this.indexOf.set(body, count);
      const col = clampCell(Math.floor(body.x / TACTIC.cellSize), COLS);
      const row = clampCell(Math.floor(body.y / TACTIC.cellSize), ROWS);
      this.cells[row * COLS + col].push(count);
      count += 1;
    }
    this.factCount = count;
    for (let i = 0; i < count; i += 1) {
      const fact = this.facts[i];
      const attacker = fact.ref.lastAttacker;
      fact.lastAttackerId = attacker && !attacker.down ? this.idOf(attacker) : -1;
    }
  }

  livingCount(): number {
    return this.factCount;
  }

  factOf(body: NinjaBody): UnitFact | undefined {
    const index = this.indexOf.get(body);
    if (index === undefined) {
      return undefined;
    }
    return this.facts[index];
  }

  queryNearby(x: number, y: number, radius: number, out: UnitFact[]): number {
    const reach = radius + TACTIC.cellSize;
    const minC = clampCell(Math.floor((x - reach) / TACTIC.cellSize), COLS);
    const maxC = clampCell(Math.floor((x + reach) / TACTIC.cellSize), COLS);
    const minR = clampCell(Math.floor((y - reach) / TACTIC.cellSize), ROWS);
    const maxR = clampCell(Math.floor((y + reach) / TACTIC.cellSize), ROWS);
    const radiusSq = radius * radius;
    let n = 0;
    for (let row = minR; row <= maxR; row += 1) {
      for (let col = minC; col <= maxC; col += 1) {
        const cell = this.cells[row * COLS + col];
        for (let i = 0; i < cell.length; i += 1) {
          const fact = this.facts[cell[i]];
          const dx = fact.x - x;
          const dy = fact.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            if (n < out.length) {
              out[n] = fact;
            } else {
              out.push(fact);
            }
            n += 1;
          }
        }
      }
    }
    out.length = n;
    return n;
  }

  fillAllies(body: NinjaBody, out: UnitFact[]): number {
    let n = 0;
    for (let i = 0; i < this.factCount; i += 1) {
      const fact = this.facts[i];
      if (fact.team !== body.team || fact.ref === body) {
        continue;
      }
      if (n < out.length) {
        out[n] = fact;
      } else {
        out.push(fact);
      }
      n += 1;
    }
    out.length = n;
    return n;
  }

  fillEnemies(body: NinjaBody, out: NinjaBody[]): number {
    let n = 0;
    for (let i = 0; i < this.factCount; i += 1) {
      const fact = this.facts[i];
      if (fact.team === body.team) {
        continue;
      }
      if (n < out.length) {
        out[n] = fact.ref;
      } else {
        out.push(fact.ref);
      }
      n += 1;
    }
    out.length = n;
    return n;
  }

  enemiesOf(body: NinjaBody): NinjaBody[] {
    const foes: NinjaBody[] = [];
    this.fillEnemies(body, foes);
    return foes;
  }

  escapeOpen(x: number, y: number, homeX: number, homeY: number, scene?: { time?: unknown }): boolean {
    const dx = homeX - x;
    const dy = homeY - y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const map = scene ? battlefieldOf(scene as never) : undefined;
    if (!map) {
      return true;
    }
    for (let step = 1; step <= 3; step += 1) {
      const px = x + nx * 42 * step;
      const py = y + ny * 42 * step;
      if (map.query.blocksMovement(px, py, 12)) {
        return false;
      }
    }
    return true;
  }

  private idOf(body: NinjaBody): number {
    const existing = this.stableId.get(body);
    if (existing !== undefined) {
      return existing;
    }
    const id = this.nextStableId;
    this.nextStableId += 1;
    this.stableId.set(body, id);
    return id;
  }

  private claimFact(index: number): UnitFact {
    const existing = this.facts[index];
    if (existing) {
      return existing;
    }
    const created: UnitFact = {
      id: index,
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
      ref: undefined as unknown as NinjaBody,
    };
    this.facts[index] = created;
    return created;
  }

  private fillFact(fact: UnitFact, body: NinjaBody, id: number, now: number): void {
    const physics = body.body;
    const maxHp = Math.max(1, body.stats.maxHealth);
    const maxStamina = Math.max(1, body.stats.maxStamina);
    fact.id = id;
    fact.ref = body;
    fact.x = body.x;
    fact.y = body.y;
    fact.vx = physics?.velocity.x ?? 0;
    fact.vy = physics?.velocity.y ?? 0;
    fact.aimX = body.aim.x;
    fact.aimY = body.aim.y;
    fact.team = body.team;
    fact.kind = (body.stats.role === 'minion' ? 'minion' : 'hero') as TacticalKind;
    fact.role = body.stats.role;
    fact.heroId = body.stats.id;
    fact.hpRatio = body.health / maxHp;
    fact.staminaRatio = body.stamina / maxStamina;
    fact.attackRange = body.stats.attackRange;
    fact.moveSpeed = body.stats.moveSpeed;
    fact.defense = body.stats.defense;
    fact.power = combatPowerOf(body);
    fact.attacking = now - body.status.lastAttackAt < 280;
    fact.stunned = body.status.shouldLockMovement(now);
    fact.recentlyHit = body.status.isHitReacting(now) || now - body.lastAttackerAt < 380;
    fact.canAttack = body.canAttack(now);
    fact.visible = true;
    fact.blocking = body.blocking;
    fact.abilityReady = body.kitAbilityReady;
    fact.dashCharges = body.kitDashCharges;
    fact.lastAttackerId = -1;
  }
}

const clampCell = (value: number, max: number): number => Math.max(0, Math.min(max - 1, value));
