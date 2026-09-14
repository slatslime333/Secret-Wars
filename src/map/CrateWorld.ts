import Phaser from 'phaser';
import { CRATE } from '../config/crate';
import { audio } from '../audio';
import { isInAttackArc } from '../combat/hitDetection';
import { listProjectilePoses } from '../combat/projectileRegistry';
import type { NinjaBody } from '../heroes/NinjaBody';
import type { XpOrbWorld } from '../match/XpOrbWorld';
import { onWorldStrike, type WorldStrikeEvent } from '../match/objectives/worldStrike';
import { ENV } from './palette';
import { FONTS, hex } from '../ui/theme';
import type { MapObstacle } from './types';
import type { MapView } from './render';
import type { MapWorld } from './world';

export type CrateHooks = {
  heroes: () => readonly NinjaBody[];
  orbs?: XpOrbWorld;
  grantXp?: (hero: NinjaBody, amount: number) => void;
};

type LiveCrate = {
  obs: MapObstacle;
  hp: number;
  sprite?: Phaser.GameObjects.Image;
};

type Pickup = {
  view: Phaser.GameObjects.Container;
  kind: 'health' | 'shield';
  target: NinjaBody;
  bornAt: number;
};

export class CrateWorld {
  private readonly crates: LiveCrate[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly swingHits = new WeakMap<NinjaBody, Map<string, number>>();
  private readonly shotHits = new Set<string>();
  private offStrike?: () => void;
  private hooks: CrateHooks = { heroes: () => [] };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: MapWorld,
    view: MapView,
  ) {
    for (const obs of world.layout.obstacles) {
      if (obs.kind !== 'crate') {
        continue;
      }
      this.crates.push({
        obs,
        hp: obs.hp ?? CRATE.maxHealth,
        sprite: view.crateSprites.get(obs.id),
      });
    }
    this.offStrike = onWorldStrike((event) => this.onStrike(event));
  }

  configure(hooks: CrateHooks): void {
    this.hooks = hooks;
  }

  update(now: number, delta: number): void {
    this.collectProjectiles();
    this.tickPickups(now, delta);
  }

  destroy(): void {
    this.offStrike?.();
    this.offStrike = undefined;
    for (const pickup of this.pickups) {
      pickup.view.destroy();
    }
    this.pickups.length = 0;
    this.crates.length = 0;
  }

  private onStrike(event: WorldStrikeEvent): void {
    const hits = this.swingHits.get(event.attacker) ?? new Map<string, number>();
    this.swingHits.set(event.attacker, hits);
    for (const crate of [...this.crates]) {
      if (hits.get(crate.obs.id) === event.now) {
        continue;
      }
      if (!this.inReach(event, crate)) {
        continue;
      }
      hits.set(crate.obs.id, event.now);
      this.damage(crate, event.damage, event.attacker);
    }
  }

  private inReach(event: WorldStrikeEvent, crate: LiveCrate): boolean {
    const halfArc = (event.attacker.stats.attackArcDegrees * Math.PI) / 360;
    const radius = Math.max(crate.obs.collision.w, crate.obs.collision.h) * 0.45;
    return isInAttackArc(
      event.attacker.x,
      event.attacker.y,
      event.attacker.aim.x,
      event.attacker.aim.y,
      crate.obs.x,
      crate.obs.y,
      event.reach,
      halfArc,
      radius,
    );
  }

  private collectProjectiles(): void {
    for (const pose of listProjectilePoses()) {
      if (!pose.team) {
        continue;
      }
      for (const crate of [...this.crates]) {
        const key = `${pose.id}:${crate.obs.id}`;
        if (this.shotHits.has(key)) {
          continue;
        }
        const radius = Math.max(crate.obs.collision.w, crate.obs.collision.h) * 0.45;
        if (Math.hypot(pose.x - crate.obs.x, pose.y - crate.obs.y) > radius + pose.radius) {
          continue;
        }
        this.shotHits.add(key);
        const owner = this.hooks.heroes().find((hero) => hero.team === pose.team && hero.isPresent && !hero.down);
        this.damage(crate, Math.max(8, (owner?.stats.attackDamage ?? 12) * 0.85), owner);
      }
    }
  }

  private damage(crate: LiveCrate, amount: number, attacker?: NinjaBody): void {
    if (amount <= 0) {
      return;
    }
    crate.hp -= amount;
    audio.play('crate-hit', { x: crate.obs.x, y: crate.obs.y });
    const sprite = crate.sprite;
    if (sprite) {
      sprite.setTint(0xffe6c0);
      this.scene.tweens.add({
        targets: sprite,
        scaleX: sprite.scaleX * 1.06,
        scaleY: sprite.scaleY * 1.06,
        duration: CRATE.hitFlashMs,
        yoyo: true,
        onComplete: () => sprite.clearTint(),
      });
    }
    if (crate.hp <= CRATE.maxHealth * 0.5 && sprite) {
      sprite.setTint(0xc8a070);
    }
    if (crate.hp <= 0) {
      this.breakCrate(crate, attacker);
    }
  }

