import Phaser from 'phaser';
import { CRATE } from '../config/crate';
import { ENV_WORLD } from '../config/environment';
import { audio } from '../audio';
import { isInAttackArc } from '../combat/hitDetection';
import { listProjectilePoses } from '../combat/projectileRegistry';
import { pointInRect } from './geometry';
import type { NinjaBody } from '../heroes/NinjaBody';
import type { XpOrbWorld } from '../match/XpOrbWorld';
import { onWorldStrike, type WorldStrikeEvent } from '../match/objectives/worldStrike';
import { ENV } from './palette';
import { FONTS, hex } from '../ui/theme';
import { textureKeyFor } from './obstacles';
import { damageStateOf, decorateObstacle } from './envProps';
import type { DamageState, MapObstacle, PhysicsClass } from './types';
import type { MapView } from './render';
import type { MapWorld } from './world';

export type CrateHooks = {
  heroes: () => readonly NinjaBody[];
  orbs?: XpOrbWorld;
  grantXp?: (hero: NinjaBody, amount: number) => void;
};

export type EnvFact = {
  id: string;
  kind: MapObstacle['kind'];
  physics: PhysicsClass;
  state: DamageState;
  x: number;
  y: number;
  hpRatio: number;
  explosive: boolean;
  enterable: boolean;
};

export type EnvSnapshot = {
  nearby: EnvFact[];
  crate?: EnvFact;
  barrel?: EnvFact;
  wall?: EnvFact;
  tree?: EnvFact;
  building?: EnvFact;
  cover?: EnvFact;
};

type LiveProp = {
  obs: MapObstacle;
  hp: number;
  maxHp: number;
  state: DamageState;
  physics: PhysicsClass;
  sprite?: Phaser.GameObjects.Image;
  roof?: Phaser.GameObjects.Image;
  floor?: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  ang: number;
  angVel: number;
  knockedAt: number;
  lastSmokeAt: number;
  spawn: MapObstacle;
  gone: boolean;
  respawnAt: number;
  arming: boolean;
};

type Scar = {
  x: number;
  y: number;
  kind: 'crack' | 'rubble' | 'burn' | 'hole';
  w: number;
  h: number;
};

type Pickup = {
  view: Phaser.GameObjects.Container;
  kind: 'health' | 'shield';
  target: NinjaBody;
  bornAt: number;
};

type Fx = { view: Phaser.GameObjects.GameObject; until: number };

const copyObstacle = (obs: MapObstacle): MapObstacle => ({
  ...obs,
  collision: { ...obs.collision },
  visual: { ...obs.visual },
  keepout: { ...obs.keepout },
  interior: obs.interior ? { ...obs.interior } : undefined,
});

const impulseFor = (event: WorldStrikeEvent): number => {
  const mul = event.impulse ?? 1;
  if (event.kind === 'explosion') {
    return ENV_WORLD.explosionPush * mul;
  }
  if (event.kind === 'ability') {
    return ENV_WORLD.abilityPush * mul;
  }
  if (event.kind === 'dash') {
    return ENV_WORLD.dashPush * mul;
  }
  return (mul > 1.2 ? ENV_WORLD.heavyPush : ENV_WORLD.lightPush) * mul;
};

export class EnvironmentWorld {
  private readonly props: LiveProp[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly fx: Fx[] = [];
  private readonly scars: Scar[] = [];
  private readonly scarGfx: Phaser.GameObjects.Graphics;
  private readonly swingHits = new WeakMap<NinjaBody, Map<string, number>>();
  private readonly shotHits = new Set<string>();
  private offStrike?: () => void;
  private hooks: CrateHooks = { heroes: () => [] };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: MapWorld,
    private readonly view: MapView,
  ) {
    this.scarGfx = scene.add.graphics().setDepth(2);
    for (const obs of world.layout.obstacles) {
      this.props.push(this.liveFrom(obs));
    }
    this.offStrike = onWorldStrike((event) => this.onStrike(event));
  }

