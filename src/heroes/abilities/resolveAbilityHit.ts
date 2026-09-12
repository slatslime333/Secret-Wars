import Phaser from 'phaser';
import { COMBAT, ComboStep } from '../../config/combat';
import { applyDefense } from '../../combat/damage';
import { playHitJuice } from '../../effects/hitJuice';
import { spawnHitSpark } from '../../effects/hitSpark';
import { spawnCombatCallout } from '../../effects/combatCallout';
import { COLORS } from '../../ui/theme';
import { BlockController } from '../../combat/BlockController';
import { HitKind } from '../../combat/Hurtbox';
import { NinjaBody } from '../NinjaBody';

export type AbilityHitProfile = {
  rawDamage: number;
  knockback: number;
  staminaDamage: number;
  dirX: number;
  dirY: number;
  step?: ComboStep;
  hitReactionMs?: number;
  heavy?: boolean;
  blockable?: boolean;
  spark?: 'slash' | 'kick' | 'default';
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
    spawnHitSpark(scene, defender.x + defender.aim.x * 16, defender.y + defender.aim.y * 16, {
      blocked: true,
      heavy: Boolean(profile.heavy) || block.perfect,
    });
    if (block.perfect) {
      attacker.playBlockRecoil(now, true);
      attacker.status.applyBlockStun(now, COMBAT.perfectShieldStunMs);
      attacker.status.applyHitStop(now, COMBAT.hitStopBlockMs);
      spawnCombatCallout(scene, defender.x, defender.y, 'PERFECT', COLORS.yellow);
      playHitJuice(scene, defender.x, defender.y, { damage: 0, blocked: true, perfect: true });
      return 'perfect-block';
    }
    defender.drainStamina(Math.max(4, Math.round(profile.staminaDamage * 1.4)), now);
    attacker.applyRecoil(-attacker.aim.x, -attacker.aim.y, COMBAT.shieldHitRecoilLight);
    defender.applyRecoil(-defender.aim.x, -defender.aim.y, COMBAT.blockPushLight);
    playHitJuice(scene, defender.x, defender.y, { damage: 0, blocked: true });
    return 'blocked';
  }

  const damage = applyDefense(profile.rawDamage, defender.defense);
  const length = Math.hypot(profile.dirX, profile.dirY) || 1;
  defender.takeHit({
    damage,
    dirX: profile.dirX / length,
    dirY: profile.dirY / length,
    knockback: profile.knockback,
    staminaDamage: profile.staminaDamage,
    step,
    hitReactionMs: profile.hitReactionMs,
  });
  spawnHitSpark(scene, defender.x + (profile.dirX / length) * 12, defender.y + (profile.dirY / length) * 12, {
    heavy: Boolean(profile.heavy),
  });
  playHitJuice(scene, defender.x, defender.y, { damage, finisher: Boolean(profile.heavy) });
  attacker.status.applyHitStop(now, profile.heavy ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs);
  return 'hit';
};
