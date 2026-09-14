import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { NinjaBody } from '../../NinjaBody';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { MENDER_SOUL, menderExitRecoil, menderSoulRange } from './tunables';
import { allyAlongAim, nearestAllyHero } from './targeting';

const attached = new WeakMap<NinjaBody, SoulDashAbility>();

export const soulDashDef: AbilityDef = {
  id: 'mender-soul-dash',
  name: 'Soul Dash',
  slot: 'ability2',
  cooldownMs: MENDER_SOUL.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.soulDash,
  accent: 0xe03040,
  aimOnRelease: true,
  padLabel: 'SOUL',
  deferCooldown: true,
  tactics: { roles: ['defense', 'peel', 'mobility', 'heal', 'buff'], range: menderSoulRange() },
  canActivate: (ctx) => {
    if (!canStartAbility(ctx)) {
      return false;
    }
    if (attached.get(ctx.caster)) {
      return true;
    }
    const aim = ctx.aimOverride ?? ctx.caster.aim;
    return Boolean(allyAlongAim(ctx.caster, ctx.allies ?? [], menderSoulRange(), aim.x, aim.y));
  },
  activate: (ctx) => {
    const existing = attached.get(ctx.caster);
    if (existing) {
      existing.requestExit();
      return;
    }
    return new SoulDashAbility(ctx);
  },
};

class SoulDashAbility implements ActiveAbility {
  readonly id = soulDashDef.id;
  control = { move: true, attack: true, dash: true, block: true, abilities: true };
  consumeDeferred = true;
  allowRecast = false;
  private phase: 'dash' | 'attached' | 'exit' | 'done' = 'dash';
  private readonly dashUntil: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly caster: NinjaBody;
  private readonly ally: NinjaBody;
  private attachedAt = 0;
  private buffed = false;
  private exitUntil = 0;
  private wantExit = false;