  configure(hooks: CrateHooks): void {
    this.hooks = hooks;
  }

  snapshot(x: number, y: number, radius: number = ENV_WORLD.snapshotRadius): EnvSnapshot {
    const nearby: EnvFact[] = [];
    let crate: EnvFact | undefined;
    let barrel: EnvFact | undefined;
    let wall: EnvFact | undefined;
    let tree: EnvFact | undefined;
    let building: EnvFact | undefined;
    let cover: EnvFact | undefined;
    for (const prop of this.props) {
      if (prop.gone || prop.hp <= 0 && prop.state === 'destroyed' && prop.obs.kind === 'crate') {
        continue;
      }
      const dist = Math.hypot(prop.obs.x - x, prop.obs.y - y);
      if (dist > radius) {
        continue;
      }
      const fact: EnvFact = {
        id: prop.obs.id,
        kind: prop.obs.kind,
        physics: prop.physics,
        state: prop.state,
        x: prop.obs.x,
        y: prop.obs.y,
        hpRatio: prop.hp / Math.max(1, prop.maxHp),
        explosive: Boolean(prop.obs.explosive),
        enterable: Boolean(prop.obs.enterable),
      };
      nearby.push(fact);
      if (fact.kind === 'crate' && (!crate || dist < Math.hypot(crate.x - x, crate.y - y))) {
        crate = fact;
      }
      if (fact.explosive && (!barrel || dist < Math.hypot(barrel.x - x, barrel.y - y))) {
        barrel = fact;
      }
      if (fact.kind === 'wall' && fact.physics === 'breakable' && (!wall || dist < Math.hypot(wall.x - x, wall.y - y))) {
        wall = fact;
      }
      if (fact.kind === 'tree' && (!tree || dist < Math.hypot(tree.x - x, tree.y - y))) {
        tree = fact;
      }
      if (fact.enterable && (!building || dist < Math.hypot(building.x - x, building.y - y))) {
        building = fact;
      }
      if (
        (fact.kind === 'barricade' || fact.kind === 'sandbag' || fact.kind === 'wall') &&
        fact.state !== 'destroyed' &&
        fact.state !== 'knocked' &&
        (!cover || dist < Math.hypot(cover.x - x, cover.y - y))
      ) {
        cover = fact;
      }
    }
    return { nearby, crate, barrel, wall, tree, building, cover };
  }

  update(now: number, delta: number): void {
    this.collectProjectiles();
    this.tickPhysics(now, delta);
    this.tickRoofs();
    this.tickSmoke(now);
    this.tickPickups(now, delta);
    this.tickFx(now);
    this.tickRespawns(now);
  }

  destroy(): void {
    this.offStrike?.();
    this.offStrike = undefined;
    for (const pickup of this.pickups) {
      pickup.view.destroy();
    }
    this.pickups.length = 0;
    for (const item of this.fx) {
      item.view.destroy();
    }
    this.fx.length = 0;
    this.scars.length = 0;
    this.scarGfx.destroy();
    this.props.length = 0;
  }

  private liveFrom(obs: MapObstacle): LiveProp {
    return {
      obs,
      hp: obs.hp ?? obs.maxHp ?? 1,
      maxHp: obs.maxHp ?? obs.hp ?? 1,
      state: obs.damageState ?? 'intact',
      physics: obs.physicsClass ?? 'static',
      sprite: this.view.sprites.get(obs.id) ?? this.view.crateSprites.get(obs.id),
      roof: this.view.roofs.get(obs.id),
      floor: this.view.floors.get(obs.id),
      vx: 0,
      vy: 0,
      ang: 0,
      angVel: 0,
      knockedAt: 0,
      lastSmokeAt: 0,
      spawn: copyObstacle(obs),
      gone: false,
      respawnAt: 0,
      arming: false,
    };
  }

