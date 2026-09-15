import type { TeamId } from '../config/hero';
import { MATCH } from '../config/match';
import type { ScoreReason } from '../config/score';
import { isHeroFighter, type CombatDamageEvent, type DamageSourceKind } from '../combat/damageEvents';
import type { CombatHealEvent } from '../combat/healEvents';
import { ownerOfWitchSkeleton } from '../heroes/abilities/witch/skeletonPack';
import type { NinjaBody } from '../heroes/NinjaBody';
import type { Progression } from './Progression';

export type HeroStatLine = {
  instanceId: string;
  heroId: string;
  displayName: string;
  team: TeamId;
  player: boolean;
  kills: number;
  assists: number;
  deaths: number;
  /** Damage this hero dealt to other heroes. */
  playerDamage: number;
  /** Damage this hero received from other heroes. */
  playerDamageReceived: number;
  abilityDamage: number;
  lightDamage: number;
  minionDamage: number;
  /** Incoming damage the shield prevented (after defense). */
  blockedDamage: number;
  /** Effective HP restored by this hero (no overheal). */
  healingDone: number;
  healingAlly: number;
  healingSelf: number;
  minionsKilled: number;
  xpEarned: number;
  currentLevel: number;
  highestLevel: number;
  /** Share of team War Score attributed to this hero. */
  personalScore: number;
  heroKillScore: number;
  minionScore: number;
  objectiveScore: number;
  otherScore: number;
  objectiveWins: number;
  objectiveParticipation: number;
  participatedKinds: string[];
};

type HeroKey = NinjaBody;

type DamageMark = {
  attacker: NinjaBody;
  at: number;
};

const emptyLine = (
  body: NinjaBody,
  options: { instanceId: string; player: boolean },
): HeroStatLine => ({
  instanceId: options.instanceId,
  heroId: body.heroId,
  displayName: body.stats.displayName,
  team: body.team,
  player: options.player,
  kills: 0,
  assists: 0,
  deaths: 0,
  playerDamage: 0,
  playerDamageReceived: 0,
  abilityDamage: 0,
  lightDamage: 0,
  minionDamage: 0,
  blockedDamage: 0,
  healingDone: 0,
  healingAlly: 0,
  healingSelf: 0,
  minionsKilled: 0,
  xpEarned: 0,
  currentLevel: 1,
  highestLevel: 1,
  personalScore: 0,
  heroKillScore: 0,
  minionScore: 0,
  objectiveScore: 0,
  otherScore: 0,
  objectiveWins: 0,
  objectiveParticipation: 0,
  participatedKinds: [],
});

/**
 * Kill / assist / damage / heal / score ledger driven by combat and score events.
 * Assists = other friendly heroes who damaged the victim inside the window.
 */
export class CombatStatsTracker {
  private readonly lines = new Map<HeroKey, HeroStatLine>();
  private readonly marks = new Map<HeroKey, DamageMark[]>();
  private locked = false;

  register(body: NinjaBody, options: { instanceId: string; player: boolean }): HeroStatLine {
    const line = emptyLine(body, options);
    this.lines.set(body, line);
    return line;
  }

  lineOf(body: NinjaBody): HeroStatLine | undefined {
    return this.lines.get(body);
  }

  allLines(): HeroStatLine[] {
    return [...this.lines.values()];
  }

  lock(): void {
    this.locked = true;
  }

  get frozen(): boolean {
    return this.locked;
  }

  recordDamage(event: CombatDamageEvent): void {
    if (this.locked) {
      return;
    }
    const attacker = event.attacker;
    const victim = event.victim;
    if (!attacker || event.amount <= 0) {
      return;
    }
    const skeletonOwner = ownerOfWitchSkeleton(attacker);
    const credited = skeletonOwner ?? attacker;
    const attackerLine = this.lines.get(credited);
    if (attackerLine) {
      if (skeletonOwner) {
        attackerLine.abilityDamage += event.amount;
      } else {
        this.addSourceDamage(attackerLine, event.kind, event.amount);
      }
      if (isHeroFighter(victim)) {
        attackerLine.playerDamage += event.amount;
      } else {
        attackerLine.minionDamage += event.amount;
      }
    }
    const victimLine = this.lines.get(victim);
    if (victimLine && (isHeroFighter(credited) || skeletonOwner)) {
      victimLine.playerDamageReceived += event.amount;
    }
    if (isHeroFighter(credited) && isHeroFighter(victim) && credited.team !== victim.team) {
      const list = this.marks.get(victim) ?? [];
      list.push({ attacker: credited, at: event.at });
      this.marks.set(victim, list);
    }
  }

  recordHeal(event: CombatHealEvent): void {
    const amount = event.amount;
    if (this.locked || amount <= 0) {
      return;
    }
    const line = this.lines.get(event.healer);
    if (!line) {
      return;
    }
    line.healingDone += amount;
    if (event.healer === event.target) {
      line.healingSelf += amount;
    } else {
      line.healingAlly += amount;
    }
  }

