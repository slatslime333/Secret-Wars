import Phaser from 'phaser';
import { MATCH } from '../config/match';
import type { TeamId } from '../config/hero';
import type { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

export type XpOrbGrant = {
  target: NinjaBody;
  amount: number;
  team: TeamId;
};

type Orb = {
  view: Phaser.GameObjects.Container;
  disc: Phaser.GameObjects.Arc;
  target: NinjaBody;
  amount: number;
  team: TeamId;
  bornAt: number;
  wobble: number;
  visual: boolean;
};

const TEAM_COLOR: Record<TeamId, number> = {
  alpha: COLORS.cyan,
  bravo: COLORS.redBright,
};

/** Team-colored XP pip that chases the killer, then grants XP on arrival. */
export class XpOrbWorld {
  private readonly orbs: Orb[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onArrive: (grant: XpOrbGrant) => void,
  ) {}

  spawn(
    x: number,
    y: number,
    target: NinjaBody,
    amount: number,
    team: TeamId,
    options: { visual?: boolean } = {},
  ): void {
    if (amount <= 0 && !options.visual) {
      return;
    }
    const color = TEAM_COLOR[team];
    const disc = this.scene.add.circle(0, 0, MATCH.orbs.radius, color, 0.95);
    disc.setStrokeStyle(1.5, 0xf6f1de, 0.9);
    const ring = this.scene.add.circle(0, 0, MATCH.orbs.radius + 3, color, 0.18);
    const view = this.scene.add.container(x, y, [ring, disc]).setDepth(28);
    this.orbs.push({
      view,
      disc,
      target,
      amount,
      team,
      bornAt: this.scene.time.now,
      wobble: Math.random() * Math.PI * 2,
      visual: Boolean(options.visual),
    });
  }

  update(now: number, delta: number): void {
    const dt = delta / 1000;
    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      if (!orb.target.isPresent || orb.target.down || now - orb.bornAt >= MATCH.orbs.lifetimeMs) {
        orb.view.destroy();
        this.orbs.splice(i, 1);
        continue;
      }
      orb.wobble += dt * 8;
      const dx = orb.target.x - orb.view.x;
      const dy = orb.target.y - 10 - orb.view.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= MATCH.orbs.arriveRadius) {
        if (!orb.visual && orb.amount > 0) {
          this.onArrive({ target: orb.target, amount: orb.amount, team: orb.team });
        }
        orb.view.destroy();
        this.orbs.splice(i, 1);
        continue;
      }
      const speed = MATCH.orbs.speed * (0.7 + Math.min(1.4, 40 / Math.max(12, dist)));
      orb.view.x += (dx / dist) * speed * dt;
      orb.view.y += (dy / dist) * speed * dt + Math.sin(orb.wobble) * 10 * dt;
      orb.disc.setScale(0.9 + Math.sin(orb.wobble * 1.4) * 0.12);
    }
  }

  clear(): void {
    for (const orb of this.orbs) {
      orb.view.destroy();
    }
    this.orbs.length = 0;
  }

  destroy(): void {
    this.clear();
  }
}