  private onStrike(event: WorldStrikeEvent): void {
    const hits = this.swingHits.get(event.attacker) ?? new Map<string, number>();
    this.swingHits.set(event.attacker, hits);
    if (event.kind === 'ability' || event.kind === 'explosion') {
      const dx = event.dirX ?? event.attacker.aim.x;
      const dy = event.dirY ?? event.attacker.aim.y;
      const len = Math.hypot(dx, dy) || 1;
      this.scarAt(event.attacker.x + (dx / len) * event.reach * 0.55, event.attacker.y + (dy / len) * event.reach * 0.55, event.kind);
    }
    for (const prop of this.props) {
      if (prop.gone || hits.get(prop.obs.id) === event.now) {
        continue;
      }
      if (!this.inReach(event, prop)) {
        continue;
      }
      hits.set(prop.obs.id, event.now);
      this.hit(prop, event.damage, event, event.attacker);
    }
  }

  private inReach(event: WorldStrikeEvent, prop: LiveProp): boolean {
    const halfArc = (event.attacker.stats.attackArcDegrees * Math.PI) / 360;
    const radius = Math.max(prop.obs.collision.w, prop.obs.collision.h) * 0.48;
    return isInAttackArc(
      event.attacker.x,
      event.attacker.y,
      event.dirX ?? event.attacker.aim.x,
      event.dirY ?? event.attacker.aim.y,
      prop.obs.x,
      prop.obs.y,
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
      for (const prop of this.props) {
        if (prop.gone) {
          continue;
        }
        const key = `${pose.id}:${prop.obs.id}`;
        if (this.shotHits.has(key)) {
          continue;
        }
        const radius = Math.max(prop.obs.collision.w, prop.obs.collision.h) * 0.45;
        if (Math.hypot(pose.x - prop.obs.x, pose.y - prop.obs.y) > radius + pose.radius) {
          continue;
        }
        this.shotHits.add(key);
        const owner = this.hooks.heroes().find((hero) => hero.team === pose.team && hero.isPresent && !hero.down);
        const dummy: WorldStrikeEvent = {
          attacker: owner ?? this.hooks.heroes()[0],
          now: this.scene.time.now,
          damage: Math.max(8, (owner?.stats.attackDamage ?? 12) * 0.85),
          reach: 8,
          kind: 'ability',
          dirX: pose.x - prop.obs.x,
          dirY: pose.y - prop.obs.y,
          impulse: 1.15,
        };
        if (!dummy.attacker) {
          continue;
        }
        this.hit(prop, dummy.damage, dummy, owner);
      }
    }
  }

  private hit(prop: LiveProp, amount: number, event: WorldStrikeEvent, attacker?: NinjaBody): void {
    if (amount <= 0 || prop.gone || prop.arming) {
      return;
    }
    if (prop.physics === 'static' && !prop.obs.destructible) {
      prop.hp = Math.max(1, prop.hp - amount * 0.2);
      this.syncState(prop);
      this.flash(prop, 0xc8a070);
      return;
    }
    prop.hp -= amount;
    audio.play('crate-hit', { x: prop.obs.x, y: prop.obs.y });
    this.flash(prop, 0xffe6c0);
    this.push(prop, event);
    this.syncState(prop);
    if (prop.hp > 0) {
      return;
    }
    if (prop.obs.kind === 'vehicle' && prop.obs.variant === 'car') {
      this.armCar(prop, attacker);
      return;
    }
    if (prop.obs.explosive || prop.physics === 'explosive') {
      this.explode(prop, attacker);
      return;
    }
    if (prop.physics === 'lightweight') {
      this.knockDown(prop, event);
      return;
    }
    this.destroyProp(prop, attacker);
  }

  private push(prop: LiveProp, event: WorldStrikeEvent): void {
    if (prop.physics !== 'lightweight' && prop.state !== 'knocked') {
      return;
    }
    const force = impulseFor(event);
    let dx = event.dirX ?? event.attacker.aim.x;
    let dy = event.dirY ?? event.attacker.aim.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const mass = ENV_WORLD.treeMass;
    prop.vx += (dx * force) / mass;
    prop.vy += (dy * force) / mass;
    prop.angVel += (dx - dy) * 0.012 * force;
  }

