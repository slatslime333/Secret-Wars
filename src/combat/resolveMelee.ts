import Phaser from 'phaser';
import { COMBAT, ComboStep, hitReactionFor, hitStopFor } from '../config/combat';
import { applyDefense } from './damage';
import { emitCombatBlocked } from './damageEvents';
import { isInAttackArc } from './hitDetection';
import { playHitJuice, playImpactShake } from '../effects/hitJuice';
import { spawnHitSpark } from '../effects/hitSpark';
import { spawnCombatCallout } from '../effects/combatCallout';
import { COLORS } from '../ui/theme';
import { BlockController } from './BlockController';
import { HitKind } from './Hurtbox';
import { playMeleeConnect } from '../audio';
import { NinjaBody } from '../heroes/NinjaBody';

const halfArcOf = (fighter: NinjaBody): number => (fighter.stats.attackArcDegrees * Math.PI) / 360;

const inArc = (attacker: NinjaBody, defender: NinjaBody, rangeMul = 1): boolean =>
  isInAttackArc(
    attacker.x,
    attacker.y,
    attacker.aim.x,
    attacker.aim.y,
    defender.x,
    defender.y,
    attacker.stats.attackRange * rangeMul + COMBAT.hitForgiveness,
    halfArcOf(attacker),
    defender.stats.bodyRadius,
  );

const flashBlockShield = (scene: Phaser.Scene, defender: NinjaBody, heavy: boolean, perfect: boolean): void => {
  const graphics = scene.add.graphics().setDepth(21);
  const angle = Math.atan2(defender.aim.y, defender.aim.x);
  graphics.setPosition(defender.x, defender.y);
  graphics.lineStyle(perfect ? 12 : heavy ? 8 : 6, perfect ? 0xffc928 : 0x49dce1, 1);
  graphics.beginPath();
  graphics.arc(0, 0, 32, angle - 1.1, angle + 1.1);
  graphics.strokePath();
  if (perfect) {
    graphics.lineStyle(4, 0xffffff, 0.95);
    graphics.beginPath();
    graphics.arc(0, 0, 38, angle - 1.2, angle + 1.2);
    graphics.strokePath();
  }
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: heavy || perfect ? 200 : 120,
    onComplete: () => graphics.destroy(),
  });
};

/**
 * Shared melee resolution for player and CPU Ninja.
 * Handles connect, directional hold-shield, perfect shield, and clash.
 */