  private breakCrate(crate: LiveCrate, attacker?: NinjaBody): void {
    const { x, y } = crate.obs;
    this.crates.splice(this.crates.indexOf(crate), 1);
    this.world.removeObstacle(crate.obs.id);
    if (crate.sprite) {
      this.scene.tweens.killTweensOf(crate.sprite);
      crate.sprite.destroy();
    }
    audio.play('crate-break', { x, y });
    this.burst(x, y);
    this.dropRewards(x, y, attacker);
  }

  private burst(x: number, y: number): void {
    const stain = this.scene.add.graphics().setDepth(2);
    stain.fillStyle(ENV.woodDark, 0.95);
    stain.fillRect(x - 20, y + 4, 40, 12);
    stain.fillStyle(ENV.dirt, 1);
    stain.fillRect(x - 12, y + 2, 18, 8);

    const puff = this.scene.add.graphics().setDepth(22);
    puff.fillStyle(ENV.crateLite, 0.95);
    puff.fillRect(x - 16, y - 12, 32, 20);
    for (let i = 0; i < CRATE.shardCount; i += 1) {
      const ang = (Math.PI * 2 * i) / CRATE.shardCount;
      puff.fillStyle(i % 2 === 0 ? ENV.crate : ENV.crateDark, 1);
      puff.fillRect(x + Math.cos(ang) * 16 - 6, y + Math.sin(ang) * 12 - 3, 12, 7);
    }
    this.scene.tweens.add({
      targets: puff,
      alpha: 0,
      duration: 560,
      onComplete: () => puff.destroy(),
    });

    const label = this.scene.add
      .text(x, y - 30, `+${CRATE.xp} XP`, {
        fontFamily: FONTS.body,
        fontSize: '14px',
        fontStyle: 'bold',
        color: hex(0xe8e0cc),
        stroke: hex(ENV.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.scene.tweens.add({
      targets: label,
      y: y - 52,
      alpha: 0,
      duration: 720,
      onComplete: () => label.destroy(),
    });
  }

  private dropRewards(x: number, y: number, attacker?: NinjaBody): void {
    const target = attacker && attacker.isPresent && !attacker.down ? attacker : this.nearestHero(x, y);
    if (!target) {
      return;
    }
    this.hooks.orbs?.spawn(x + 28, y - 26, target, 0, target.team, { visual: true, delayMs: 360 });
    this.hooks.grantXp?.(target, CRATE.xp);
    if (Math.random() < CRATE.bonusXpChance) {
      this.hooks.orbs?.spawn(x - 22, y - 20, target, 0, target.team, { visual: true, delayMs: 420 });
      this.hooks.grantXp?.(target, CRATE.bonusXp);
    }
    if (Math.random() < CRATE.healthChance) {
      this.spawnPickup(x + 20, y - 18, 'health', target);
    } else if (Math.random() < CRATE.shieldChance) {
      this.spawnPickup(x - 16, y - 18, 'shield', target);
    }
  }

  private spawnPickup(x: number, y: number, kind: 'health' | 'shield', target: NinjaBody): void {
    const color = kind === 'health' ? 0xf03b45 : 0x49dce1;
    const disc = this.scene.add.circle(0, 0, 9, color, 0.95).setStrokeStyle(1.6, 0xf6f1de, 0.95);
    const glyph = this.scene.add.rectangle(0, 0, kind === 'health' ? 8 : 6, 3, 0xf6f1de, 1);
    const view = this.scene.add.container(x, y, [disc, glyph]).setDepth(28);
    this.pickups.push({ view, kind, target, bornAt: this.scene.time.now });
  }

  private tickPickups(now: number, delta: number): void {
    const dt = delta / 1000;
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      if (!pickup.target.isPresent || pickup.target.down || now - pickup.bornAt > 3200) {
        pickup.view.destroy();
        this.pickups.splice(i, 1);
        continue;
      }
      if (now - pickup.bornAt < 280) {
        pickup.view.y -= 18 * dt;
        continue;
      }
      const dx = pickup.target.x - pickup.view.x;
      const dy = pickup.target.y - 12 - pickup.view.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 16) {
        this.applyPickup(pickup);
        pickup.view.destroy();
        this.pickups.splice(i, 1);
        continue;
      }
      const speed = 420 * (0.7 + Math.min(1.2, 36 / Math.max(10, dist)));
      pickup.view.x += (dx / dist) * speed * dt;
      pickup.view.y += (dy / dist) * speed * dt;
    }
  }

  private applyPickup(pickup: Pickup): void {
    const body = pickup.target;
    if (pickup.kind === 'health') {
      if (body.health >= body.stats.maxHealth - 0.5) {
        body.applyTempShield(this.scene.time.now, CRATE.shieldAmount, CRATE.shieldMs);
        return;
      }
      body.heal(CRATE.healthAmount);
      return;
    }
    body.applyTempShield(this.scene.time.now, CRATE.shieldAmount, CRATE.shieldMs);
  }

  private nearestHero(x: number, y: number): NinjaBody | undefined {
    let best: NinjaBody | undefined;
    let bestDist = 220;
    for (const hero of this.hooks.heroes()) {
      if (!hero.isPresent || hero.down) {
        continue;
      }
      const dist = Math.hypot(hero.x - x, hero.y - y);
      if (dist < bestDist) {
        best = hero;
        bestDist = dist;
      }
    }
    return best;
  }
}