  private syncState(prop: LiveProp): void {
    const prev = prop.state;
    prop.state = damageStateOf(prop.hp, prop.maxHp, prop.state === 'knocked');
    prop.obs.damageState = prop.state;
    prop.obs.hp = prop.hp;
    const sprite = prop.sprite;
    if (!sprite) {
      return;
    }
    if (prop.obs.kind === 'wall' || prop.obs.kind === 'vehicle') {
      sprite.setTexture(textureKeyFor(prop.obs));
      sprite.setDisplaySize(prop.obs.visual.w, prop.obs.visual.h);
    }
    if (prop.state === 'damaged') {
      sprite.setTint(0xd8c4a0);
      if (prev === 'intact' && prop.obs.kind === 'tree') {
        this.scene.tweens.add({
          targets: sprite,
          angle: sprite.angle + 7,
          duration: 90,
          yoyo: true,
          repeat: 1,
        });
      }
    } else if (prop.state === 'cracked') {
      sprite.setTint(0xb09070);
    }
  }

  private knockDown(prop: LiveProp, event: WorldStrikeEvent): void {
    if (prop.state === 'knocked') {
      return;
    }
    prop.state = 'knocked';
    prop.obs.damageState = 'knocked';
    prop.knockedAt = this.scene.time.now;
    this.world.setBlocking(prop.obs.id, false);
    this.push(prop, event);
    prop.angVel += 2.4;
    const sprite = prop.sprite;
    if (sprite) {
      this.scene.tweens.add({
        targets: sprite,
        angle: sprite.angle + (prop.vx >= 0 ? 82 : -82),
        duration: 280,
        ease: 'Cubic.easeOut',
      });
    }
    this.puff(prop.obs.x, prop.obs.y, ENV.dirt, 0.7);
  }

  private destroyProp(prop: LiveProp, attacker?: NinjaBody): void {
    if (prop.gone) {
      return;
    }
    prop.gone = true;
    prop.state = 'destroyed';
    prop.obs.damageState = 'destroyed';
    this.world.setBlocking(prop.obs.id, false);
    if (prop.obs.kind !== 'crate') {
      this.world.removeObstacle(prop.obs.id);
    }
    if (prop.sprite) {
      this.scene.tweens.killTweensOf(prop.sprite);
      prop.sprite.destroy();
      prop.sprite = undefined;
    }
    if (prop.roof) {
      this.scene.tweens.killTweensOf(prop.roof);
      prop.roof.destroy();
      prop.roof = undefined;
      this.view.roofs.delete(prop.obs.id);
    }
    if (prop.floor) {
      prop.floor.destroy();
      prop.floor = undefined;
      this.view.floors.delete(prop.obs.id);
    }
    audio.play('crate-break', { x: prop.obs.x, y: prop.obs.y });
    this.puff(prop.obs.x, prop.obs.y, prop.obs.kind === 'crate' ? ENV.crateLite : ENV.concreteLite, 0.9);
    this.stain(prop.obs.x, prop.obs.y);
    if (prop.obs.kind === 'crate') {
      this.breakCrate(prop, attacker);
    }
  }

