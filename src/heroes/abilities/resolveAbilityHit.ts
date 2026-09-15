import Phaser from 'phaser';
import { COMBAT, ComboStep } from '../../config/combat';
import { applyDefense } from '../../combat/damage';
import { emitCombatBlocked } from '../../combat/damageEvents';
import { playHitJuice } from '../../effects/hitJuice';
import { spawnHitSpark } from '../../effects/hitSpark';
import { spawnCombatCallout } from '../../effects/combatCallout';
import { COLORS } from '../../ui/theme';
import { BlockController } from '../../combat/BlockController';
import { HitKind } from '../../combat/Hurtbox';
import type { DamageSourceKind } from '../../combat/damageEvents';
import { playAbilityConnect } from '../../audio';
import { NinjaBody } from '../NinjaBody';
import { emitWorldStrike } from '../../match/objectives/worldStrike';

export type AbilityHitProfile = {
  rawDamage: number;
  knockback: number;
  staminaDamage: number;
  dirX: number;
  dirY: number;
  step?: ComboStep;
  hitReactionMs?: number;
  stun?: boolean;
  heavy?: boolean;
  blockable?: boolean;
  spark?: 'slash' | 'kick' | 'default';
  skipSpark?: boolean;
  hitStopMs?: number;
  launchCap?: number;
  receivedKnockbackMul?: number;
  sourceKind?: DamageSourceKind;
  abilityId?: string;
};

/**
 * Ability hits go through the same defense, shield, knockback, and juice path
 * as melee. No second combat stack.
 */
export const resolveAbilityHit = (
  scene: Phaser.Scene,
  now: number,
  attacker: NinjaBody,
  defender: NinjaBody,
  profile: AbilityHitProfile,
  defenderBlock?: BlockController,
): HitKind => {
  if (defender.down || defender.isInvulnerable(now)) {
    return 'whiff';
  }

  const step = profile.step ?? 1;
  const blockable = profile.blockable !== false;
  const block = blockable ? defenderBlock?.tryAbsorb(now, defender, attacker.x, attacker.y) : undefined;
  if (block?.absorbed) {
    const blockedDamage = applyDefense(profile.rawDamage, defender.defense);
    emitCombatBlocked({ defender, amount: blockedDamage, at: now });
    spawnHitSpark(scene, defender.x + defender.aim.x * 16, defender.y + defender.aim.y * 16, {
      blocked: true,
      heavy: Boolean(profile.heavy) || block.perfect,
    });
    if (block.perfect) {
      attacker.playBlockRecoil(now, true);
      attacker.status.applyBlockStun(now, COMBAT.perfectShieldStunMs);
      attacker.status.applyHitStop(now, COMBAT.hitStopBlockMs);
      spawnCombatCallout(scene, defender.x, defender.y, 'PERFECT', COLORS.yellow);
      playHitJuice(scene, defender.x, defender.y, {
        damage: 0,
        blocked: true,
        perfect: true,
        shake: attacker.playerControlled || defender.playerControlled,
      });
      playAbilityConnect('perfect-block', attacker, defender, { heavy: profile.heavy, sourceKind: profile.sourceKind });
      return 'perfect-block';
    }
    defender.drainBlockShield(
      Math.max(
        COMBAT.abilityShieldDamageMin,
        Math.round(profile.staminaDamage * COMBAT.abilityShieldDamageMul),
      ),
      now,
    );
    if (defender.blockShield <= 0) {
      defenderBlock?.breakShield(defender);
    }
    attacker.applyRecoil(-attacker.aim.x, -attacker.aim.y, COMBAT.shieldHitRecoilLight);
    defender.applyRecoil(-defender.aim.x, -defender.aim.y, COMBAT.blockPushLight);
    playHitJuice(scene, defender.x, defender.y, {
      damage: 0,
      blocked: true,
      shake: attacker.playerControlled || defender.playerControlled,
    });
    playAbilityConnect('blocked', attacker, defender, { heavy: profile.heavy, sourceKind: profile.sourceKind });
    return 'blocked';
  }

  const damage = applyDefense(profile.rawDamage * attacker.status.damageMultiplier(now), defender.defense);
  const length = Math.hypot(profile.dirX, profile.dirY) || 1;
  defender.takeHit({
    damage,
    dirX: profile.dirX / length,
    dirY: profile.dirY / length,
    knockback: profile.knockback * attacker.status.knockbackMultiplier(now),
    staminaDamage: profile.staminaDamage,
    step,
    hitReactionMs: profile.hitReactionMs,
    stun: profile.stun,
    hitStopMs: profile.hitStopMs,
    launchCap: profile.launchCap,
    receivedKnockbackMul: profile.receivedKnockbackMul,
    source: {
      attacker,
      kind: profile.sourceKind ?? 'ability',
      abilityId: profile.abilityId,
    },
  });
  if (!profile.skipSpark) {
    spawnHitSpark(scene, defender.x + (profile.dirX / length) * 12, defender.y + (profile.dirY / length) * 12, {
      heavy: Boolean(profile.heavy),
    });
  }
  playHitJuice(scene, defender.x, defender.y, {
    damage,
    finisher: Boolean(profile.heavy),
    shake: attacker.playerControlled || defender.playerControlled,
  });
  if (profile.hitStopMs !== 0) {
    attacker.status.applyHitStop(now, profile.hitStopMs ?? (profile.heavy ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs));
  }
  playAbilityConnect('hit', attacker, defender, { heavy: profile.heavy, sourceKind: profile.sourceKind });
  emitWorldStrike({
    attacker,
    now,
    damage: profile.rawDamage,
    reach: attacker.stats.attackRange + COMBAT.hitForgiveness,
    kind: 'ability',
  });
  return 'hit';
};
