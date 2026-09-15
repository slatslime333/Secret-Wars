import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { DEV_CHEATS, resetDevCheats } from '../debug/devCheats';
import { MinionWorld } from '../minions/MinionWorld';
import { getSelectedHero, PLAYABLE_HEROES, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { COMBAT } from '../config/combat';
import { MATCH } from '../config/match';
import { Progression } from '../match/Progression';
import { CombatStatsTracker } from '../match/CombatStatsTracker';
import { XpOrbWorld } from '../match/XpOrbWorld';
import { onCombatDamage, onCombatBlocked } from '../combat/damageEvents';
import type { TeamId } from '../config/hero';
import { RivalBrain } from '../ai/RivalBrain';
import { TacticalField } from '../ai/tactical/field';
import { TacticalOverlay } from '../ai/tactical/overlay';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { HitMarker } from '../combat/HitMarker';
import { QuickAttack } from '../combat/QuickAttack';
import { AbilityController } from '../heroes/abilities/AbilityController';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { AbilityContext } from '../heroes/abilities/types';
import { ensureAbilityIcons } from '../heroes/abilities/icons';
import { COLE_ATTACK, COLE_BALL } from '../heroes/abilities/cole/tunables';
import { DEATH_GUN, DEATH_SMASH } from '../heroes/abilities/death/tunables';
import { startDeathDashSweep } from '../heroes/abilities/death/dashSweep';
import { NINJA_KICK } from '../heroes/abilities/ninja/tunables';
import { ROPE_GRAB, ROPE_PUNCH, ROPE_SHOT } from '../heroes/abilities/rope/tunables';
import { witchHexAllyRange } from '../heroes/abilities/witch/tunables';
import { SHADOW_CLAW, SHADOW_DASH } from '../heroes/abilities/shadow/tunables';
import { MENDER_ANGEL, MENDER_PULSE, MENDER_SOUL } from '../heroes/abilities/mender/tunables';
import { DEMON_HELLFIRE } from '../heroes/abilities/demon/tunables';
import { NinjaBody, allowsHeroCollide } from '../heroes/NinjaBody';
import { stampKitPressure } from '../heroes/kitPressure';
import { BattleInput } from '../input/BattleInput';
import { ActionButton } from '../ui/ActionButton';
import { AbilityTray } from '../ui/AbilityTray';
import { BattleHud } from '../ui/BattleHud';
import { CombatFeedback } from '../ui/combatFeedback/CombatFeedback';
import { StatusChips } from '../ui/combatFeedback/StatusChips';
import { DevMenu } from '../ui/DevMenu';
import { Minimap } from '../ui/Minimap';
import {
  Battlefield,
  nextPlayTestSeed,
  prevPlayTestSeed,
  randomPlayTestSeed,
  rememberPlayTestSeed,
  resolvePlayTestSeed,
} from '../map';
import { RoundOverlay } from '../ui/RoundOverlay';
import { PauseOverlay } from '../ui/PauseOverlay';
import { spawnKillPopup } from '../ui/KillPopup';
import { spawnStatusPopup } from '../ui/StatusPopup';
import { isPcCombatHud, layoutPcCombatHud } from '../ui/pcCombatHud';
import { cueAbilityReady } from '../audio/abilityReady';
import { COLORS, FONTS, hex } from '../ui/theme';
import { applyGameplayCamera, layoutHudChrome, lockCameraFollow, measureViewport, installHudCamera, resizeHudCamera, adoptHud } from '../ui/layout';
import { isTouchPrimary } from '../device';
import { audio } from '../audio';
import { fadeToScene } from './fadeToScene';

/** Combat sandbox. PLAY uses MatchScene; this stays the Play Test pit. */
export class BattleScene extends Phaser.Scene {
  private returning = false;
  private ninja!: NinjaBody;
  private rival?: NinjaBody;
  private cpuDummy = false;
  private cpuHeroId: HeroId = 'ninja';
  private minionTeam: TeamId = 'alpha';
  private minionQty = 1;
  private sandboxPaused = false;
  private pauseOwnedSandbox = false;
  private progression!: Progression;
  private sandboxStats = new CombatStatsTracker();
  private offDamage?: () => void;
  private offBlocked?: () => void;
  private debugText?: Phaser.GameObjects.Text;
  private spawnDebug?: Phaser.GameObjects.Graphics;
  private rivalCollider?: Phaser.Physics.Arcade.Collider;
  private inputReader!: BattleInput;
  private marker!: HitMarker;
  private attacks!: QuickAttack;
  private block!: BlockController;
  private dash!: DashController;
  private abilities!: AbilityController;
  private abilityWorld!: AbilityWorld;
  private abilityTray?: AbilityTray;
  private rivalAttacks?: QuickAttack;
  private rivalBlock?: BlockController;
  private rivalDash?: DashController;
  private rivalAbilities?: AbilityController;
  private brain?: RivalBrain;
  private tactics = new TacticalField();
  private aiOverlay?: TacticalOverlay;
  private hud!: BattleHud;
  private feedback!: CombatFeedback;
  private statusChips?: StatusChips;
  private wasStunned = false;
  private wasParalyzed = false;
  private round!: RoundOverlay;
  private pauseOverlay!: PauseOverlay;
  private devMenu?: DevMenu;
  private chromeBar?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private menuButton?: ActionButton;
  private abilityAim?: { x: number; y: number };
  private deathDashIndex = 0;
  private minions!: MinionWorld;
  private battlefield?: Battlefield;
  private minimap?: Minimap;
  private mapSeed = 1;
  private orbs?: XpOrbWorld;

  constructor() {
    super('Battle');
  }

  create(): void {
    this.returning = false;
    resetDevCheats();
    ensureAbilityIcons(this);
    installHudCamera(this);
    const hero = getSelectedHero();
    this.mapSeed = resolvePlayTestSeed();
    this.battlefield = Battlefield.install(this, { seed: this.mapSeed, log: true });
    this.mapSeed = rememberPlayTestSeed(this.battlefield.result.seed);
    this.physics.world.setBounds(
      ARENA.wallThickness,
      ARENA.wallThickness,
      ARENA.width - ARENA.wallThickness * 2,
      ARENA.height - ARENA.wallThickness * 2,
    );

    this.ninja = new NinjaBody(this, ARENA.playerSpawn.x, ARENA.playerSpawn.y, {
      stats: hero.stats,
      draw: hero.draw,
      handSparks: hero.handSparks,
      team: 'alpha',
      playerControlled: true,
    });
    this.battlefield.attachMover(this.ninja.sprite);
    this.progression = new Progression(this.ninja);
    this.orbs = new XpOrbWorld(this, () => undefined);
    this.battlefield.configureCrates({
      heroes: () => (this.rival ? [this.ninja, this.rival] : [this.ninja]),
      orbs: this.orbs,
      grantXp: (body, amount) => {
        if (body === this.ninja) {
          const result = this.progression.grantXp(amount);
          if (result.leveled) {
            this.feedback.levelUps(result.grants);
          }
        }
      },
    });
    this.sandboxStats = new CombatStatsTracker();
    this.sandboxStats.register(this.ninja, { instanceId: 'playtest-player', player: true });
    this.offDamage = onCombatDamage((event) => this.sandboxStats.recordDamage(event));
    this.offBlocked = onCombatBlocked((event) => this.sandboxStats.recordBlocked(event.defender, event.amount));
    this.debugText = this.add
      .text(16, 128, '', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(130);
    adoptHud(this, this.debugText);
    this.spawnDebug = this.add.graphics().setDepth(3);
    this.marker = new HitMarker(this);
    this.attacks = new QuickAttack(this, this.marker);
    this.block = new BlockController(this);
    this.dash = new DashController(this, hero.stats.dashMaxCharges);
    this.abilityWorld = new AbilityWorld();
    this.minions = new MinionWorld(this);
    this.abilityWorld.minionWorld = this.minions;
    this.aiOverlay = new TacticalOverlay(this);
    this.abilities = new AbilityController(hero.kit);
    this.inputReader = new BattleInput(this, () => this.round.isLocked, hero.kit, hero.stats.dashMaxCharges);
    if (!isTouchPrimary()) {
      this.abilityTray = new AbilityTray(this, 52, 128, 1, {
        onSlotPress: (slot) => this.inputReader.togglePcAim(slot),
        aimingSlot: () => this.inputReader.pcAimSlot(),
      });
    }
    this.hud = new BattleHud(this);
    this.feedback = new CombatFeedback(this);
    this.statusChips = new StatusChips(this, { hud: true });
    this.feedback.setAnchor(this.hud.hpAnchor().x, this.hud.hpAnchor().y);
    this.layoutAbilityTray(this.scale.width, this.scale.height);
    this.round = new RoundOverlay(this, {
      onRestart: () => this.restartBattle(),
      onMenu: () => this.returnToMenu(),
      playerName: hero.stats.displayName,
    });
    this.pauseOverlay = new PauseOverlay(this, {
      onContinue: () => this.closePauseMenu(),
      onExit: () => this.returnToMenu(),
    });
    this.devMenu = new DevMenu(this, {
      onToggleCpu: () => this.toggleCpu(false),
      onToggleDummy: () => this.toggleCpu(true),
      cpuPresent: () => Boolean(this.rival),
      cpuDummy: () => this.cpuDummy,
      cpuHeroId: () => this.cpuHeroId,
      onSetCpuHero: (id) => this.setCpuHero(id),
      onSwapHero: (id) => this.swapHero(id),
      onHeal: () => this.ninja.healFull(),
      onResetPos: () => this.resetPlayerPos(),
      onResetCooldowns: () => this.abilities.resetCooldowns(),
      onSpawnMinion: (kind, team, count) => this.minions.spawnMany(kind, team, count),
      onSpawnMixed: (team) => this.minions.spawnMixed(team),
      onClearMinions: () => this.minions.clear(),
      onClearBattlefield: () => this.clearBattlefield(),
      minionTeam: () => this.minionTeam,
      onCycleMinionTeam: () => {
        this.minionTeam = this.minionTeam === 'alpha' ? 'bravo' : 'alpha';
      },
      minionCount: () => this.minionQty,
      onCycleMinionCount: () => {
        this.minionQty = this.minionQty === 1 ? 4 : this.minionQty === 4 ? 6 : 1;
      },
      onResetMatch: () => this.restartBattle(),
      onForceWave: () => this.minions.spawnDraftWave(),
      onTogglePause: () => this.toggleSandboxPause(),
      paused: () => this.sandboxPaused,
      onGiveXp: () => {
        const result = this.progression.grantXp(MATCH.xp.debugGrant);
        audio.play('ui-xp');
        if (result.leveled) {
          audio.play('ui-level-up');
          this.feedback.levelUps(result.grants);
        }
      },
      onGiveLevel: () => {
        const result = this.progression.giveLevel();
        if (result.leveled) {
          audio.play('ui-level-up');
          this.feedback.levelUps(result.grants);
        }
      },
      mapSeed: () => this.mapSeed,
      onMapRandomSeed: () => this.rebuildMap(randomPlayTestSeed()),
      onMapReroll: () => this.rebuildMap(this.mapSeed),
      onMapNextSeed: () => this.rebuildMap(nextPlayTestSeed()),
      onMapPrevSeed: () => this.rebuildMap(prevPlayTestSeed()),
      onToggleMapDebug: () => {
        DEV_CHEATS.showMapDebug = !DEV_CHEATS.showMapDebug;
        this.battlefield?.debug.setVisible(DEV_CHEATS.showMapDebug);
      },
      mapDebug: () => DEV_CHEATS.showMapDebug,
      onCheatsChanged: () => {
        if (DEV_CHEATS.noCooldowns) {
          this.abilities.resetCooldowns();
        }
      },
    });

    lockCameraFollow(this.cameras.main, this.ninja.sprite);
    this.cameras.main.setRoundPixels(true);
    applyGameplayCamera(this.cameras.main, this.scale.width, this.scale.height);
    resizeHudCamera(this, this.scale.width, this.scale.height);
    this.cameras.main.fadeIn(220, 7, 10, 18);
    audio.unlock();
    audio.play('ui-match-start');

    this.minimap = new Minimap(this);
    this.createChrome();
    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard?.addCapture(['ESC', 'R']);
    this.input.keyboard?.on('keydown-ESC', this.togglePauseMenu, this);
    this.input.keyboard?.on('keydown-R', this.onRestartKey, this);
    const onDomKey = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (event.code === 'KeyR') {
        event.preventDefault();
        this.restartBattle();
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        this.togglePauseMenu();
      }
    };
    window.addEventListener('keydown', onDomKey);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.bindDebugApi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.input.keyboard?.off('keydown-ESC', this.togglePauseMenu, this);
      this.input.keyboard?.off('keydown-R', this.onRestartKey, this);
      window.removeEventListener('keydown', onDomKey);
      this.abilities.destroy();
      this.rivalAbilities?.destroy();
      this.abilityWorld.destroy();
      this.minions.destroy();
      this.abilityTray?.destroy();
      this.offDamage?.();
      this.offBlocked?.();
      this.pauseOverlay?.destroy();
      this.feedback?.destroy();
      this.statusChips?.destroy();
      this.minimap?.destroy();
      this.aiOverlay?.destroy();
      this.battlefield?.destroy();
      this.orbs?.destroy();
      this.unbindDebugApi();
      audio.stopAllLoops();
    });
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    audio.setListener(this.ninja.x, this.ninja.y);
    this.drawSandboxDebug(now);
    if (this.sandboxPaused) {
      this.hud.sync(this.ninja, this.rival, now, this.attacks.comboStep, this.block, this.dash);
      this.syncFeedback(now);
      this.cuePlayerCrowdControl(now);
      this.syncAbilityUi(now);
      return;
    }
    this.ninja.syncView();
    this.rival?.syncView();
    this.battlefield?.update(now, delta);
    this.orbs?.update(now, delta);
    this.syncMinimap();
    const everyone = this.allCombatants();
    if (this.rival && this.rivalBlock) {
      this.rivalBlock.sync(now, this.rival);
    }

    if (this.round.isLocked) {
      this.hud.sync(this.ninja, this.rival, now, this.attacks.comboStep, this.block, this.dash);
      this.syncFeedback(now);
      this.cuePlayerCrowdControl(now);
      this.syncAbilityUi(now);
      return;
    }

    this.inputReader.setAbilitiesLocked(this.ninja.status.isEnemyActionLocked(now));
    const frame = this.inputReader.sample(this.ninja.x, this.ninja.y);
    if (frame.ability1AimActive) {
      this.abilityAim = { x: frame.ability1Aim.x, y: frame.ability1Aim.y };
    }
    if (frame.ability2AimActive) {
      this.abilityAim = { x: frame.ability2Aim.x, y: frame.ability2Aim.y };
    }
    const ctx = this.makeAbilityContext(now, delta);
    if (frame.ability1) {
      this.abilities.tryActivate('ability1', ctx);
      this.abilityAim = undefined;
    }
    if (frame.ability2) {
      this.abilities.tryActivate('ability2', ctx);
      this.abilityAim = undefined;
    }
    if (frame.ultimate) {
      this.abilities.tryActivate('ultimate', ctx);
    }
    if (frame.ability2Aiming && frame.ability2Aim.lengthSq() > 0) {
      this.ninja.setAim(frame.ability2Aim);
    } else if (frame.ability1Aiming && frame.ability1Aim.lengthSq() > 0) {
      this.ninja.setAim(frame.ability1Aim);
    } else if (frame.aimActive || frame.aim.lengthSq() > 0.01) {
      this.ninja.setAim(frame.aim);
    }
    this.ninja.recordSteer(frame.move);
    this.abilities.update(this.makeAbilityContext(now, delta, this.liveAbilityAim(frame)));
    this.abilityWorld.update(now, everyone, delta);
    stampKitPressure(this.ninja, now, this.abilities, this.dash);
    if (this.rival) {
      stampKitPressure(this.rival, now, this.rivalAbilities, this.rivalDash);
    }
    this.tactics.refresh(now, this.livingFighters());
    this.minions.update(now, delta, this.abilityWorld, this.tactics);
    this.minions.drawDebug(DEV_CHEATS.showRanges, DEV_CHEATS.showAi, DEV_CHEATS.showHitboxes, now);

    const control = this.abilities.control;

    if (!control.block && !this.dash.isActive(now)) {
      this.block.setHeld(now, this.ninja, frame.blockHeld);
    } else {
      this.block.setHeld(now, this.ninja, false);
    }
    this.block.tick(delta, now, this.ninja);

    if (
      !control.dash &&
      frame.dashPressed &&
      !this.block.isActive(now) &&
      this.dash.tryStart(now, frame.move, this.ninja.aim, this.ninja)
    ) {
      this.attacks.interrupt(now);
      if (this.ninja.heroId === 'death') {
        startDeathDashSweep(
          this,
          this.abilityWorld,
          this.ninja,
          now,
          this.deathDashIndex,
          this.dash.direction,
          this.livingEnemies(),
          this.rivalBlock,
        );
        this.deathDashIndex += 1;
      }
    }

    if (!control.move) {
      this.dash.apply(now, this.ninja);
    } else {
      this.dash.tickRecharge(now);
    }
    if (
      !control.move &&
      !this.dash.isActive(now) &&
      !this.ninja.status.shouldLockMovement(now) &&
      !this.ninja.down
    ) {
      this.ninja.applyMove(frame.move);
    }

    if (frame.ability2Aiming && frame.ability2Aim.lengthSq() > 0) {
      this.ninja.setAim(frame.ability2Aim);
    } else if (frame.ability1Aiming && frame.ability1Aim.lengthSq() > 0) {
      this.ninja.setAim(frame.ability1Aim);
    } else if (frame.blockHeld && frame.blockAimActive) {
      this.ninja.setAim(frame.blockAim);
    } else {
      this.ninja.setAim(frame.aim);
    }
    this.ninja.regenStamina(delta, now);
    this.ninja.regenBlockShield(delta, now);
    this.ninja.regenHealth(delta, now);
    if (this.ninja.heroId === 'rope' && !frame.ability1Aiming && !frame.ability2Aiming) {
      this.marker.syncRopeAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        this.ninja.stats.attackRange * 1.25,
        frame.attackHeld,
        this.attacks.nextRopeArm,
        ROPE_SHOT.armOffsetRad,
      );
    } else if (this.ninja.heroId === 'mender' && !frame.ability1Aiming && !frame.ability2Aiming) {
      this.marker.syncPulseAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        this.ninja.stats.attackRange,
        frame.attackHeld,
        this.attacks.nextRopeArm,
        MENDER_PULSE.armOffsetRad,
      );
    } else if (this.ninja.heroId === 'witch') {
      this.marker.syncWitchAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        this.ninja.stats.attackRange,
        frame.attackHeld,
        witchHexAllyRange(),
      );
    } else if (
      this.ninja.heroId === 'demon' &&
      this.ninja.demonForm !== 'big' &&
      !frame.ability1Aiming &&
      !frame.ability2Aiming
    ) {
      this.marker.syncFlameAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        this.ninja.stats.attackRange,
        frame.attackHeld,
      );
    } else if (this.ninja.heroId === 'rope') {
      this.marker.clearRange();
    } else if (this.ninja.heroId === 'mender') {
      this.marker.clearRange();
    } else if (this.ninja.heroId === 'demon' && this.ninja.demonForm !== 'big') {
      this.marker.clearRange();
    } else {
      const range = this.ninja.heroId === 'cole' ? COLE_ATTACK.range : this.ninja.stats.attackRange;
      this.marker.sync(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        range,
        this.ninja.stats.attackArcDegrees,
      );
    }
    if (this.ninja.heroId === 'cole') {
      this.marker.syncBallAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        COLE_BALL.explodeRadius,
        frame.ability1Aiming,
      );
    } else if (this.ninja.heroId === 'death' && frame.ability1Aiming && !this.abilities.isBusy()) {
      this.marker.syncGunAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        DEATH_GUN.laserLength,
        true,
      );
    } else if (this.ninja.heroId === 'death' && frame.ability2Aiming) {
      this.marker.syncSmashAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        DEATH_SMASH.radius,
        true,
        DEATH_SMASH.halfWidth,
      );
    } else if (this.ninja.heroId === 'ninja' && frame.ability2Aiming) {
      this.marker.syncKickAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        NINJA_KICK.dashDistance,
        true,
        NINJA_KICK.aimHalfWidth,
      );
    } else if (this.ninja.heroId === 'shadow' && frame.ability1Aiming) {
      this.marker.syncKickAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        SHADOW_CLAW.radius,
        true,
        SHADOW_CLAW.aimHalfWidth,
      );
    } else if (this.ninja.heroId === 'shadow' && frame.ability2Aiming) {
      this.marker.syncKickAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        SHADOW_DASH.distance,
        true,
        SHADOW_DASH.aimHalfWidth,
      );
    } else if (this.ninja.heroId === 'mender' && frame.ability1Aiming) {
      this.marker.syncAngelAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        MENDER_ANGEL.aimLength,
        true,
      );
    } else if (this.ninja.heroId === 'mender' && frame.ability2Aiming) {
      this.marker.syncKickAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        MENDER_SOUL.dashDistance,
        true,
        this.ninja.stats.bodyRadius * 2 + 8,
      );
    } else if (this.ninja.heroId === 'demon' && frame.ability1Aiming) {
      const len = Math.hypot(this.ninja.aim.x, this.ninja.aim.y) || 1;
      const nx = this.ninja.aim.x / len;
      const ny = this.ninja.aim.y / len;
      this.marker.syncBallAim(
        this.ninja.x + nx * DEMON_HELLFIRE.range,
        this.ninja.y + ny * DEMON_HELLFIRE.range,
        nx,
        ny,
        DEMON_HELLFIRE.radius,
        true,
      );
    } else if (this.ninja.heroId === 'rope' && frame.ability1Aiming && !this.abilities.isBusy()) {
      this.marker.syncRopeGrabAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        ROPE_GRAB.range,
        true,
      );
    } else if (this.ninja.heroId === 'rope' && frame.ability2Aiming) {
      this.marker.syncPunchAim(
        this.ninja.x,
        this.ninja.y,
        this.ninja.aim.x,
        this.ninja.aim.y,
        ROPE_PUNCH.radius,
        true,
      );
    } else {
      this.marker.clearBallAim();
    }
    this.block.sync(now, this.ninja);

    if (this.rival && this.brain) {
      this.brain.update(now, delta, this.rival, this.tactics, this);
    }
    this.drawRivalAi();
    if (this.rival) {
      this.rival.regenStamina(delta, now);
      this.rival.regenBlockShield(delta, now);
    }
    this.rival?.regenHealth(delta, now);

    if (
      !control.attack &&
      !this.ninja.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now)
    ) {
      this.attacks.update(
        now,
        frame.attackHeld,
        frame.attackPressed,
        this.ninja,
        this.livingEnemies(),
        this.rivalBlock,
        this.livingFighters().filter(
          (unit) => unit.team === this.ninja.team && unit !== this.ninja && unit.stats.role !== 'minion',
        ),
      );
    } else {
      this.attacks.update(
        now,
        false,
        false,
        this.ninja,
        this.livingEnemies(),
        this.rivalBlock,
        this.livingFighters().filter(
          (unit) => unit.team === this.ninja.team && unit !== this.ninja && unit.stats.role !== 'minion',
        ),
      );
    }

    this.hud.sync(this.ninja, this.rival, now, this.attacks.comboStep, this.block, this.dash);
    this.syncFeedback(now);
    this.cuePlayerCrowdControl(now);
    this.inputReader.syncButtons({
      dashCharges: this.dash.chargeCount,
      dashMax: this.dash.maxCharges,
      dashRecharge: this.dash.rechargeRatio(now),
      blocking: this.block.isActive(now),
      staminaRatio: this.ninja.stamina / this.ninja.stats.maxStamina,
    });
    this.syncAbilityUi(now);

    if (this.ninja.down) {
      this.abilities.interruptActive();
      this.dash.cancel(this.ninja);
      this.attacks.interrupt(now);
      this.ninja.clearRopeWrap();
      this.devMenu?.close();
      this.round.lock('rival');
    } else if (this.rival?.down) {
      if (!this.round.isLocked) {
        const result = this.sandboxStats.registerHeroDeath(this.rival, now);
        if (result.killer === this.ninja) {
          spawnKillPopup(this, 'KILL', this.rival.stats.displayName);
        }
      }
      this.devMenu?.close();
      this.round.lock('ninja');
    }
  }

  private spawnCpu(dummy = false): void {
    this.removeCpu();
    const pad = ARENA.teamSpawns.bravo;
    const hero = PLAYABLE_HEROES[this.cpuHeroId];
    this.rival = new NinjaBody(this, pad.x, pad.y, {
      rival: true,
      team: 'bravo',
      stats: hero.stats,
      draw: hero.draw,
      handSparks: hero.handSparks,
    });
    this.sandboxStats.register(this.rival, { instanceId: dummy ? 'playtest-dummy' : 'playtest-cpu', player: false });
    this.rival.setAim(pad.facingX, 0);
    this.rivalCollider = this.physics.add.collider(
      this.ninja.sprite,
      this.rival.sprite,
      undefined,
      (a, b) => allowsHeroCollide(a, b),
    );
    this.battlefield?.attachMover(this.rival.sprite);
    this.rivalAttacks = new QuickAttack(this);
    this.rivalBlock = new BlockController(this);
    this.rivalDash = new DashController(this, hero.stats.dashMaxCharges);
    this.rivalAbilities = new AbilityController(hero.kit);
    this.cpuDummy = dummy;
    this.brain = dummy
      ? undefined
      : new RivalBrain(
          this.rivalAttacks,
          this.rivalBlock,
          this.rivalDash,
          this.block,
          this.rivalAbilities,
          this.abilityWorld,
        );
    this.devMenu?.sync();
  }

  private removeCpu(): void {
    if (!this.rival) {
      return;
    }
    this.rivalCollider?.destroy();
    this.rivalCollider = undefined;
    this.rivalBlock?.destroy();
    this.rivalAbilities?.destroy();
    this.rival.destroy();
    this.rival = undefined;
    this.rivalAttacks = undefined;
    this.rivalBlock = undefined;
    this.rivalDash = undefined;
    this.rivalAbilities = undefined;
    this.brain = undefined;
    this.cpuDummy = false;
    this.devMenu?.sync();
  }

  private toggleCpu(dummy: boolean): void {
    if (this.round.isLocked) {
      return;
    }
    if (this.rival && this.cpuDummy === dummy) {
      this.removeCpu();
      return;
    }
    this.spawnCpu(dummy);
  }

  private setCpuHero(id: HeroId): void {
    this.cpuHeroId = id;
    if (this.rival && !this.round.isLocked) {
      const dummy = this.cpuDummy;
      this.spawnCpu(dummy);
    }
  }

  private toggleSandboxPause(): void {
    this.sandboxPaused = !this.sandboxPaused;
    if (this.sandboxPaused) {
      this.physics.world.pause();
    } else {
      this.physics.world.resume();
    }
  }

  private drawSandboxDebug(now: number): void {
    this.spawnDebug?.clear();
    if (DEV_CHEATS.showSpawns) {
      this.spawnDebug?.lineStyle(2, COLORS.yellow, 0.7);
      for (const team of ['alpha', 'bravo'] as const) {
        for (const lane of ['top', 'mid', 'bottom'] as const) {
          const pad = ARENA.laneSpawns[team][lane];
          this.spawnDebug?.strokeCircle(pad.x, pad.y, ARENA.spawnRadius);
        }
      }
    }
    const bits: string[] = [];
    if (DEV_CHEATS.showXpInfo) {
      bits.push(`LV ${this.progression.level}  XP ${Math.floor(this.progression.xp)}/${this.progression.xpToNext || 'MAX'}`);
    }
    if (DEV_CHEATS.showWaveInfo) {
      bits.push(`MINIONS ${this.minions.size}  A ${this.minions.livingOnTeam('alpha')}  B ${this.minions.livingOnTeam('bravo')}`);
    }
    if (DEV_CHEATS.showScore) {
      bits.push('SCORE  sandbox — no match clock');
    }
    if (DEV_CHEATS.showDamageStats) {
      const line = this.sandboxStats.lineOf(this.ninja);
      if (line) {
        bits.push(`DMG H${line.playerDamage}  L${Math.round(line.lightDamage)}  A${Math.round(line.abilityDamage)}`);
      }
    }
    this.debugText?.setText(bits.join('\n'));
    void now;
  }

  private createChrome(): void {
    const chrome = layoutHudChrome(measureViewport(this.scale.width, this.scale.height));
    this.chromeBar = this.add.rectangle(this.scale.width / 2, chrome.barY, this.scale.width, Math.max(1, chrome.barH), COLORS.ink, 0.78);
    this.chromeBar.setStrokeStyle(2, COLORS.paper).setScrollFactor(0).setDepth(99).setVisible(chrome.barH > 8);

    this.titleText = this.add
      .text(chrome.titleX, chrome.titleY, `PLAY TEST  //  ${this.ninja.stats.displayName.toUpperCase()}`, {
        fontFamily: FONTS.display,
        fontSize: `${chrome.titleSize}px`,
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(chrome.titleVisible);

    this.menuButton = new ActionButton(this, chrome.menuX, chrome.menuY, {
      label: 'MENU',
      width: chrome.menuW,
      height: chrome.menuH,
      compact: chrome.menuH < 40,
      fontSize: chrome.menuH < 36 ? '13px' : undefined,
      letterSpacing: 1,
      onPress: () => this.openPauseMenu(),
    });
    this.menuButton.setScrollFactor(0).setDepth(220);
    adoptHud(this, this.chromeBar, this.titleText, this.menuButton);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const chrome = layoutHudChrome(measureViewport(width, height));
    this.chromeBar?.setPosition(width / 2, chrome.barY).setSize(width, Math.max(1, chrome.barH));
    this.chromeBar?.setVisible(chrome.barH > 8);
    this.titleText?.setPosition(chrome.titleX, chrome.titleY).setVisible(chrome.titleVisible);
    this.menuButton?.setPosition(chrome.menuX, chrome.menuY);
    this.hud?.layout(width, height);
    if (this.hud && this.feedback) {
      const anchor = this.hud.hpAnchor();
      this.feedback.setAnchor(anchor.x, anchor.y);
    }
    this.inputReader?.layout(width, height);
    this.layoutAbilityTray(width, height);
    this.devMenu?.layout(width, height);
    this.minimap?.layout(width, height);
    resizeHudCamera(this, width, height);
    applyGameplayCamera(this.cameras.main, width, height);
    if (this.pauseOverlay?.isOpen) {
      this.pauseOverlay.show(this.sandboxStats.allLines());
    }
  }

  private liveAbilityAim(frame: {
    ability1Aiming: boolean;
    ability1Aim: Phaser.Math.Vector2;
    ability2Aiming: boolean;
    ability2Aim: Phaser.Math.Vector2;
  }): { x: number; y: number } | undefined {
    if (frame.ability2Aiming && frame.ability2Aim.lengthSq() > 0) {
      return { x: frame.ability2Aim.x, y: frame.ability2Aim.y };
    }
    if (frame.ability1Aiming && frame.ability1Aim.lengthSq() > 0) {
      return { x: frame.ability1Aim.x, y: frame.ability1Aim.y };
    }
    return this.abilityAim;
  }

  private makeAbilityContext(
    now: number,
    delta: number,
    aimOverride = this.abilityAim,
  ): AbilityContext {
    const abilities = this.abilities;
    return {
      scene: this,
      now,
      delta,
      caster: this.ninja,
      enemies: this.livingEnemies(),
      allies: this.livingFighters().filter((unit) => unit.team === this.ninja.team && unit !== this.ninja && unit.stats.role !== 'minion'),
      world: this.abilityWorld,
      interruptCombat: () => {
        this.attacks.interrupt(now);
        this.dash.cancel(this.ninja);
        this.block.setHeld(now, this.ninja, false);
      },
      rivalBlock: this.rivalBlock,
      aimOverride,
      holdAbilitySlot: (slot) => abilities.holdAbilitySlot(slot),
      releaseAbilitySlot: (slot, at, startCooldown) => abilities.releaseAbilitySlot(slot, at, startCooldown),
    };
  }

  private allCombatants(): NinjaBody[] {
    const list = [this.ninja, ...this.minions.allBodies()];
    if (this.rival) {
      list.push(this.rival);
    }
    return list;
  }

  private livingFighters(): NinjaBody[] {
    return this.allCombatants().filter((unit) => !unit.down);
  }

  private livingEnemies(): NinjaBody[] {
    return this.livingFighters().filter((unit) => unit.team !== this.ninja.team);
  }

  private drawRivalAi(): void {
    if (!this.rival || !this.brain) {
      this.aiOverlay?.draw([], DEV_CHEATS.showAi);
      return;
    }
    const info = this.brain.debugInfo(this.rival);
    this.aiOverlay?.draw(
      [
        {
          x: this.rival.x,
          y: this.rival.y,
          debug: info,
          target: this.brain.mind.target,
        },
      ],
      DEV_CHEATS.showAi,
    );
  }

  private rebuildMap(seed: number): void {
    this.battlefield?.regenerate(seed);
    this.mapSeed = rememberPlayTestSeed(this.battlefield?.result.seed ?? seed);
    this.rebindMapColliders();
    this.battlefield?.debug.setVisible(DEV_CHEATS.showMapDebug);
    this.devMenu?.sync();
  }

  private rebindMapColliders(): void {
    if (!this.battlefield) {
      return;
    }
    this.battlefield.attachMover(this.ninja.sprite);
    if (this.rival) {
      this.battlefield.attachMover(this.rival.sprite);
    }
    for (const body of this.minions.allBodies()) {
      this.battlefield.attachMover(body.sprite);
    }
  }

  private syncMinimap(): void {
    if (!this.battlefield || !this.minimap) {
      return;
    }
    const heroes = [this.ninja];
    if (this.rival) {
      heroes.push(this.rival);
    }
    this.minimap.sync({
      layout: this.battlefield.layout,
      player: this.ninja,
      heroes,
      minions: this.minions.allBodies(),
    });
  }

  private resetPlayerPos(): void {
    const pad = ARENA.teamSpawns.alpha;
    this.ninja.sprite.setPosition(pad.x, pad.y);
    this.ninja.body?.reset(pad.x, pad.y);
    this.ninja.setAim(pad.facingX, 0);
  }

  private swapHero(id: HeroId): void {
    setSelectedHeroId(id);
    const hero = getSelectedHero();
    const x = this.ninja.x;
    const y = this.ninja.y;
    const now = this.time.now;
    this.dash.cancel(this.ninja);
    this.block.setHeld(now, this.ninja, false);
    this.attacks.interrupt(now);
    this.abilities.destroy();
    this.ninja.destroy();
    this.ninja = new NinjaBody(this, x, y, {
      stats: hero.stats,
      draw: hero.draw,
      handSparks: hero.handSparks,
      team: 'alpha',
      playerControlled: true,
    });
    this.ninja.setSpeedCap(COMBAT.physicsMaxSpeed);
    this.battlefield?.attachMover(this.ninja.sprite);
    this.abilities = new AbilityController(hero.kit);
    this.dash = new DashController(this, hero.stats.dashMaxCharges);
    this.attacks = new QuickAttack(this, this.marker);
    this.inputReader.rebindHero(hero.kit, hero.stats.dashMaxCharges);
    lockCameraFollow(this.cameras.main, this.ninja.sprite);
    this.rivalCollider?.destroy();
    if (this.rival) {
      this.rivalCollider = this.physics.add.collider(
        this.ninja.sprite,
        this.rival.sprite,
        undefined,
        (a, b) => allowsHeroCollide(a, b),
      );
    }
    this.progression = new Progression(this.ninja);
    this.sandboxStats.register(this.ninja, { instanceId: 'playtest-player', player: true });
    this.titleText?.setText(`PLAY TEST  //  ${hero.stats.displayName.toUpperCase()}`);
  }

  private clearBattlefield(): void {
    this.minions.clear();
    this.removeCpu();
    this.ninja.healFull();
    this.abilities.resetCooldowns();
    this.resetPlayerPos();
  }

  private syncAbilityUi(now: number): void {
    const states = this.abilities.allStates(now);
    this.inputReader.syncAbilities(states);
    this.abilityTray?.sync(states);
    cueAbilityReady(this, states);
  }

  private layoutAbilityTray(width: number, height: number): void {
    if (!this.abilityTray) {
      return;
    }
    if (!isPcCombatHud()) {
      this.abilityTray.layout(52, 128, 1);
      return;
    }
    const hud = layoutPcCombatHud(width, height);
    this.abilityTray.layout(hud.abilityXs[0], hud.abilityY, hud.abilityScale);
  }

  private syncFeedback(now: number): void {
    const chip = this.hud.chipAnchor();
    this.statusChips?.setPosition(chip.x, chip.y);
    this.statusChips?.sync(this.ninja, now);
    const anchor = this.hud.hpAnchor();
    this.feedback.setAnchor(anchor.x, anchor.y);
  }

  private cuePlayerCrowdControl(now: number): void {
    const paralyzed = this.ninja.status.isParalyzed(now);
    const stunned = this.ninja.status.isStunned(now);
    if (paralyzed && !this.wasParalyzed) {
      spawnStatusPopup(this, 'PARALYZED');
    } else if (stunned && !paralyzed && !this.wasStunned) {
      spawnStatusPopup(this, 'STUNNED');
    }
    this.wasParalyzed = paralyzed;
    this.wasStunned = stunned;
  }

  private bindDebugApi(): void {
    (window as Window & { secretWarsPlaytest?: object }).secretWarsPlaytest = {
      spawnCpu: () => this.spawnCpu(false),
      spawnDummy: () => this.spawnCpu(true),
      spawnMixed: (team: 'alpha' | 'bravo' = 'bravo') => this.minions.spawnMixed(team),
      toggleAi: () => {
        DEV_CHEATS.showAi = !DEV_CHEATS.showAi;
        return DEV_CHEATS.showAi;
      },
      aiDebug: () => ({
        cpu: this.rival && this.brain ? this.brain.debugInfo(this.rival) : null,
        minions: this.minions.debugSnapshot(this.time.now),
      }),
    };
  }

  private unbindDebugApi(): void {
    const host = window as Window & { secretWarsPlaytest?: object };
    delete host.secretWarsPlaytest;
  }

  private onRestartKey(): void {
    this.restartBattle();
  }

  private restartBattle(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    this.time.paused = false;
    this.physics.world.resume();
    this.removeCpu();
    this.scene.restart();
  }

  private togglePauseMenu = (): void => {
    if (this.returning) {
      return;
    }
    if (this.round.isLocked) {
      this.returnToMenu();
      return;
    }
    if (this.pauseOverlay?.isOpen) {
      this.closePauseMenu();
    } else {
      this.openPauseMenu();
    }
  };

  private openPauseMenu(): void {
    if (this.returning || this.round.isLocked || this.pauseOverlay.isOpen) {
      return;
    }
    this.pauseOwnedSandbox = !this.sandboxPaused;
    if (!this.sandboxPaused) {
      this.toggleSandboxPause();
    }
    this.time.paused = true;
    this.pauseOverlay.show(this.sandboxStats.allLines());
  }

  private closePauseMenu(): void {
    if (!this.pauseOverlay.isOpen) {
      return;
    }
    this.pauseOverlay.hide();
    this.time.paused = false;
    if (this.pauseOwnedSandbox && this.sandboxPaused) {
      this.toggleSandboxPause();
    }
    this.pauseOwnedSandbox = false;
  }

  private returnToMenu(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    this.time.paused = false;
    this.physics.world.resume();
    fadeToScene(this, 'MainMenu');
  }
}