  private explode(prop: LiveProp, attacker?: NinjaBody): void {
    const { x, y } = prop.obs;
    const car = prop.obs.kind === 'vehicle';
    const radius = car ? ENV_WORLD.carRadius : ENV_WORLD.barrelRadius;
    const damage = car ? ENV_WORLD.carDamage : ENV_WORLD.barrelDamage;
    const knock = car ? ENV_WORLD.carKnockback : ENV_WORLD.barrelKnockback;
    this.destroyProp(prop, attacker);
    this.burst(x, y, radius);
    this.scarBlast(x, y, radius);
    for (const other of this.props) {
      if (other.gone || other === prop || other.arming) {
        continue;
      }
      const dist = Math.hypot(other.obs.x - x, other.obs.y - y);
      if (dist > radius + 8) {
        continue;
      }
      const falloff = 1 - dist / (radius + 8);
      const fake: WorldStrikeEvent = {
        attacker: attacker ?? this.hooks.heroes()[0],
        now: this.scene.time.now,
        damage: damage * falloff,
        reach: radius,
        kind: 'explosion',
        dirX: other.obs.x - x,
        dirY: other.obs.y - y,
        impulse: car ? 1.35 : 1.7,
      };
      if (!fake.attacker) {
        continue;
      }
      this.hit(other, fake.damage, fake, attacker);
    }
    for (const hero of this.hooks.heroes()) {
      if (!hero.isPresent || hero.down) {
        continue;
      }
      const dist = Math.hypot(hero.x - x, hero.y - y);
      if (dist > radius) {
        continue;
      }
      const falloff = 1 - dist / radius;
      const dx = hero.x - x;
      const dy = hero.y - y;
      const len = Math.hypot(dx, dy) || 1;
      hero.takeHit({
        damage: Math.round(damage * falloff),
        dirX: dx / len,
        dirY: dy / len,
        knockback: knock * falloff,
        staminaDamage: 4,
        step: 2,
      });
    }
  }

  private breakCrate(prop: LiveProp, attacker?: NinjaBody): void {
    const { x, y } = prop.obs;
    this.world.removeObstacle(prop.obs.id);
    this.view.crateSprites.delete(prop.obs.id);
    prop.respawnAt = this.scene.time.now + CRATE.respawnMs;
    this.dropRewards(x, y, attacker);
  }

  private tickRespawns(now: number): void {
    for (const prop of this.props) {
      if (!prop.gone || prop.obs.kind !== 'crate' || prop.respawnAt <= 0 || now < prop.respawnAt) {
        continue;
      }
      const spawn = copyObstacle(prop.spawn);
      decorateObstacle(spawn);
      if (this.occupied(spawn.x, spawn.y, ENV_WORLD.crateOccupiedPad)) {
        prop.respawnAt = now + 900;
        continue;
      }
      this.world.restoreObstacle(spawn);
      const image = this.scene.add.image(spawn.x, spawn.y, textureKeyFor(spawn));
      image.setDepth(4);
      image.setDisplaySize(spawn.visual.w, spawn.visual.h);
      this.view.sprites.set(spawn.id, image);
      this.view.crateSprites.set(spawn.id, image);
      prop.obs = spawn;
      prop.hp = spawn.maxHp ?? CRATE.maxHealth;
      prop.maxHp = spawn.maxHp ?? CRATE.maxHealth;
      prop.state = 'intact';
      prop.sprite = image;
      prop.gone = false;
      prop.respawnAt = 0;
    }
  }

  private occupied(x: number, y: number, pad: number): boolean {
    return this.hooks.heroes().some((hero) => hero.isPresent && Math.hypot(hero.x - x, hero.y - y) < pad);
  }

  private tickPhysics(now: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    for (const prop of this.props) {
      if (prop.gone) {
        continue;
      }
      if (prop.state === 'knocked') {
        this.tickKnocked(prop, now, dt);
      }
      this.pushFromWalkers(prop, dt);
    }
  }

