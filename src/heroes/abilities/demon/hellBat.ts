import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEMON_HELL_BAT, demonHellBatRecoil } from './tunables';
import { grantDemonRage, demonRageFromHellBat } from './form';
import { distanceBetween } from '../geometry';
import type { NinjaBody } from '../../NinjaBody';

const flying = new WeakMap<NinjaBody, HellBatAbility>();

export const hellBatDef: AbilityDef = {
  id: 'demon-hell-bat',
  name: 'Hell Bat',
  slot: 'ability2',
  cooldownMs: DEMON_HELL_BAT.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.hellBat,
  accent: 0xff4a10,
  padLabel: 'BAT',
  tactics: {
    roles: ['mobility', 'escape', 'knockback', 'damage', 'cc', 'initiate', 'disruption'],
    range: DEMON_HELL_BAT.radius + 80,
  },
  canActivate: (ctx) => {
    if (flying.get(ctx.caster)) {
      return true;
    }
    return canStartAbility(ctx);
  },
  activate: (ctx) => {
    const existing = flying.get(ctx.caster);
    if (existing) {
      existing.requestBurst();
      return;
    }
    return new HellBatAbility(ctx);
  },
};

class HellBatAbility implements ActiveAbility {
  readonly id = hellBatDef.id;
  control = { move: false, attack: true, dash: true, block: true, abilities: true };
  allowRecast = true;
  private phase: 'launch' | 'fly' | 'burst' | 'done' = 'launch';
  private readonly launchUntil: number;
  private readonly flyUntil: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private wantBurst = false;
  private burstAt = 0;

  constructor(ctx: AbilityContext) {
    const aim = ctx.aimOverride ?? ctx.caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dirX = aim.x / len;
    this.dirY = aim.y / len;
    ctx.caster.setAim(this.dirX, this.dirY);
    this.launchUntil = ctx.now + DEMON_HELL_BAT.launchMs;
    this.flyUntil = ctx.now + DEMON_HELL_BAT.maxDurationMs;
    const speed = DEMON_HELL_BAT.launchDistance / (DEMON_HELL_BAT.launchMs / 1000);
    ctx.caster.setSpeedCap(speed);
    ctx.caster.body?.setDrag(0, 0);
    ctx.caster.body?.setVelocity(this.dirX * speed, this.dirY * speed);
    ctx.caster.demonForm = 'bat';
    ctx.caster.view.setScale(0.92);
    ctx.caster.status.applyDefenseBuff(ctx.now, DEMON_HELL_BAT.maxDurationMs + 80, DEMON_HELL_BAT.defenseMul);
    ctx.caster.status.applyControlLock(ctx.now, DEMON_HELL_BAT.launchMs);
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'BAT', 0xff4a10);
    playWorld('shadow-dash-whoosh', ctx.caster);
    flying.set(ctx.caster, this);
  }

  requestBurst(): void {
    this.wantBurst = true;
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now, enemies } = ctx;
    if (caster.down || !caster.isPresent) {
      this.finish(caster);
      return false;
    }
    if (this.phase === 'launch') {
      const speed = DEMON_HELL_BAT.launchDistance / (DEMON_HELL_BAT.launchMs / 1000);
      caster.body?.setVelocity(this.dirX * speed, this.dirY * speed);
      if (now >= this.launchUntil) {
        this.phase = 'fly';
        caster.setSpeedCap(COMBAT.physicsMaxSpeed);
      }
      return true;
    }
    if (this.phase === 'fly') {
      this.steer(caster);
      caster.status.applyDefenseBuff(now, 80, DEMON_HELL_BAT.defenseMul);
      if (this.wantBurst || now >= this.flyUntil || this.touchesEnemy(caster, enemies)) {
        this.explode(ctx);
        this.phase = 'burst';
        this.burstAt = now;
      }
      return true;
    }
    if (this.phase === 'burst') {
      return now < this.burstAt + 80;
    }
    return false;
  }

  destroy(): void {
    /* form restored in finish */
  }

  private steer(caster: NinjaBody): void {
    const speed = caster.stats.moveSpeed * DEMON_HELL_BAT.moveMul;
    const sx = caster.steer.x;
    const sy = caster.steer.y;
    const slen = Math.hypot(sx, sy);
    let nx: number;
    let ny: number;
    if (slen > 0.2) {
      nx = sx / slen;
      ny = sy / slen;
    } else {
      const aimLen = Math.hypot(caster.aim.x, caster.aim.y) || 1;
      nx = caster.aim.x / aimLen;
      ny = caster.aim.y / aimLen;
    }
    caster.setAim(nx, ny);
    caster.setSpeedCap(speed);
    caster.body?.setDrag(0, 0);
    caster.body?.setVelocity(nx * speed, ny * speed);
  }

  private touchesEnemy(caster: NinjaBody, enemies: NinjaBody[]): boolean {
    return enemies.some(
      (enemy) =>
        !enemy.down &&
        distanceBetween(caster.x, caster.y, enemy.x, enemy.y) <=
          caster.stats.bodyRadius + enemy.stats.bodyRadius + DEMON_HELL_BAT.pathPadding,
    );
  }

  private explode(ctx: AbilityContext): void {
    const { caster, now, enemies, scene, rivalBlock } = ctx;
    const faceLen = Math.hypot(caster.aim.x, caster.aim.y) || 1;
    const fx = caster.aim.x / faceLen;
    const fy = caster.aim.y / faceLen;
    playWorld('ninja-smoke', caster);
    spawnCombatCallout(scene, caster.x, caster.y, 'BURST', 0xffc030);
    for (const enemy of enemies) {
      if (enemy.down) {
        continue;
      }
      if (distanceBetween(caster.x, caster.y, enemy.x, enemy.y) > DEMON_HELL_BAT.radius) {
        continue;
      }
      const kind = resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: DEMON_HELL_BAT.damage,
          knockback: caster.stats.knockbackPower * DEMON_HELL_BAT.knockbackMul,
          staminaDamage: DEMON_HELL_BAT.staminaDamage,
          dirX: enemy.x - caster.x,
          dirY: enemy.y - caster.y,
          step: 1,
          heavy: true,
          launchCap: DEMON_HELL_BAT.launchCap,
          sourceKind: 'ability',
          abilityId: hellBatDef.id,
        },
        rivalBlock,
      );
      if (kind === 'hit') {
        enemy.status.applySlow(now, DEMON_HELL_BAT.slowMs, DEMON_HELL_BAT.slowMul);
        enemy.status.applyAttackSpeedSlow(now, DEMON_HELL_BAT.slowMs, DEMON_HELL_BAT.attackSlowMul);
        grantDemonRage(caster, demonRageFromHellBat());
      }
    }
    const recoil = demonHellBatRecoil(DEMON_HELL_BAT.recoilDistance);
    caster.applyRecoil(-fx, -fy, recoil);
    this.finish(caster);
  }

  private finish(caster: NinjaBody): void {
    if (caster.demonForm === 'bat') {
      caster.demonForm = 'little';
      caster.view.setScale(1);
    }
    caster.setSpeedCap(COMBAT.physicsMaxSpeed);
    flying.delete(caster);
    this.phase = 'done';
  }
}
