import Phaser from 'phaser';
import { playWorld } from '../../../audio';
import { arenaInnerBounds } from '../../../config/arena';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { WITCH_HEX, WITCH_SKELETON, WITCH_TOMBSTONE } from './tunables';
import { canSummonWitchSkeletons, registerWitchSkeleton, witchSummonSlots } from './skeletonPack';
import { drawTombstone } from './vortex';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { drawWitchSkeleton } from '../../drawSkeleton';
import type { MinionWorld } from '../../../minions/MinionWorld';
import type { NinjaBody } from '../../NinjaBody';

export const tombstoneDef: AbilityDef = {
  id: 'witch-tombstone',
  name: 'Tombstone',
  slot: 'ability1',
  cooldownMs: WITCH_TOMBSTONE.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.tombstone,
  accent: 0x9b4dff,
  padLabel: 'TOMB',
  tactics: { roles: ['defense', 'peel', 'space'], range: WITCH_TOMBSTONE.protectRadius },
  canActivate: (ctx) => canSummonWitchSkeletons(ctx.caster) && canStartAbility(ctx),
  activate: (ctx) => new TombstoneAbility(ctx, WITCH_TOMBSTONE.summonCount, WITCH_TOMBSTONE.castMs, false),
};

export class TombstoneAbility implements ActiveAbility {
  readonly id: string;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;
  private readonly emergeAt: number;
  private spawned = false;
  private readonly markers: Phaser.GameObjects.Graphics[] = [];
  private readonly count: number;

  constructor(ctx: AbilityContext, count: number, castMs: number, ultimate: boolean) {
    this.count = count;
    this.id = ultimate ? 'witch-tombstone-ult' : tombstoneDef.id;
    this.until = ctx.now + castMs;
    this.emergeAt = ctx.now + Math.min(WITCH_TOMBSTONE.emergeMs, castMs * 0.45);
    ctx.caster.stop();
    ctx.caster.status.applyControlLock(ctx.now, castMs);
    ctx.caster.playCustomAttack(ctx.now, castMs, (frac) => ({
      staffRaise: Math.min(1, frac * 2.2),
      armLiftRight: 0.45,
      armLiftLeft: 0.12,
    }));
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'TOMBSTONE', 0x9b4dff);
    playWorld(ultimate ? 'witch-ult-cast' : 'witch-tombstone-cast', ctx.caster);
    ctx.caster.showMagicVortex(ctx.now + WITCH_HEX.durationMs, 0x9b4dff);
    this.placeMarkers(ctx);
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down || !caster.isPresent) {
      return false;
    }
    caster.stop();
    this.redrawMarkers(now);
    if (!this.spawned && now >= this.emergeAt) {
      this.spawned = true;
      summonWitchSkeletons(ctx, this.count);
      playWorld('witch-skeleton-awaken', caster);
    }
    return now < this.until;
  }

  destroy(): void {
    for (const marker of this.markers) {
      marker.destroy();
    }
    this.markers.length = 0;
  }

  private placeMarkers(ctx: AbilityContext): void {
    const want = witchSummonSlots(ctx.caster, this.count);
    const facing = ctx.caster.aim.x >= 0 ? 1 : -1;
    for (let i = 0; i < want; i += 1) {
      const gfx = ctx.scene.add.graphics().setDepth(8);
      const side = i % 2 === 0 ? -1 : 1;
      const extra = Math.floor(i / 2);
      gfx.setPosition(
        ctx.caster.x + side * facing * (WITCH_TOMBSTONE.offset + extra * 16),
        ctx.caster.y + 10 + extra * 8,
      );
      this.markers.push(gfx);
    }
    playWorld('witch-tombstone-rise', ctx.caster);
  }

  private redrawMarkers(now: number): void {
    const start = this.until - (this.until - this.emergeAt + WITCH_TOMBSTONE.emergeMs);
    const rise = Phaser.Math.Clamp((now - this.emergeAt + WITCH_TOMBSTONE.emergeMs) / WITCH_TOMBSTONE.emergeMs, 0, 1);
    void start;
    for (const marker of this.markers) {
      drawTombstone(marker, Math.max(0.15, rise));
    }
  }
}

export const summonWitchSkeletons = (ctx: AbilityContext, want: number): void => {
  const world = ctx.world.minionWorld;
  if (!world) {
    return;
  }
  const slots = witchSummonSlots(ctx.caster, want);
  const caster = ctx.caster;
  const facing = caster.aim.x >= 0 ? 1 : -1;
  const box = arenaInnerBounds(WITCH_SKELETON.bodyRadius);
  for (let i = 0; i < slots; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const extra = Math.floor(i / 2);
    const x = Phaser.Math.Clamp(caster.x + side * facing * (WITCH_TOMBSTONE.offset + extra * 16), box.minX, box.maxX);
    const y = Phaser.Math.Clamp(caster.y + 12 + extra * 10, box.minY, box.maxY);
    const record = world.spawn('sword', caster.team, {
      x,
      y,
      stats: WITCH_SKELETON,
      draw: drawWitchSkeleton,
      guard: caster,
      windupMs: WITCH_SKELETON.windupMs,
      recoveryMs: WITCH_SKELETON.recoveryMs,
    });
    if (record) {
      registerWitchSkeleton(caster, record.body);
      record.body.setAim(facing, 0);
    }
  }
};

export const minionWorldOf = (world: { minionWorld?: MinionWorld }): MinionWorld | undefined => world.minionWorld;

export const nearestAllyHero = (caster: NinjaBody, allies: NinjaBody[], range: number): NinjaBody | undefined => {
  let best: NinjaBody | undefined;
  let bestDist = range;
  for (const ally of allies) {
    if (ally === caster || ally.down || !ally.isPresent || ally.stats.role === 'minion') {
      continue;
    }
    const dist = Math.hypot(ally.x - caster.x, ally.y - caster.y);
    if (dist <= bestDist) {
      best = ally;
      bestDist = dist;
    }
  }
  return best;
};