  private tickKnocked(prop: LiveProp, now: number, dt: number): void {
    prop.vx *= Math.max(0, 1 - ENV_WORLD.treeDrag * dt);
    prop.vy *= Math.max(0, 1 - ENV_WORLD.treeDrag * dt);
    prop.angVel *= Math.max(0, 1 - ENV_WORLD.treeAngularDrag * dt);
    prop.obs.x += prop.vx * dt;
    prop.obs.y += prop.vy * dt;
    prop.ang += prop.angVel * dt;
    const playable = this.world.layout.playable;
    prop.obs.x = Math.max(playable.x + 18, Math.min(playable.x + playable.w - 18, prop.obs.x));
    prop.obs.y = Math.max(playable.y + 18, Math.min(playable.y + playable.h - 18, prop.obs.y));
    if (prop.sprite) {
      prop.sprite.setPosition(prop.obs.x, prop.obs.y);
      prop.sprite.angle += prop.angVel * dt * 12;
    }
    const lived = now - prop.knockedAt;
    const life = prop.obs.kind === 'vehicle' ? ENV_WORLD.wreckLifeMs : ENV_WORLD.knockedLifetimeMs;
    if (prop.obs.kind === 'vehicle' && lived > 1600 && prop.obs.blocksMovement) {
      this.world.setBlocking(prop.obs.id, false);
    }
    if (lived > life - ENV_WORLD.knockFadeMs && prop.sprite) {
      prop.sprite.setAlpha(Math.max(0, 1 - (lived - (life - ENV_WORLD.knockFadeMs)) / ENV_WORLD.knockFadeMs));
    }
    if (lived >= life) {
      this.destroyProp(prop);
    }
  }

  private pushFromWalkers(prop: LiveProp, dt: number): void {
    if (prop.state !== 'knocked' && prop.physics !== 'lightweight') {
      return;
    }
    if (prop.state !== 'knocked') {
      return;
    }
    const radius = Math.max(14, Math.max(prop.obs.collision.w, prop.obs.collision.h) * 0.4);
    for (const hero of this.hooks.heroes()) {
      if (!hero.isPresent || hero.down) {
        continue;
      }
      const dx = prop.obs.x - hero.x;
      const dy = prop.obs.y - hero.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + 12 || dist < 1) {
        continue;
      }
      const body = hero.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      const speed = body ? Math.hypot(body.velocity.x, body.velocity.y) : 0;
      if (speed < 20) {
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      prop.vx += nx * ENV_WORLD.walkPush * dt * 8;
      prop.vy += ny * ENV_WORLD.walkPush * dt * 8;
      if (body) {
        body.velocity.scale(ENV_WORLD.treeWalkSlow);
      }
    }
  }

  private armCar(prop: LiveProp, attacker?: NinjaBody): void {
    if (prop.arming || prop.gone) {
      return;
    }
    prop.arming = true;
    prop.hp = 0;
    prop.state = 'cracked';
    prop.obs.damageState = 'cracked';
    const sprite = prop.sprite;
    if (sprite) {
      sprite.setTexture(textureKeyFor(prop.obs));
      sprite.setDisplaySize(prop.obs.visual.w, prop.obs.visual.h);
    }
    const flashes = ENV_WORLD.carFlashCount;
    const pulse = ENV_WORLD.carFlashMs;
    for (let i = 0; i < flashes; i += 1) {
      this.scene.time.delayedCall(i * pulse * 2, () => {
        if (prop.gone || !prop.sprite) {
          return;
        }
        prop.sprite.setTint(0xf03b45);
      });
      this.scene.time.delayedCall(i * pulse * 2 + pulse, () => {
        if (prop.gone || !prop.sprite) {
          return;
        }
        prop.sprite.setTint(0xd0a090);
      });
    }
    this.scene.time.delayedCall(flashes * pulse * 2, () => {
      if (prop.gone) {
        return;
      }
      this.explode(prop, attacker);
    });
  }

  private tickRoofs(): void {
    const heroes = this.hooks.heroes();
    for (const prop of this.props) {
      if (prop.gone || prop.obs.kind !== 'building') {
        continue;
      }
      const room = prop.obs.interior ?? prop.obs.visual;
      const inside = heroes.some((hero) => hero.isPresent && pointInRect(hero.x, hero.y - 10, room));
      const target = inside ? ENV_WORLD.roofInsideAlpha : ENV_WORLD.roofOutsideAlpha;
      const roof = prop.roof ?? (prop.obs.enterable ? undefined : prop.sprite);
      if (!roof) {
        continue;
      }
      roof.setAlpha(roof.alpha + (target - roof.alpha) * 0.22);
    }
  }