  constructor(ctx: AbilityContext) {
    this.caster = ctx.caster;
    const aim = ctx.aimOverride ?? ctx.caster.aim;
    const ally = allyAlongAim(ctx.caster, ctx.allies ?? [], menderSoulRange(), aim.x, aim.y);
    this.ally = ally ?? nearestAllyHero(ctx.caster, ctx.allies ?? [], menderSoulRange())!;
    const dx = this.ally.x - ctx.caster.x;
    const dy = this.ally.y - ctx.caster.y;
    const len = Math.hypot(dx, dy) || 1;
    this.dirX = dx / len;
    this.dirY = dy / len;
    ctx.caster.setAim(this.dirX, this.dirY);
    this.dashUntil = ctx.now + MENDER_SOUL.dashDurationMs;
    const speed = MENDER_SOUL.dashDistance / (MENDER_SOUL.dashDurationMs / 1000);
    ctx.caster.setSpeedCap(speed);
    ctx.caster.status.applyControlLock(ctx.now, MENDER_SOUL.dashDurationMs);
    this.lockInvulnerable(ctx.now);
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'SOUL', 0xe03040);
    playWorld('shadow-dash-whoosh', ctx.caster);
    attached.set(this.caster, this);
  }

  requestExit(): void {
    this.wantExit = true;
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down || !caster.isPresent) {
      this.detach(ctx);
      this.phase = 'done';
      return false;
    }
    if (this.phase === 'dash') {
      const speed = MENDER_SOUL.dashDistance / (MENDER_SOUL.dashDurationMs / 1000);
      caster.body?.setDrag(0, 0);
      caster.body?.setVelocity(this.dirX * speed, this.dirY * speed);
      const reached =
        Math.hypot(this.ally.x - caster.x, this.ally.y - caster.y) <=
        caster.stats.bodyRadius + this.ally.stats.bodyRadius + MENDER_SOUL.pathPadding;
      if (now >= this.dashUntil || reached || this.ally.down) {
        caster.setSpeedCap(COMBAT.physicsMaxSpeed);
        const closeEnough =
          reached ||
          Math.hypot(this.ally.x - caster.x, this.ally.y - caster.y) <= MENDER_SOUL.dashDistance * 0.35;
        if (this.ally.down || !this.ally.isPresent || !closeEnough) {
          this.phase = 'done';
          this.detach(ctx);
          return false;
        }
        this.beginAttach(ctx);
      }
      return true;
    }
    if (this.phase === 'attached') {
      if (this.ally.down || !this.ally.isPresent) {
        this.beginExit(ctx, true);
        return true;
      }
      this.followAlly(caster, now);
      this.lockInvulnerable(now);
      const cpuDone = !caster.playerControlled && now >= this.attachedAt + MENDER_SOUL.buffMs;
      if (this.wantExit || cpuDone) {
        this.beginExit(ctx, false);
      }
      return true;
    }
    if (this.phase === 'exit') {
      if (now >= this.exitUntil) {
        caster.setSpeedCap(COMBAT.physicsMaxSpeed);
        this.detach(ctx);
        this.phase = 'done';
        return false;
      }
      return true;
    }
    return false;
  }

  destroy(): void {
    attached.delete(this.caster);
    this.unlockInvulnerable();
    this.caster.setFairyForm(false);
    this.caster.setSpeedCap(COMBAT.physicsMaxSpeed);
  }

  private beginAttach(ctx: AbilityContext): void {
    this.phase = 'attached';
    this.control = { move: true, attack: true, dash: true, block: true, abilities: true };
    this.allowRecast = true;
    this.attachedAt = ctx.now;
    ctx.caster.setSpeedCap(COMBAT.physicsMaxSpeed);
    ctx.caster.stop();
    ctx.caster.setFairyForm(true);
    this.lockInvulnerable(ctx.now);
    this.applyBuff(ctx);
    spawnCombatCallout(ctx.scene, this.ally.x, this.ally.y, 'LINK', 0xe03040);
    playWorld('witch-hex-buff', this.ally);
  }

  private applyBuff(ctx: AbilityContext): void {
    if (this.buffed || this.ally.down) {
      return;
    }
    this.buffed = true;
    const now = ctx.now;
    const heal = Math.round(this.ally.stats.maxHealth * MENDER_SOUL.healMaxHp);
    this.ally.heal(heal);
    this.ally.status.applyHasteBuff(now, MENDER_SOUL.buffMs, MENDER_SOUL.moveMul, MENDER_SOUL.attackSpeedMul);
    this.ally.status.applyStaminaRegenBuff(now, MENDER_SOUL.buffMs, MENDER_SOUL.staminaRegenMul);
    this.ally.showMagicVortex(now + MENDER_SOUL.buffMs, MENDER_SOUL.auraTint);
  }

  private followAlly(caster: NinjaBody, now: number): void {
    const side = caster.team === 'alpha' ? 1 : -1;
    const bob = Math.sin(now / 140) * 4;
    const x = this.ally.x + side * MENDER_SOUL.attachOffset;
    const y = this.ally.y - 10 + bob;
    caster.placeAt(x, y);
    caster.stop();
    caster.setAim(this.ally.aim.x, this.ally.aim.y);
  }

  private beginExit(ctx: AbilityContext, forced: boolean): void {
    this.phase = 'exit';
    this.allowRecast = false;
    this.control = { move: true, attack: true, dash: true, block: true, abilities: true };
    this.unlockInvulnerable();
    ctx.caster.setFairyForm(false);
    const aimLen = Math.hypot(this.ally.aim.x, this.ally.aim.y) || 1;
    const ex = -this.ally.aim.x / aimLen;
    const ey = -this.ally.aim.y / aimLen;
    this.exitUntil = ctx.now + MENDER_SOUL.backflipMs;
    ctx.caster.status.applyControlLock(ctx.now, MENDER_SOUL.backflipMs);
    ctx.caster.applyRecoil(ex, ey, menderExitRecoil(MENDER_SOUL.backflipDistance));
    ctx.caster.playBackflip(ex, ey, MENDER_SOUL.backflipMs, MENDER_SOUL.jumpHeight);
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, forced ? 'BREAK' : 'OUT', 0xe03040);
    playWorld('ninja-kick-whoosh', ctx.caster);
    if (forced) {
      this.ally.status.clearTimedBuffs();
      this.ally.clearMagicVortex();
    }
  }

  private detach(ctx: AbilityContext): void {
    attached.delete(ctx.caster);
    this.unlockInvulnerable();
    ctx.caster.setFairyForm(false);
    ctx.caster.setSpeedCap(COMBAT.physicsMaxSpeed);
  }

  private lockInvulnerable(now: number): void {
    this.caster.grantInvulnerable(now + 120_000);
  }

  private unlockInvulnerable(): void {
    this.caster.grantInvulnerable(0);
  }
}
