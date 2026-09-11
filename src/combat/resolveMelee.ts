import Phaser from 'phaser';
import { COMBAT, ComboStep, attackHalfArcRad } from '../config/combat';
import { NINJA } from '../config/ninja';
import { applyDefense } from './damage';
import { isInAttackArc } from './hitDetection';
import { playHitJuice } from '../effects/hitJuice';
import { spawnHitSpark } from '../effects/hitSpark';
import { BlockController } from './BlockController';
import { HitKind } from './Hurtbox';
import { NinjaBody } from '../heroes/NinjaBody';

const inArc = (attacker: NinjaBody, defender: NinjaBody): boolean =>
  isInAttackArc(
    attacker.x,
    attacker.y,
    attacker.aim.x,
    attacker.aim.y,
    defender.x,
    defender.y,
    NINJA.attackRange + COMBAT.hitForgiveness,
    attackHalfArcRad,
    NINJA.bodyRadius,
  );

const flashBlockShield = (scene: Phaser.Scene, defender: NinjaBody, heavy: boolean, perfect: boolean): void => {
  const graphics = scene.add.graphics().setDepth(21);
  const angle = Math.atan2(defender.aim.y, defender.aim.x);
  graphics.setPosition(defender.x, defender.y);
  graphics.lineStyle(perfect ? 10 : heavy ? 8 : 6, perfect ? 0xffffff : 0x49dce1, 1);
  graphics.beginPath();
  graphics.arc(0, 0, 32, angle - 1.1, angle + 1.1);
  graphics.strokePath();
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: heavy || perfect ? 180 : 120,
    onComplete: () => graphics.destroy(),
  });
};

/**
 * Shared melee resolution for player and CPU Ninja.
 * Handles connect, directional block, perfect block, and near-simultaneous clash.
 */
export const resolveMelee = (
  scene: Phaser.Scene,
  now: number,
  attacker: NinjaBody,
  defender: NinjaBody,
  step: ComboStep,
  defenderBlock?: BlockController,
  options: { alreadyClashed?: boolean } = {},
): HitKind => {
  if (defender.down) {
    return 'whiff';
  }
  if (!inArc(attacker, defender)) {
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
      return 'clash';
    }
  }

  const block = defenderBlock?.tryAbsorb(now, defender, attacker.x, attacker.y);
  if (block?.absorbed) {
    const heavy = step === 3;
    const stun = (heavy ? COMBAT.blockStunHeavyMs : COMBAT.blockStunLightMs)
      + (block.perfect ? COMBAT.perfectBlockStunBonusMs : 0);
    attacker.playBlockRecoil(now, heavy || block.perfect);
    attacker.status.applyBlockStun(now, stun);
    attacker.status.applyHitStop(now, COMBAT.hitStopBlockMs);
    defender.applyRecoil(-defender.aim.x, -defender.aim.y, heavy ? COMBAT.blockPushHeavy : COMBAT.blockPushLight);
    flashBlockShield(scene, defender, heavy, block.perfect);
    spawnHitSpark(scene, defender.x + defender.aim.x * 16, defender.y + defender.aim.y * 16, {
      blocked: true,
      heavy,
    });
    playHitJuice(scene, defender.x, defender.y, {
      damage: 0,
      blocked: true,
      finisher: heavy,
      perfect: block.perfect,
    });
    return block.perfect ? 'perfect-block' : 'blocked';
  }

  const profile = COMBAT.combo[step];
  const damage = applyDefense(NINJA.attackDamage * profile.damageMultiplier, defender.defense);
  defender.takeHit({
    damage,
    dirX: attacker.aim.x,
    dirY: attacker.aim.y,
    knockback: NINJA.knockbackPower * profile.knockbackMultiplier,
    staminaDamage: profile.staminaDamage,
    step,
  });
  spawnHitSpark(scene, defender.x + attacker.aim.x * 12, defender.y + attacker.aim.y * 12, {
    heavy: step === 3,
  });
  playHitJuice(scene, defender.x, defender.y, { damage, finisher: step === 3 });
  attacker.status.applyHitStop(now, step === 3 ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs);
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
    NINJA.attackDamage * profile.damageMultiplier * COMBAT.clashDamageMultiplier,
    b.defense,
  );
  const otherStep = b.status.lastAttackStep;
  const otherProfile = COMBAT.combo[otherStep];
  const damageB = applyDefense(
    NINJA.attackDamage * otherProfile.damageMultiplier * COMBAT.clashDamageMultiplier,
    a.defense,
  );
  b.takeHit({
    damage: damageA,
    dirX: a.aim.x,
    dirY: a.aim.y,
    knockback: COMBAT.clashRecoil,
    staminaDamage: Math.max(2, Math.round(profile.staminaDamage * 0.5)),
    step,
    clash: true,
  });
  a.takeHit({
    damage: damageB,
    dirX: b.aim.x,
    dirY: b.aim.y,
    knockback: COMBAT.clashRecoil,
    staminaDamage: Math.max(2, Math.round(otherProfile.staminaDamage * 0.5)),
    step: otherStep,
    clash: true,
  });
  a.status.applyClashLock(now);
  b.status.applyClashLock(now);
  spawnHitSpark(scene, (a.x + b.x) / 2, (a.y + b.y) / 2, { clash: true, heavy: true });
  playHitJuice(scene, (a.x + b.x) / 2, (a.y + b.y) / 2, { damage: damageA, clash: true });
};