export const resolveMelee = (
  scene: Phaser.Scene,
  now: number,
  attacker: NinjaBody,
  defender: NinjaBody,
  step: ComboStep,
  defenderBlock?: BlockController,
  options: {
    alreadyClashed?: boolean;
    knockbackMul?: number;
    damageMul?: number;
    dirX?: number;
    dirY?: number;
    rangeMul?: number;
    launchCap?: number;
  } = {},
): HitKind => {
  if (defender.down) {
    return 'whiff';
  }
  if (!inArc(attacker, defender, options.rangeMul ?? 1)) {
    return 'whiff';
  }
  if (defender.isInvulnerable(now)) {
    return 'whiff';
  }

  if (!options.alreadyClashed) {
    const bothSwinging =
      Math.abs(now - defender.status.lastAttackAt) <= COMBAT.clashWindowMs &&
      inArc(defender, attacker);
    if (bothSwinging) {
      applyClash(scene, now, attacker, defender, step);
      playMeleeConnect('clash', attacker, defender, step);
      if (attacker.playerControlled || defender.playerControlled) {
        playImpactShake(scene, 'clash');
      }
      return 'clash';
    }
  }

  const block = defenderBlock?.tryAbsorb(now, defender, attacker.x, attacker.y);
  if (block?.absorbed) {
    const heavy = step >= 2;
    const profile = COMBAT.combo[step];
    const blockedDamage = applyDefense(
      attacker.stats.attackDamage *
        (options.damageMul ?? profile.damageMultiplier) *
        attacker.status.damageMultiplier(now),
      defender.defense,
    );
    emitCombatBlocked({ defender, amount: blockedDamage, at: now });
    flashBlockShield(scene, defender, heavy, block.perfect);
    spawnHitSpark(scene, defender.x + defender.aim.x * 16, defender.y + defender.aim.y * 16, {
      blocked: true,
      heavy: heavy || block.perfect,
    });

    if (block.perfect) {
      attacker.playBlockRecoil(now, true);
      attacker.status.applyBlockStun(now, COMBAT.perfectShieldStunMs);
      attacker.status.applyHitStop(now, COMBAT.hitStopPerfectMs);
      defender.applyRecoil(-defender.aim.x, -defender.aim.y, 10);
      spawnCombatCallout(scene, defender.x, defender.y, 'PERFECT', COLORS.yellow);
      playHitJuice(scene, defender.x, defender.y, {
        damage: 0,
        blocked: true,
        finisher: step === 3,
        perfect: true,
        shake: attacker.playerControlled || defender.playerControlled,
      });
      playMeleeConnect('perfect-block', attacker, defender, step);
      if (attacker.playerControlled || defender.playerControlled) {
        playImpactShake(scene, 'perfect');
      }
      return 'perfect-block';
    }

    defender.drainBlockShield(profile.shieldDamage, now);
    if (defender.blockShield <= 0) {
      defenderBlock?.breakShield(defender);
    }
    attacker.applyRecoil(-attacker.aim.x, -attacker.aim.y, heavy ? COMBAT.shieldHitRecoilHeavy : COMBAT.shieldHitRecoilLight);
    defender.applyRecoil(-defender.aim.x, -defender.aim.y, heavy ? COMBAT.blockPushHeavy : COMBAT.blockPushLight);
    playHitJuice(scene, defender.x, defender.y, {
      damage: 0,
      blocked: true,
      finisher: step === 3,
      perfect: false,
      shake: attacker.playerControlled || defender.playerControlled,
    });
    playMeleeConnect('blocked', attacker, defender, step);
    return 'blocked';
  }

  const profile = COMBAT.combo[step];
  const damage = applyDefense(
    attacker.stats.attackDamage *
      (options.damageMul ?? profile.damageMultiplier) *
      attacker.status.damageMultiplier(now),
    defender.defense,
  );
  const dirX = options.dirX ?? attacker.aim.x;
  const dirY = options.dirY ?? attacker.aim.y;
  const bigDemon = attacker.heroId === 'demon' && attacker.demonForm === 'big';
  const reactionMs = hitReactionFor(step, attacker.heroId, bigDemon);
  const stopMs = hitStopFor(step, attacker.heroId, bigDemon);
  defender.takeHit({
    damage,
    dirX,
    dirY,
    knockback:
      attacker.stats.knockbackPower *
      profile.knockbackMultiplier *
      (options.knockbackMul ?? 1) *
      attacker.status.knockbackMultiplier(now),
    staminaDamage: profile.staminaDamage,
    step,
    hitReactionMs: reactionMs,
    hitStopMs: stopMs,
    launchCap: options.launchCap,
    source: { attacker, kind: 'light' },
  });
  attacker.applyRecoil(-dirX, -dirY, profile.attackerRecoil);
  attacker.playConnectPunch(step);
  attacker.status.applyHitStop(now, stopMs);
  spawnHitSpark(scene, defender.x + attacker.aim.x * 12, defender.y + attacker.aim.y * 12, {
    heavy: step >= 2,
  });
  playHitJuice(scene, defender.x, defender.y, {
    damage,
    finisher: step === 3,
    shake: attacker.playerControlled || defender.playerControlled,
  });
  if (step === 3 && (attacker.playerControlled || defender.playerControlled)) {
    playImpactShake(scene, 'finisher');
  }
  playMeleeConnect('hit', attacker, defender, step);
  return 'hit';
};

const applyClash = (
  scene: Phaser.Scene,
  now: number,
  a: NinjaBody,
  b: NinjaBody,
  step: ComboStep,
): void => {
  const profile = COMBAT.combo[step];
  const damageA = applyDefense(
    a.stats.attackDamage * profile.damageMultiplier * COMBAT.clashDamageMultiplier,
    b.defense,
  );
  const otherStep = b.status.lastAttackStep;
  const otherProfile = COMBAT.combo[otherStep];
  const damageB = applyDefense(
    b.stats.attackDamage * otherProfile.damageMultiplier * COMBAT.clashDamageMultiplier,
    a.defense,
  );
  b.takeHit({
    damage: damageA,
    dirX: a.aim.x,
    dirY: a.aim.y,
    knockback: COMBAT.clashRecoil,
    staminaDamage: Math.max(2, Math.round(profile.staminaDamage * 0.5)),
    step,
    hitStopMs: COMBAT.hitStopClashMs,
    clash: true,
    source: { attacker: a, kind: 'light' },
  });
  a.takeHit({
    damage: damageB,
    dirX: b.aim.x,
    dirY: b.aim.y,
    knockback: COMBAT.clashRecoil,
    staminaDamage: Math.max(2, Math.round(otherProfile.staminaDamage * 0.5)),
    step: otherStep,
    hitStopMs: COMBAT.hitStopClashMs,
    clash: true,
    source: { attacker: b, kind: 'light' },
  });
  a.status.applyClashLock(now);
  b.status.applyClashLock(now);
  spawnHitSpark(scene, (a.x + b.x) / 2, (a.y + b.y) / 2, { clash: true, heavy: true });
  playHitJuice(scene, (a.x + b.x) / 2, (a.y + b.y) / 2, {
    damage: damageA,
    clash: true,
    shake: a.playerControlled || b.playerControlled,
  });
};