  private tickSmoke(now: number): void {
    for (const prop of this.props) {
      if (prop.gone || prop.obs.kind !== 'vehicle') {
        continue;
      }
      if (prop.state !== 'damaged' && prop.state !== 'cracked' && prop.state !== 'knocked') {
        continue;
      }
      if (now - prop.lastSmokeAt < ENV_WORLD.smokeGapMs || this.fx.length >= ENV_WORLD.maxFx) {
        continue;
      }
      prop.lastSmokeAt = now;
      const puff = this.scene.add.graphics().setDepth(8);
      puff.fillStyle(ENV.inkSoft, prop.state === 'knocked' ? 0.45 : 0.28);
      puff.fillCircle(prop.obs.x + 8, prop.obs.y - 16, 7);
      this.scene.tweens.add({
        targets: puff,
        alpha: 0,
        y: puff.y - 18,
        duration: 420,
        onComplete: () => puff.destroy(),
      });
      this.fx.push({ view: puff, until: now + 420 });
    }
  }

  private flash(prop: LiveProp, tint: number): void {
    const sprite = prop.sprite;
    if (!sprite) {
      return;
    }
    sprite.setTint(tint);
    this.scene.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * 1.04,
      scaleY: sprite.scaleY * 1.04,
      duration: CRATE.hitFlashMs,
      yoyo: true,
      onComplete: () => {
        if (prop.state === 'intact') {
          sprite.clearTint();
        }
      },
    });
  }

  private puff(x: number, y: number, color: number, alpha: number): void {
    if (this.fx.length >= ENV_WORLD.maxFx) {
      const old = this.fx.shift();
      old?.view.destroy();
    }
    const puff = this.scene.add.graphics().setDepth(22);
    puff.fillStyle(color, alpha);
    puff.fillRect(x - 14, y - 10, 28, 18);
    this.scene.tweens.add({
      targets: puff,
      alpha: 0,
      duration: ENV_WORLD.fxLifeMs,
      onComplete: () => puff.destroy(),
    });
    this.fx.push({ view: puff, until: this.scene.time.now + ENV_WORLD.fxLifeMs });
  }

  private stain(x: number, y: number): void {
    const stain = this.scene.add.graphics().setDepth(2);
    stain.fillStyle(ENV.woodDark, 0.55);
    stain.fillRect(x - 16, y + 2, 32, 8);
    this.fx.push({ view: stain, until: this.scene.time.now + ENV_WORLD.stainLifeMs });
  }

  private burst(x: number, y: number, radius: number): void {
    const puff = this.scene.add.graphics().setDepth(22).setPosition(x, y);
    puff.fillStyle(ENV.fire, 0.95);
    puff.fillCircle(0, 0, Math.max(18, radius * 0.28));
    puff.fillStyle(ENV.fireCore, 0.95);
    puff.fillCircle(0, 0, Math.max(8, radius * 0.12));
    puff.fillStyle(0xf6f1de, 0.7);
    puff.fillCircle(0, 0, 6);
    this.scene.tweens.add({
      targets: puff,
      alpha: 0,
      scaleX: 2.4,
      scaleY: 2.4,
      duration: 420,
      onComplete: () => puff.destroy(),
    });
    this.fx.push({ view: puff, until: this.scene.time.now + 420 });
    const ring = this.scene.add.graphics().setDepth(21).setPosition(x, y);
    ring.lineStyle(5, ENV.fire, 0.9);
    ring.strokeCircle(0, 0, 10);
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: Math.max(3, radius / 14),
      scaleY: Math.max(3, radius / 14),
      duration: 360,
      onComplete: () => ring.destroy(),
    });
    this.fx.push({ view: ring, until: this.scene.time.now + 360 });
  }

  private onPavement(x: number, y: number): boolean {
    return this.world.layout.roads.patches.some(
      (patch) =>
        patch.kind !== 'sidewalk' &&
        x >= patch.x &&
        x <= patch.x + patch.w &&
        y >= patch.y &&
        y <= patch.y + patch.h,
    );
  }

  private scarAt(x: number, y: number, cause: WorldStrikeEvent['kind']): void {
    const road = this.onPavement(x, y);
    if (cause === 'explosion') {
      this.pushScar({ x, y, kind: road ? 'rubble' : 'burn', w: road ? 28 : 34, h: road ? 16 : 22 });
      return;
    }
    this.pushScar({
      x,
      y,
      kind: road ? 'crack' : 'burn',
      w: road ? 22 : 18,
      h: road ? 5 : 14,
    });
  }

  private scarBlast(x: number, y: number, radius: number): void {
    this.scarAt(x, y, 'explosion');
    this.pushScar({ x: x - 10, y: y + 6, kind: this.onPavement(x, y) ? 'crack' : 'hole', w: 26, h: 8 });
    this.pushScar({ x: x + radius * 0.28, y: y - 8, kind: this.onPavement(x + 12, y) ? 'rubble' : 'burn', w: 20, h: 12 });
    this.pushScar({ x: x - radius * 0.22, y: y + 10, kind: 'hole', w: 16, h: 12 });
  }

  private pushScar(scar: Scar): void {
    if (this.scars.length >= ENV_WORLD.maxScars) {
      this.scars.shift();
    }
    this.scars.push(scar);
    this.redrawScars();
  }

  private redrawScars(): void {
    const g = this.scarGfx;
    g.clear();
    for (const scar of this.scars) {
      if (scar.kind === 'crack') {
        g.fillStyle(ENV.inkSoft, 0.85);
        g.fillRect(scar.x - scar.w / 2, scar.y - scar.h / 2, scar.w, scar.h);
        g.fillRect(scar.x - 4, scar.y, scar.w * 0.45, 3);
        continue;
      }
      if (scar.kind === 'rubble') {
        g.fillStyle(ENV.asphaltDark, 0.95);
        g.fillRect(scar.x - scar.w / 2, scar.y - scar.h / 2, scar.w, scar.h);
        g.fillStyle(ENV.concreteDark, 0.9);
        g.fillRect(scar.x - 6, scar.y - 3, 10, 7);
        g.fillStyle(ENV.dirt, 0.7);
        g.fillRect(scar.x + 2, scar.y, 8, 5);
        continue;
      }
      if (scar.kind === 'hole') {
        g.fillStyle(ENV.ink, 0.9);
        g.fillRect(scar.x - scar.w / 2, scar.y - scar.h / 2, scar.w, scar.h);
        g.fillStyle(ENV.dirtDark, 0.95);
        g.fillRect(scar.x - scar.w / 2 + 2, scar.y - scar.h / 2 + 2, scar.w - 4, scar.h - 4);
        continue;
      }
      g.fillStyle(0x1a120c, 0.8);
      g.fillRect(scar.x - scar.w / 2, scar.y - scar.h / 2, scar.w, scar.h);
      g.fillStyle(0x2a1c14, 0.7);
      g.fillRect(scar.x - scar.w / 3, scar.y - scar.h / 3, scar.w * 0.5, scar.h * 0.5);
    }
  }

  private dropRewards(x: number, y: number, attacker?: NinjaBody): void {
    const target = attacker && attacker.isPresent && !attacker.down ? attacker : this.nearestHero(x, y);
    if (!target) {
      return;
    }
    this.hooks.orbs?.spawn(x + 28, y - 26, target, 0, target.team, { visual: true, delayMs: 360 });
    this.hooks.grantXp?.(target, CRATE.xp);
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

  private tickFx(now: number): void {
    for (let i = this.fx.length - 1; i >= 0; i -= 1) {
      if (now < this.fx[i].until) {
        continue;
      }
      this.fx[i].view.destroy();
      this.fx.splice(i, 1);
    }
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
