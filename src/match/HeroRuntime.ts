import Phaser from 'phaser';
import { MATCH } from '../config/match';
import { laneSpawn, type LaneId } from '../config/arena';
import type { TeamId } from '../config/hero';
import { PLAYABLE_HEROES, type HeroId } from '../heroes/roster';
import { NinjaBody } from '../heroes/NinjaBody';
import { QuickAttack } from '../combat/QuickAttack';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { AbilityController } from '../heroes/abilities/AbilityController';
import { AbilityContext } from '../heroes/abilities/types';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { Progression } from './Progression';
import { HeroPlate } from '../ui/world/HeroPlate';

export type HeroRuntimeOptions = {
  instanceId: string;
  heroId: HeroId;
  team: TeamId;
  lane: LaneId;
  isPlayer: boolean;
  x?: number;
  y?: number;
};

/**
 * One match hero: body, kit, progression, death/respawn.
 * Non-player heroes are driven by HeroPilot + the shared tactical layer.
 */
export class HeroRuntime {
  readonly instanceId: string;
  readonly heroId: HeroId;
  readonly team: TeamId;
  readonly lane: LaneId;
  readonly isPlayer: boolean;
  readonly body: NinjaBody;
  readonly attacks: QuickAttack;
  readonly block: BlockController;
  readonly dash: DashController;
  readonly abilities: AbilityController;
  readonly progression: Progression;
  readonly plate: HeroPlate;
  dead = false;
  respawnAt = 0;

  constructor(private readonly scene: Phaser.Scene, options: HeroRuntimeOptions) {
    const playable = PLAYABLE_HEROES[options.heroId];
    const pad = laneSpawn(options.team, options.lane);
    const inward = options.isPlayer ? 0 : MATCH.enemyInwardOffset;
    const x = options.x ?? pad.x + pad.facingX * inward;
    const y = options.y ?? pad.y;
    this.instanceId = options.instanceId;
    this.heroId = options.heroId;
    this.team = options.team;
    this.lane = options.lane;
    this.isPlayer = options.isPlayer;
    this.body = new NinjaBody(scene, x, y, {
      stats: playable.stats,
      draw: playable.draw,
      handSparks: playable.handSparks,
      team: options.team,
      rival: options.team === 'bravo',
      playerControlled: options.isPlayer,
    });
    this.body.setAim(pad.facingX, 0);
    this.attacks = new QuickAttack(scene);
    this.block = new BlockController(scene);
    this.dash = new DashController(scene, playable.stats.dashMaxCharges);
    this.abilities = new AbilityController(playable.kit);
    this.progression = new Progression(this.body);
    this.plate = new HeroPlate(scene, this.body, this.progression, options.isPlayer);
  }

  get alive(): boolean {
    return !this.dead && this.body.isPresent && !this.body.down;
  }

  abilityContext(
    now: number,
    delta: number,
    enemies: NinjaBody[],
    world: AbilityWorld,
    aimOverride?: { x: number; y: number },
    allies: NinjaBody[] = [],
  ): AbilityContext {
    return {
      scene: this.scene,
      now,
      delta,
      caster: this.body,
      enemies,
      allies,
      world,
      interruptCombat: () => {
        this.attacks.interrupt(now);
        this.dash.cancel(this.body);
        this.block.setHeld(now, this.body, false);
      },
      aimOverride,
    };
  }

  holdPlaceholder(): void {
    if (!this.alive) {
      return;
    }
    this.body.stop();
    const pad = laneSpawn(this.team, this.lane);
    this.body.setAim(pad.facingX, 0);
  }

  markDead(now: number): void {
    this.dead = true;
    this.respawnAt = now + MATCH.respawnDelayMs;
    this.attacks.interrupt(now);
    this.dash.cancel(this.body);
    this.abilities.interruptActive();
    this.body.clearRopeWrap();
    this.body.setPresent(false);
    this.plate.setVisible(false);
  }

  maybeRespawn(now: number): boolean {
    if (!this.dead || now < this.respawnAt) {
      return false;
    }
    const pad = laneSpawn(this.team, this.lane);
    this.body.setPresent(true);
    this.body.placeAt(pad.x, pad.y);
    this.body.healFull();
    this.body.setAim(pad.facingX, 0);
    this.body.grantInvulnerable(now + MATCH.respawnInvulnMs);
    this.dead = false;
    this.respawnAt = 0;
    this.plate.setVisible(true);
    return true;
  }

  sync(): void {
    if (this.body.isPresent) {
      this.body.syncView();
    }
    this.plate.sync();
  }

  destroy(): void {
    this.attacks.destroy();
    this.abilities.destroy();
    this.dash.cancel(this.body);
    this.block.destroy();
    this.plate.destroy();
    this.body.destroy();
  }
}
