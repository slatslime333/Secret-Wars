import { blockShieldMaxFor } from '../../../config/combat';
import { DEMON, DEMON_BIG, DEMON_BIG_MUL } from '../../../config/demon';
import type { NinjaBody } from '../../NinjaBody';
import { DEMON_RAGE } from './tunables';

export type DemonForm = 'little' | 'transforming' | 'big' | 'bat';

export const isDemon = (body: { heroId: string }): boolean => body.heroId === 'demon';

export const isBigDemon = (body: { heroId: string; demonForm: DemonForm }): boolean =>
  isDemon(body) && body.demonForm === 'big';

export const canBuildDemonRage = (body: { heroId: string; demonForm: DemonForm }): boolean =>
  isDemon(body) && (body.demonForm === 'little' || body.demonForm === 'bat');

export const grantDemonRage = (
  body: NinjaBody,
  amount: number,
  target?: { stats?: { role?: string } },
): void => {
  if (!canBuildDemonRage(body) || amount <= 0) {
    return;
  }
  if (target?.stats?.role === 'minion') {
    return;
  }
  body.demonRage = Math.min(1, body.demonRage + amount / DEMON_RAGE.fillCostMul);
};

export const applyDemonBigStats = (body: NinjaBody): void => {
  if (body.demonScaled) {
    return;
  }
  const oldMax = body.stats.maxHealth;
  const oldStam = body.stats.maxStamina;
  body.stats.maxHealth = Math.round(body.stats.maxHealth * DEMON_BIG_MUL.maxHealth);
  body.stats.maxStamina = Math.round(body.stats.maxStamina * DEMON_BIG_MUL.maxStamina);
  body.stats.moveSpeed = Math.round(body.stats.moveSpeed * DEMON_BIG_MUL.moveSpeed);
  body.stats.attackDamage = Math.round(body.stats.attackDamage * DEMON_BIG_MUL.attackDamage);
  body.stats.defense = Math.round(body.stats.defense * DEMON_BIG_MUL.defense);
  body.stats.knockbackPower = Math.round(body.stats.knockbackPower * DEMON_BIG_MUL.knockbackPower);
  body.stats.attackCooldownMs = Math.round(body.stats.attackCooldownMs * DEMON_BIG_MUL.attackCooldownMs);
  body.stats.attackRange = Math.round(body.stats.attackRange * DEMON_BIG_MUL.attackRange);
  body.stats.staminaRegenPerSecond = body.stats.staminaRegenPerSecond * DEMON_BIG_MUL.staminaRegenPerSecond;
  body.stats.attackArcDegrees = DEMON_BIG.attackArcDegrees;
  body.stats.attackStaminaMul = DEMON_BIG.attackStaminaMul;
  body.health = Math.min(body.stats.maxHealth, body.health + (body.stats.maxHealth - oldMax));
  body.stamina = Math.min(body.stats.maxStamina, body.stamina + (body.stats.maxStamina - oldStam));
  body.maxBlockShield = blockShieldMaxFor(body.stats.maxHealth);
  body.blockShield = Math.min(body.maxBlockShield, body.blockShield + (body.maxBlockShield - blockShieldMaxFor(oldMax)));
  body.demonScaled = true;
};

export const applyDemonLittleStats = (body: NinjaBody): void => {
  if (!body.demonScaled) {
    body.stats.attackArcDegrees = DEMON.attackArcDegrees;
    body.stats.attackStaminaMul = DEMON.attackStaminaMul;
    return;
  }
  const oldMax = body.stats.maxHealth;
  const oldStam = body.stats.maxStamina;
  body.stats.maxHealth = Math.max(1, Math.round(body.stats.maxHealth / DEMON_BIG_MUL.maxHealth));
  body.stats.maxStamina = Math.max(1, Math.round(body.stats.maxStamina / DEMON_BIG_MUL.maxStamina));
  body.stats.moveSpeed = Math.round(body.stats.moveSpeed / DEMON_BIG_MUL.moveSpeed);
  body.stats.attackDamage = Math.round(body.stats.attackDamage / DEMON_BIG_MUL.attackDamage);
  body.stats.defense = Math.round(body.stats.defense / DEMON_BIG_MUL.defense);
  body.stats.knockbackPower = Math.round(body.stats.knockbackPower / DEMON_BIG_MUL.knockbackPower);
  body.stats.attackCooldownMs = Math.round(body.stats.attackCooldownMs / DEMON_BIG_MUL.attackCooldownMs);
  body.stats.attackRange = Math.round(body.stats.attackRange / DEMON_BIG_MUL.attackRange);
  body.stats.staminaRegenPerSecond = body.stats.staminaRegenPerSecond / DEMON_BIG_MUL.staminaRegenPerSecond;
  body.stats.attackArcDegrees = DEMON.attackArcDegrees;
  body.stats.attackStaminaMul = DEMON.attackStaminaMul;
  if (oldMax > 0) {
    body.health = Math.max(body.down ? 0 : 1, Math.round((body.health / oldMax) * body.stats.maxHealth));
  }
  if (oldStam > 0) {
    body.stamina = Math.min(body.stats.maxStamina, Math.round((body.stamina / oldStam) * body.stats.maxStamina));
  }
  body.maxBlockShield = blockShieldMaxFor(body.stats.maxHealth);
  body.blockShield = Math.min(body.maxBlockShield, body.blockShield);
  body.demonScaled = false;
};

export const resetDemonForm = (body: NinjaBody): void => {
  applyDemonLittleStats(body);
  body.demonForm = 'little';
  body.demonRage = 0;
  body.demonTransformUntil = 0;
  body.view.setScale(1);
};

export const demonRageFromCandle = (): number => DEMON_RAGE.candleRage;
export const demonRageFromBurn = (): number => DEMON_RAGE.burnRage;
export const demonRageFromHellfireExplode = (): number => DEMON_RAGE.hellfireExplodeRage;
export const demonRageFromHellfireTick = (): number => DEMON_RAGE.hellfireTickRage;
export const demonRageFromHellBat = (): number => DEMON_RAGE.hellBatRage;
