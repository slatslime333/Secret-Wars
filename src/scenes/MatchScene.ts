import Phaser from 'phaser';
import { ARENA, LANES, type LaneId } from '../config/arena';
import { MATCH } from '../config/match';
import { DEV_CHEATS, resetDevCheats } from '../debug/devCheats';
import { MinionWorld } from '../minions/MinionWorld';
import { getSelectedHeroId, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { HitMarker } from '../combat/HitMarker';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { ensureAbilityIcons } from '../heroes/abilities/icons';
import { COLE_BALL } from '../heroes/abilities/cole/tunables';
import { DEATH_SMASH } from '../heroes/abilities/death/tunables';
import { startDeathDashSweep } from '../heroes/abilities/death/dashSweep';
import { NINJA_KICK } from '../heroes/abilities/ninja/tunables';
import { NinjaBody } from '../heroes/NinjaBody';
import { onCombatDamage, isHeroFighter } from '../combat/damageEvents';
import { BattleInput } from '../input/BattleInput';
import { ActionButton } from '../ui/ActionButton';
import { AbilityTray } from '../ui/AbilityTray';
import { BattleHud } from '../ui/BattleHud';
import { MatchHud } from '../ui/MatchHud';
import { PostMatchOverlay } from '../ui/PostMatchOverlay';
import { Minimap } from '../ui/Minimap';
import { COLORS, FONTS, hex } from '../ui/theme';
import { Battlefield, freshMatchSeed } from '../map';
import { HeroPilot } from '../ai/HeroPilot';
import { TacticalField } from '../ai/tactical/field';
import { TacticalOverlay } from '../ai/tactical/overlay';
import { isTouchPrimary } from '../device';
import { fadeToScene } from './fadeToScene';
import { HeroRuntime } from '../match/HeroRuntime';
import { MatchManager } from '../match/MatchManager';
import { ScoreManager } from '../match/ScoreManager';
import { CombatStatsTracker } from '../match/CombatStatsTracker';
import { WaveDirector } from '../match/WaveDirector';
import { XpOrbWorld } from '../match/XpOrbWorld';
import { buildMatchGameState, type MatchGameState } from '../match/MatchQuery';
import { PLAYABLE_HEROES } from '../heroes/roster';
import { xpForMinion } from '../config/match';
import type { TeamId } from '../config/hero';

const ENEMY_BY_LANE: Record<LaneId, HeroId> = {
  top: 'ninja',
  mid: 'cole',
  bottom: 'death',
};

export type MatchSceneData = {
  heroId?: HeroId;
};

/** Draft match. Allies fill the other two heroes; non-players use HeroPilot. */
export class MatchScene extends Phaser.Scene {
  private returning = false;
  private startHeroId: HeroId = 'ninja';
  private player!: HeroRuntime;
  private heroes: HeroRuntime[] = [];
  private emptyAllySlots: { team: TeamId; lane: LaneId }[] = [];
  private pilots = new Map<HeroRuntime, HeroPilot>();
  private tactics = new TacticalField();
  private aiOverlay?: TacticalOverlay;
  private battlefield?: Battlefield;
  private minimap?: Minimap;
  private inputReader!: BattleInput;
  private marker!: HitMarker;
  private abilityWorld!: AbilityWorld;
  private abilityTray?: AbilityTray;
  private hud!: BattleHud;
  private matchHud!: MatchHud;
  private results!: PostMatchOverlay;
  private chromeBar?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private menuButton?: ActionButton;
  private abilityAim?: { x: number; y: number };
  private deathDashIndex = 0;
  private minions!: MinionWorld;
  private match!: MatchManager;
  private score!: ScoreManager;
  private stats!: CombatStatsTracker;
  private waves!: WaveDirector;
  private orbs!: XpOrbWorld;
  private offDamage?: () => void;
  private heroGroup?: Phaser.Physics.Arcade.Group;

  constructor() {
    super('Match');
  }

  init(data: MatchSceneData = {}): void {
    this.startHeroId = data.heroId ?? getSelectedHeroId();
  }

  create(): void {
    this.returning = false;
    resetDevCheats();
    ensureAbilityIcons(this);
    setSelectedHeroId(this.startHeroId);
    const hero = PLAYABLE_HEROES[this.startHeroId];
    this.battlefield = Battlefield.install(this, { seed: freshMatchSeed(), log: true });
    this.physics.world.setBounds(
      ARENA.wallThickness,
      ARENA.wallThickness,
      ARENA.width - ARENA.wallThickness * 2,
      ARENA.height - ARENA.wallThickness * 2,
    );

    this.score = new ScoreManager();
    this.match = new MatchManager(() => this.score.snapshot());
    this.stats = new CombatStatsTracker();
    this.abilityWorld = new AbilityWorld();
    this.minions = new MinionWorld(this);
    this.waves = new WaveDirector(this.minions);
    this.orbs = new XpOrbWorld(this, (grant) => this.grantMinionReward(grant.target, grant.amount));
    this.minions.onKilled = (event) => {
      if (!event.killer || !isHeroFighter(event.killer) || !event.killer.isPresent || event.killer.down) {
        return;
      }
      this.orbs.spawn(event.x, event.y, event.killer, xpForMinion(event.kind), event.team);
    };

    this.heroes = [];
    this.emptyAllySlots = [];
    this.player = new HeroRuntime(this, {
      instanceId: 'alpha-mid-player',
      heroId: this.startHeroId,
      team: 'alpha',
      lane: 'mid',
      isPlayer: true,
    });
    this.heroes.push(this.player);
    this.stats.register(this.player.body, { instanceId: this.player.instanceId, player: true });

    const leftover = (['ninja', 'cole', 'death'] as HeroId[]).filter((id) => id !== this.startHeroId);
    const allyLanes: LaneId[] = ['top', 'bottom'];
    leftover.forEach((heroId, index) => {
      const lane = allyLanes[index];
      if (!lane) {
        return;
      }
      const ally = new HeroRuntime(this, {
        instanceId: `alpha-${lane}`,
        heroId,
        team: 'alpha',
        lane,
        isPlayer: false,
      });
      this.heroes.push(ally);
      this.stats.register(ally.body, { instanceId: ally.instanceId, player: false });
    });

    for (const lane of LANES) {
      const runtime = new HeroRuntime(this, {
        instanceId: `bravo-${lane}`,
        heroId: ENEMY_BY_LANE[lane],
        team: 'bravo',
        lane,
        isPlayer: false,
      });
      this.heroes.push(runtime);
      this.stats.register(runtime.body, { instanceId: runtime.instanceId, player: false });
    }

    this.heroGroup = this.physics.add.group(this.heroes.map((unit) => unit.body.sprite));
    this.physics.add.collider(this.heroGroup, this.heroGroup);
    this.battlefield.attachGroup(this.heroGroup);
    this.pilots.clear();
    for (const unit of this.heroes) {
      if (!unit.isPlayer) {
        this.pilots.set(unit, new HeroPilot(unit));
      }
    }

    this.aiOverlay = new TacticalOverlay(this);
    this.marker = new HitMarker(this);
    this.inputReader = new BattleInput(this, () => this.inputLocked(), hero.kit, hero.stats.dashMaxCharges);
    if (!isTouchPrimary()) {
      this.abilityTray = new AbilityTray(this, 52, 148);
    }
    this.hud = new BattleHud(this);
    this.hud.placeCombo(this.scale.width / 2, 88);
    this.matchHud = new MatchHud(this);
    this.minimap = new Minimap(this);
    this.results = new PostMatchOverlay(this, {
      onRematch: () => this.restartMatch(),
      onMenu: () => this.returnToMenu(),
    });

    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.startFollow(this.player.body.sprite, true, 0.16, 0.16);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(1);
    this.cameras.main.fadeIn(220, 7, 10, 18);

    this.createChrome();
    this.waves.start(this.time.now);
    this.offDamage = onCombatDamage((event) => this.stats.recordDamage(event));

    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard?.addCapture(['ESC']);
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.bindDebugApi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
      this.offDamage?.();
      this.abilityWorld.destroy();
      this.minions.destroy();
      this.orbs.destroy();
      this.abilityTray?.destroy();
      this.minimap?.destroy();
      this.battlefield?.destroy();
      for (const unit of this.heroes) {
        unit.destroy();
      }
      this.aiOverlay?.destroy();
      this.unbindDebugApi();
    });
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    if (this.match.paused) {
      this.syncHud(now);
      return;
    }

    this.match.update(delta);
    for (const unit of this.heroes) {
      unit.sync();
    }

    if (this.match.finished) {
      this.freezeField();
      this.syncHud(now);
      if (!this.results.isOpen) {
        this.results.show(this.match.winner, this.player.team, this.stats.allLines());
      }
      return;
    }

    this.waves.update(now);
    this.orbs.update(now, delta);
    this.abilityWorld.update(now, this.allCombatants(), delta);
    this.tactics.refresh(now, this.livingFighters());
    this.minions.update(now, delta, this.abilityWorld, this.tactics);

    for (const unit of this.heroes) {
      if (!unit.isPlayer) {
        const block = unit.team !== this.player.team ? this.player.block : undefined;
        this.pilots.get(unit)?.update(now, delta, unit, this.tactics, this, block);
      }
      if (unit.maybeRespawn(now) && unit.isPlayer) {
        this.cameras.main.startFollow(unit.body.sprite, true, 0.16, 0.16);
      }
    }
    this.drawAiDebug();

    this.resolveHeroDeaths(now);

    if (!this.player.alive) {
      this.player.body.stop();
      this.syncHud(now);
      return;
    }

    const frame = this.inputReader.sample(this.player.body.x, this.player.body.y);
    if (frame.ability1AimActive) {
      this.abilityAim = { x: frame.ability1Aim.x, y: frame.ability1Aim.y };
    }
    if (frame.ability2AimActive) {
      this.abilityAim = { x: frame.ability2Aim.x, y: frame.ability2Aim.y };
    }
    const ctx = this.player.abilityContext(now, delta, this.livingEnemies(), this.abilityWorld);
    if (frame.ability1) {
      this.player.abilities.tryActivate('ability1', ctx);
      this.abilityAim = undefined;
    }
    if (frame.ability2) {
      this.player.abilities.tryActivate('ability2', ctx);
      this.abilityAim = undefined;
    }
    if (frame.ultimate) {
      this.player.abilities.tryActivate('ultimate', ctx);
    }
    this.aimPlayer(frame);
    this.player.abilities.update(
      this.player.abilityContext(now, delta, this.livingEnemies(), this.abilityWorld, this.liveAbilityAim(frame)),
    );

    const control = this.player.abilities.control;
    if (!control.block && !this.player.dash.isActive(now)) {
      this.player.block.setHeld(now, this.player.body, frame.blockHeld);
    } else {
      this.player.block.setHeld(now, this.player.body, false);
    }
    this.player.block.tick(delta, now, this.player.body);

    if (
      !control.dash &&
      frame.dashPressed &&
      !this.player.block.isActive(now) &&
      this.player.dash.tryStart(now, frame.move, this.player.body.aim, this.player.body)
    ) {
      this.player.attacks.interrupt(now);
      if (this.player.body.heroId === 'death') {
        startDeathDashSweep(
          this,
          this.abilityWorld,
          this.player.body,
          now,
          this.deathDashIndex,
          this.player.dash.direction,
          this.livingEnemies(),
        );
        this.deathDashIndex += 1;
      }
    }

    if (!control.move) {
      this.player.dash.apply(now, this.player.body);
    } else {
      this.player.dash.tickRecharge(now);
    }
    if (
      !control.move &&
      !this.player.dash.isActive(now) &&
      !this.player.body.status.shouldLockMovement(now) &&
      !this.player.block.isActive(now) &&
      !this.player.body.down
    ) {
      this.player.body.applyMove(frame.move);
    }

    this.aimPlayer(frame);
    this.player.body.tickAmmo(now);
    if (!this.player.block.isActive(now)) {
      this.player.body.regenStamina(delta, now);
    }
    this.marker.sync(
      this.player.body.x,
      this.player.body.y,
      this.player.body.aim.x,
      this.player.body.aim.y,
      this.player.body.stats.attackRange,
      this.player.body.stats.attackArcDegrees,
    );
    this.syncAimGuides(frame);
    this.player.block.sync(now, this.player.body);

    if (!control.attack && !this.player.body.down && !this.player.block.isActive(now) && !this.player.dash.isActive(now)) {
      this.player.attacks.update(now, frame.attackHeld, frame.attackPressed, this.player.body, this.livingEnemies());
    } else {
      this.player.attacks.update(now, false, false, this.player.body, this.livingEnemies());
    }

    this.resolveHeroDeaths(now);
    this.syncHud(now);
  }

  gameState(): MatchGameState {
    return buildMatchGameState({
      now: this.time.now,
      match: this.match.snapshot(),
      score: this.score.snapshot(),
      heroes: this.heroes,
      emptyAllySlots: this.emptyAllySlots,
      minions: this.minions,
      self: this.player,
    });
  }

  private grantMinionReward(target: NinjaBody, amount: number): void {
    if (!target.isPresent || target.down) {
      return;
    }
    const runtime = this.heroes.find((hero) => hero.body === target);
    runtime?.progression.grantXp(amount);
    target.heal(MATCH.healing.minionKill);
  }

  private resolveHeroDeaths(now: number): void {
    for (const unit of this.heroes) {
      if (unit.dead || !unit.body.down) {
        continue;
      }
      const result = this.stats.registerHeroDeath(unit.body, now);
      if (result.killer && result.killer.team !== unit.team) {
        this.score.addKill(result.killer.team);
      }
      unit.markDead(now);
      this.match.notifyHeroKill();
    }
  }

  private inputLocked(): boolean {
    return this.match.finished || this.match.paused || this.results.isOpen || !this.player.alive;
  }

  private freezeField(): void {
    for (const unit of this.heroes) {
      unit.body.stop();
    }
    this.player.body.stop();
  }

  private aimPlayer(frame: {
    ability1Aiming: boolean;
    ability1Aim: Phaser.Math.Vector2;
    ability2Aiming: boolean;
    ability2Aim: Phaser.Math.Vector2;
    aimActive: boolean;
    aim: Phaser.Math.Vector2;
    blockHeld: boolean;
    blockAimActive: boolean;
    blockAim: Phaser.Math.Vector2;
  }): void {
    if (frame.ability2Aiming && frame.ability2Aim.lengthSq() > 0) {
      this.player.body.setAim(frame.ability2Aim);
    } else if (frame.ability1Aiming && frame.ability1Aim.lengthSq() > 0) {
      this.player.body.setAim(frame.ability1Aim);
    } else if (frame.blockHeld && frame.blockAimActive) {
      this.player.body.setAim(frame.blockAim);
    } else if (frame.aimActive || frame.aim.lengthSq() > 0.01) {
      this.player.body.setAim(frame.aim);
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

  private syncAimGuides(frame: { ability1Aiming: boolean; ability2Aiming: boolean }): void {
    const ninja = this.player.body;
    if (ninja.heroId === 'cole') {
      this.marker.syncBallAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, COLE_BALL.explodeRadius, frame.ability1Aiming);
    } else if (ninja.heroId === 'death' && frame.ability2Aiming) {
      this.marker.syncSmashAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, DEATH_SMASH.radius, true);
    } else if (ninja.heroId === 'ninja' && frame.ability2Aiming) {
      this.marker.syncKickAim(
        ninja.x,
        ninja.y,
        ninja.aim.x,
        ninja.aim.y,
        NINJA_KICK.dashDistance,
        true,
        NINJA_KICK.aimHalfWidth,
      );
    } else {
      this.marker.clearBallAim();
    }
  }

  private syncHud(now: number): void {
    this.hud.sync(
      this.player.body,
      undefined,
      now,
      this.player.attacks.comboStep,
      this.player.block,
      this.player.dash,
    );
    this.matchHud.sync(this.match.snapshot(), this.score.snapshot(), this.player.progression);
    if (this.battlefield && this.minimap) {
      this.minimap.sync({
        layout: this.battlefield.layout,
        player: this.player.body,
        heroes: this.heroes.map((unit) => unit.body),
        minions: this.minions.allBodies(),
      });
    }
    this.inputReader.syncButtons({
      dashCharges: this.player.dash.chargeCount,
      dashMax: this.player.dash.maxCharges,
      dashRecharge: this.player.dash.rechargeRatio(now),
      blocking: this.player.block.isActive(now),
      staminaRatio: this.player.body.stamina / this.player.body.stats.maxStamina,
    });
    const states = this.player.abilities.allStates(now);
    this.inputReader.syncAbilities(states);
    this.abilityTray?.sync(states);
  }

  private allCombatants(): NinjaBody[] {
    return [...this.heroes.filter((hero) => hero.body.isPresent).map((hero) => hero.body), ...this.minions.allBodies()];
  }

  private livingFighters(): NinjaBody[] {
    return this.allCombatants().filter((unit) => !unit.down && unit.isPresent);
  }

  private livingEnemies(): NinjaBody[] {
    return this.livingFighters().filter((unit) => unit.team !== this.player.team);
  }

  private drawAiDebug(): void {
    this.minions.drawDebug(DEV_CHEATS.showRanges, DEV_CHEATS.showAi, DEV_CHEATS.showHitboxes, this.time.now);
    if (!DEV_CHEATS.showAi) {
      this.aiOverlay?.draw([], false);
      return;
    }
    const subjects = [];
    for (const [unit, pilot] of this.pilots) {
      if (!unit.alive) {
        continue;
      }
      const info = pilot.debugInfo(unit);
      subjects.push({
        x: unit.body.x,
        y: unit.body.y,
        debug: info,
        target: pilot.mind.target,
      });
    }
    this.aiOverlay?.draw(subjects, true);
  }

  private createChrome(): void {
    const width = this.scale.width;
    this.chromeBar = this.add.rectangle(width / 2, 22, width, 44, COLORS.ink, 0.78);
    this.chromeBar.setStrokeStyle(2, COLORS.paper).setScrollFactor(0).setDepth(99);
    this.titleText = this.add
      .text(22, 22, `SECRET WARS  //  ${this.player.body.stats.displayName.toUpperCase()}`, {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100);
    this.menuButton = new ActionButton(this, width - 108, 22, {
      label: 'MENU',
      width: 150,
      height: 40,
      onPress: () => this.returnToMenu(),
    });
    this.menuButton.setScrollFactor(0).setDepth(120);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    this.chromeBar?.setPosition(width / 2, 22).setSize(width, 44);
    this.titleText?.setPosition(22, 22);
    this.menuButton?.setPosition(width - 108, 22);
    this.hud?.layout(width);
    this.hud?.placeCombo(width / 2, 88);
    this.matchHud?.layout(width);
    this.minimap?.layout(width);
    this.inputReader?.layout(width, height);
    this.abilityTray?.layout(52, 148, 1);
    this.cameras.main.setSize(width, height);
  }

  private restartMatch(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    this.scene.restart({ heroId: this.startHeroId });
  }

  private returnToMenu(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    fadeToScene(this, 'MainMenu');
  }

  private bindDebugApi(): void {
    (window as Window & { secretWarsMatch?: object }).secretWarsMatch = {
      snapshot: () => this.gameState(),
      forceWave: () => this.waves.spawnWave(),
      giveXp: (amount = MATCH.xp.debugGrant) => this.player.progression.grantXp(amount),
      giveLevel: () => this.player.progression.giveLevel(),
      scores: () => this.score.snapshot(),
      phase: () => this.match.snapshot(),
      toggleAi: () => {
        DEV_CHEATS.showAi = !DEV_CHEATS.showAi;
        return DEV_CHEATS.showAi;
      },
    };
  }

  private unbindDebugApi(): void {
    const host = window as Window & { secretWarsMatch?: object };
    delete host.secretWarsMatch;
  }
}
