import type { TeamId } from '../config/hero';
import { MATCH } from '../config/match';
import { isHeroFighter, type CombatDamageEvent, type DamageSourceKind } from '../combat/damageEvents';
import { ownerOfWitchSkeleton } from '../heroes/abilities/witch/skeletonPack';
import type { NinjaBody } from '../heroes/NinjaBody';

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
};

type HeroKey = NinjaBody;

type DamageMark = {
  attacker: NinjaBody;
  at: number;
};

/**
 * Kill / assist / damage ledger driven by combat events.
 * Assists = other friendly heroes who damaged the victim inside the window.
 */
export class CombatStatsTracker {
  private readonly lines = new Map<HeroKey, HeroStatLine>();
  private readonly marks = new Map<HeroKey, DamageMark[]>();

  register(body: NinjaBody, options: { instanceId: string; player: boolean }): HeroStatLine {
    const line: HeroStatLine = {
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
    };
    this.lines.set(body, line);
    return line;
  }

  lineOf(body: NinjaBody): HeroStatLine | undefined {
    return this.lines.get(body);
  }

  allLines(): HeroStatLine[] {
    return [...this.lines.values()];
  }

  recordDamage(event: CombatDamageEvent): void {
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

  recordBlocked(defender: NinjaBody, amount: number): void {
    if (amount <= 0) {
      return;
    }
    const line = this.lines.get(defender);
    if (line) {
      line.blockedDamage += amount;
    }
  }

  /**
   * Resolve a hero death. Returns the kill team when a hero scored the last hit.
   */
  registerHeroDeath(victim: NinjaBody, at: number): { killer: NinjaBody | null; assists: NinjaBody[] } {
    const victimLine = this.lines.get(victim);
    if (victimLine) {
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
    if (killer && this.lines.has(killer) && killer.team !== victim.team) {
      this.lines.get(killer)!.kills += 1;
    }
    for (const helper of assists) {
      const line = this.lines.get(helper);
      if (line) {
        line.assists += 1;
      }
    }
    return { killer, assists };
  }

  resetCombatMarks(): void {
    this.marks.clear();
  }

  private addSourceDamage(line: HeroStatLine, kind: DamageSourceKind, amount: number): void {
    if (kind === 'ability') {
      line.abilityDamage += amount;
    } else if (kind === 'light') {
      line.lightDamage += amount;
    }
  }
}
