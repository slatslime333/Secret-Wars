import { NinjaBody } from '../NinjaBody';
import { distanceBetween } from './geometry';

export type AreaModifier = {
  moveMul: number;
  attackSpeedMul: number;
  staminaDrainMul: number;
};

export type SmokeZone = {
  id: number;
  x: number;
  y: number;
  radius: number;
  startedAt: number;
  expandMs: number;
  endsAt: number;
  owner: NinjaBody;
  modifiers: AreaModifier;
};

/**
 * Persistent world effects that outlive the ability press (smoke, future zones).
 * Heroes add zones; the world applies and clears status on living enemies.
 */
export type WorldTicker = {
  update: (now: number, delta: number, fighters: NinjaBody[]) => boolean;
  destroy?: () => void;
};

export class AbilityWorld {
  private nextId = 1;
  private readonly smokeZones: SmokeZone[] = [];
  private readonly tickers: WorldTicker[] = [];

  addTicker(ticker: WorldTicker): void {
    this.tickers.push(ticker);
  }

  spawnSmoke(zone: Omit<SmokeZone, 'id'>): SmokeZone {
    const created = { ...zone, id: this.nextId };
    this.nextId += 1;
    this.smokeZones.push(created);
    return created;
  }

  currentSmokeRadius(zone: SmokeZone, now: number): number {
    const age = now - zone.startedAt;
    if (age <= zone.expandMs) {
      const t = Math.min(1, age / zone.expandMs);
      const eased = 1 - (1 - t) * (1 - t);
      return zone.radius * eased;
    }
    const fade = zone.endsAt - now;
    if (fade < 420) {
      return zone.radius * (0.72 + 0.28 * (fade / 420));
    }
    return zone.radius;
  }

  update(now: number, fighters: NinjaBody[], delta = 16): void {
    for (let i = this.tickers.length - 1; i >= 0; i -= 1) {
      if (!this.tickers[i].update(now, delta, fighters)) {
        this.tickers[i].destroy?.();
        this.tickers.splice(i, 1);
      }
    }
    for (let i = this.smokeZones.length - 1; i >= 0; i -= 1) {
      if (now >= this.smokeZones[i].endsAt) {
        this.smokeZones.splice(i, 1);
      }
    }

    for (const fighter of fighters) {
      if (fighter.down) {
        fighter.status.clearZoneModifiers();
        continue;
      }
      const inside = this.smokeZones.find((zone) => {
        if (zone.owner.team === fighter.team) {
          return false;
        }
        const radius = this.currentSmokeRadius(zone, now);
        return distanceBetween(fighter.x, fighter.y, zone.x, zone.y) <= radius;
      });
      if (inside) {
        fighter.status.setZoneModifiers(inside.modifiers);
      } else {
        fighter.status.clearZoneModifiers();
      }
    }
  }

  destroy(): void {
    for (const ticker of this.tickers) {
      ticker.destroy?.();
    }
    this.tickers.length = 0;
    this.smokeZones.length = 0;
  }
}