  recordBlocked(defender: NinjaBody, amount: number): void {
    if (this.locked || amount <= 0) {
      return;
    }
    const line = this.lines.get(defender);
    if (line) {
      line.blockedDamage += amount;
    }
  }

  recordMinionKill(killer: NinjaBody): void {
    if (this.locked) {
      return;
    }
    const line = this.lines.get(killer);
    if (line) {
      line.minionsKilled += 1;
    }
  }

  recordXp(body: NinjaBody, amount: number, progression?: Progression): void {
    if (this.locked || amount <= 0) {
      return;
    }
    const line = this.lines.get(body);
    if (!line) {
      return;
    }
    line.xpEarned += amount;
    if (progression) {
      this.syncLevel(body, progression.level);
    }
  }

  syncLevel(body: NinjaBody, level: number): void {
    const line = this.lines.get(body);
    if (!line) {
      return;
    }
    line.currentLevel = level;
    if (level > line.highestLevel) {
      line.highestLevel = level;
    }
  }

  /**
   * Credit a share of an already-awarded team War Score grant.
   * Amounts must sum to the team grant so personal totals never duplicate it.
   */
  recordScoreShare(body: NinjaBody, amount: number, reason: ScoreReason): void {
    if (this.locked || amount <= 0) {
      return;
    }
    const line = this.lines.get(body);
    if (!line) {
      return;
    }
    const value = Math.round(amount);
    line.personalScore += value;
    if (reason === 'hero_kill') {
      line.heroKillScore += value;
    } else if (reason === 'sword_minion' || reason === 'ranger_minion') {
      line.minionScore += value;
    } else {
      line.objectiveScore += value;
    }
  }

  recordObjectiveWin(body: NinjaBody, kind: string): void {
    if (this.locked) {
      return;
    }
    const line = this.lines.get(body);
    if (!line) {
      return;
    }
    line.objectiveWins += 1;
    line.objectiveParticipation += 1;
    this.noteKind(line, kind);
  }

  recordObjectiveParticipation(body: NinjaBody, kind: string): void {
    if (this.locked) {
      return;
    }
    const line = this.lines.get(body);
    if (!line) {
      return;
    }
    line.objectiveParticipation += 1;
    this.noteKind(line, kind);
  }

  /**
   * Split an integer team grant across contributors so shares sum exactly.
   */
  splitScore(bodies: readonly NinjaBody[], amount: number, reason: ScoreReason): void {
    if (this.locked || amount <= 0 || bodies.length === 0) {
      return;
    }
    const unique: NinjaBody[] = [];
    const seen = new Set<NinjaBody>();
    for (const body of bodies) {
      if (seen.has(body) || !this.lines.has(body)) {
        continue;
      }
      seen.add(body);
      unique.push(body);
    }
    if (unique.length === 0) {
      return;
    }
    const base = Math.floor(amount / unique.length);
    let rem = amount - base * unique.length;
    for (const body of unique) {
      const share = base + (rem > 0 ? 1 : 0);
      if (rem > 0) {
        rem -= 1;
      }
      if (share > 0) {
        this.recordScoreShare(body, share, reason);
      }
    }
  }

  /**
   * Resolve a hero death. Returns the kill team when a hero scored the last hit.
   */
  registerHeroDeath(victim: NinjaBody, at: number): { killer: NinjaBody | null; assists: NinjaBody[] } {
    const victimLine = this.lines.get(victim);
    if (victimLine && !this.locked) {
      victimLine.deaths += 1;
    }
    const marks = (this.marks.get(victim) ?? []).filter((mark) => at - mark.at <= MATCH.assistWindowMs);
    this.marks.delete(victim);
    const killer = victim.lastAttacker && isHeroFighter(victim.lastAttacker) && !victim.lastAttacker.down
      ? victim.lastAttacker
      : marks.length > 0
        ? marks[marks.length - 1].attacker
        : victim.lastAttacker && isHeroFighter(victim.lastAttacker)
          ? victim.lastAttacker
          : null;
    const assists: NinjaBody[] = [];
    const seen = new Set<NinjaBody>();
    for (const mark of marks) {
      if (mark.attacker === killer || mark.attacker.team === victim.team || seen.has(mark.attacker)) {
        continue;
      }
      seen.add(mark.attacker);
      assists.push(mark.attacker);
    }
    if (!this.locked && killer && this.lines.has(killer) && killer.team !== victim.team) {
      this.lines.get(killer)!.kills += 1;
    }
    if (!this.locked) {
      for (const helper of assists) {
        const line = this.lines.get(helper);
        if (line) {
          line.assists += 1;
        }
      }
    }
    return { killer, assists };
  }

  resetCombatMarks(): void {
    this.marks.clear();
  }

  private noteKind(line: HeroStatLine, kind: string): void {
    if (!line.participatedKinds.includes(kind)) {
      line.participatedKinds.push(kind);
    }
  }

  private addSourceDamage(line: HeroStatLine, kind: DamageSourceKind, amount: number): void {
    if (kind === 'ability') {
      line.abilityDamage += amount;
    } else if (kind === 'light') {
      line.lightDamage += amount;
    }
  }
}
