import Phaser from 'phaser';
import { ARENA, LANES, type LaneId } from '../config/arena';
import { MATCH } from '../config/match';
import { DEV_CHEATS, resetDevCheats } from '../debug/devCheats';
import { MinionWorld } from '../minions/MinionWorld';
import { PLAYABLE_HEROES, getSelectedHeroId, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { HitMarker } from '../combat/HitMarker';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
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
import { NinjaBody } from '../heroes/NinjaBody';
import { onCombatDamage, onCombatBlocked, isHeroFighter } from '../combat/damageEvents';
import { BattleInput } from '../input/BattleInput';
import { ActionButton } from '../ui/ActionButton';
import { AbilityTray } from '../ui/AbilityTray';
import { BattleHud } from '../ui/BattleHud';
import { MatchHud } from '../ui/MatchHud';
import { spawnKillPopup } from '../ui/KillPopup';
import { spawnStatusPopup } from '../ui/StatusPopup';
import { isPcCombatHud, layoutPcCombatHud } from '../ui/pcCombatHud';
import { cueAbilityReady } from '../audio/abilityReady';
import { PostMatchOverlay } from '../ui/PostMatchOverlay';
import { PauseOverlay } from '../ui/PauseOverlay';
import { SpectatorOverlay } from '../ui/SpectatorOverlay';
import { Minimap } from '../ui/Minimap';
import { COLORS, FONTS, hex } from '../ui/theme';
import { applyGameplayCamera, layoutHudChrome, lockCameraFollow, measureViewport, installHudCamera, resizeHudCamera, adoptHud } from '../ui/layout';
import { Battlefield, rememberPlayTestSeed, resolvePlayTestSeed } from '../map';
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
import { ObjectiveManager } from '../match/objectives/ObjectiveManager';
import type { ObjectiveKind } from '../config/objective';
import { buildMatchGameState, type MatchGameState } from '../match/MatchQuery';
import { SpectatorCamera } from '../match/SpectatorCamera';
import {
  DEFAULT_SIMULATOR_ROSTER,
  cloneRoster,
  type MatchRoster,
} from '../match/rosterSetup';
import {
  pickPlayerSpawn,
  placeDraft,
  randomizeDraft,
  rememberPlayerSpawn,
  type PlayDraft,
} from '../draft/rosterBuild';
import { xpForMinion } from '../config/match';
import { audio } from '../audio';
import type { TeamId } from '../config/hero';

export type MatchSceneData = {
  heroId?: HeroId;
  simulator?: boolean;
  roster?: MatchRoster;
  draft?: PlayDraft;
  playerTeam?: TeamId;
  playerLane?: LaneId;
};

/** Draft match. Allies fill the other two heroes; non-players use HeroPilot. */
export class MatchScene extends Phaser.Scene {
  private returning = false;
  private startHeroId: HeroId = 'ninja';
  private simulator = false;
  private roster: MatchRoster = cloneRoster(DEFAULT_SIMULATOR_ROSTER);
  private playDraft?: PlayDraft;
  private playerTeam: TeamId = 'alpha';
  private playerLane: LaneId = 'mid';
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
  private wasStunned = false;
  private wasParalyzed = false;
  private matchHud!: MatchHud;
  private results!: PostMatchOverlay;
  private pauseOverlay!: PauseOverlay;
  private spectatorOverlay!: SpectatorOverlay;
  private spectator!: SpectatorCamera;
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
  private objectives?: ObjectiveManager;
  private offDamage?: () => void;
  private offBlocked?: () => void;
  private heroGroup?: Phaser.Physics.Arcade.Group;

  constructor() {
    super('Match');
  }

  init(data: MatchSceneData = {}): void {
    this.simulator = Boolean(data.simulator);
    this.startHeroId = data.heroId ?? getSelectedHeroId();
    this.playDraft = data.draft;
    if (this.simulator) {
      this.roster = cloneRoster(data.roster ?? DEFAULT_SIMULATOR_ROSTER);
      return;
    }
    const draft = data.draft ?? randomizeDraft(this.startHeroId);
    this.playDraft = draft;
    if (data.roster && data.playerTeam && data.playerLane) {
      this.roster = cloneRoster(data.roster);
      this.playerTeam = data.playerTeam;
      this.playerLane = data.playerLane;
      this.startHeroId = this.roster[this.playerTeam][LANES.indexOf(this.playerLane)];
      rememberPlayerSpawn({ team: data.playerTeam, lane: data.playerLane });
      return;
    }
    const spawn = pickPlayerSpawn();
    rememberPlayerSpawn(spawn);
    const placed = placeDraft(draft, spawn);
    this.roster = placed.roster;
    this.playerTeam = placed.playerTeam;
    this.playerLane = placed.playerLane;
  }

  create(): void {
    this.returning = false;
    resetDevCheats();
    ensureAbilityIcons(this);
    installHudCamera(this);
    setSelectedHeroId(this.startHeroId);
    const hero = PLAYABLE_HEROES[this.startHeroId];
    const battlefield = Battlefield.install(this, { seed: resolvePlayTestSeed(), log: true });
    this.battlefield = battlefield;
    rememberPlayTestSeed(battlefield.result.seed);
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
    this.abilityWorld.minionWorld = this.minions;
    this.waves = new WaveDirector(this.minions);
    this.orbs = new XpOrbWorld(this, (grant) => this.grantMinionReward(grant.target, grant.amount));
    this.objectives = new ObjectiveManager({
      scene: this,
      match: this.match,
      score: this.score,
      query: battlefield.query,
      orbs: this.orbs,
      heroes: () => this.heroes,
      grantLevel: (hero) => {
        hero.progression.giveLevel();
      },
    });
    this.minions.onKilled = (event) => {
      if (!event.killer || !isHeroFighter(event.killer) || !event.killer.isPresent || event.killer.down) {
        return;
      }
      this.orbs.spawn(event.x, event.y, event.killer, xpForMinion(event.kind), event.team);
    };

    this.heroes = [];
    this.emptyAllySlots = [];
    if (this.simulator) {
      this.spawnSimulator();
    } else {
      this.spawnDraft();
    }

    this.heroGroup = this.physics.add.group(this.heroes.map((unit) => unit.body.sprite));
    this.physics.add.collider(this.heroGroup, this.heroGroup);
    this.battlefield.attachGroup(this.heroGroup);
    this.battlefield.configureCrates({
      heroes: () => this.heroes.map((unit) => unit.body),
      orbs: this.orbs,
      grantXp: (body, amount) => {
        const runtime = this.heroes.find((unit) => unit.body === body);
        if (!runtime || !body.isPresent || body.down) {
          return;
        }
        const leveled = runtime.progression.grantXp(amount);
        audio.play('ui-xp');
        if (leveled.leveled) {
          audio.play('ui-level-up');
        }
      },
    });
    this.pilots.clear();
    for (const unit of this.heroes) {
      if (!unit.isPlayer) {
        this.pilots.set(unit, new HeroPilot(unit));
      }
    }

    this.aiOverlay = new TacticalOverlay(this);
    this.marker = new HitMarker(this);
    this.spectator = new SpectatorCamera(this, () => this.heroes);
    this.inputReader = new BattleInput(
      this,
      () => this.inputLocked(),
      this.simulator ? undefined : hero.kit,
      this.simulator ? 3 : hero.stats.dashMaxCharges,
      !this.simulator,
    );
    if (!isTouchPrimary() && !this.simulator) {
      this.abilityTray = new AbilityTray(this, 52, 148, 1, {
        onSlotPress: (slot) => this.inputReader.togglePcAim(slot),
        aimingSlot: () => this.inputReader.pcAimSlot(),
      });
    }
    this.hud = new BattleHud(this);
    this.hud.placeCombo(this.scale.width / 2, layoutHudChrome(measureViewport(this.scale.width, this.scale.height)).comboY);
    this.matchHud = new MatchHud(this);
    this.layoutAbilityTray(this.scale.width, this.scale.height);
    this.minimap = new Minimap(this);
    this.results = new PostMatchOverlay(this, {
      onRematch: () => this.restartMatch(),
      onMenu: () => this.returnToMenu(),
    });
    this.pauseOverlay = new PauseOverlay(this, {
      onContinue: () => this.closePause(),
      onExit: () => this.returnToMenu(),
    });
    this.spectatorOverlay = new SpectatorOverlay(this, {
      onPrev: () => this.spectator.cycle(-1),
      onNext: () => this.spectator.cycle(1),
    });

    this.cameras.main.removeBounds();
    this.cameras.main.setBackgroundColor(ARENA.wallColor);
    if (this.simulator) {
      this.spectator.enable(this.player);
    } else {
      lockCameraFollow(this.cameras.main, this.player.body.sprite);
    }
    this.cameras.main.setRoundPixels(true);
    applyGameplayCamera(this.cameras.main, this.scale.width, this.scale.height);
    resizeHudCamera(this, this.scale.width, this.scale.height);
    this.cameras.main.fadeIn(220, 7, 10, 18);

    this.createChrome();
    this.waves.start(this.time.now);
    this.offDamage = onCombatDamage((event) => this.stats.recordDamage(event));
    this.offBlocked = onCombatBlocked((event) => this.stats.recordBlocked(event.defender, event.amount));
    audio.unlock();
    audio.play('ui-match-start');

    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard?.addCapture(['ESC']);
    this.input.keyboard?.on('keydown-ESC', this.togglePauseMenu, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.bindDebugApi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.input.keyboard?.off('keydown-ESC', this.togglePauseMenu, this);
      this.offDamage?.();
      this.offBlocked?.();
      this.abilityWorld.destroy();
      this.minions.destroy();
      this.orbs.destroy();
      this.objectives?.destroy();
      this.objectives = undefined;
      this.abilityTray?.destroy();
      this.minimap?.destroy();
      this.spectatorOverlay?.destroy();
      this.pauseOverlay?.destroy();
      this.battlefield?.destroy();
      for (const unit of this.heroes) {
        unit.destroy();
      }
      this.aiOverlay?.destroy();
      this.unbindDebugApi();
      audio.stopAllLoops();
    });
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    if (this.match.paused) {
      return;
    }

    this.match.update(delta);
    for (const unit of this.heroes) {
      unit.sync();
    }

    if (this.match.finished) {
      this.objectives?.endMatch();
      this.freezeField();
      this.syncHud(now);
      this.spectatorOverlay.hide();
      if (!this.results.isOpen) {
        this.results.show(this.match.winner, this.player.team, this.stats.allLines());
      }
      return;
    }

    this.waves.update(now);
    this.objectives?.update(now, delta);
    this.battlefield?.update(now, delta);
    this.orbs.update(now, delta);
    this.abilityWorld.update(now, this.allCombatants(), delta);
    for (const unit of this.heroes) {
      unit.syncKitPressure(now);
    }
    this.tactics.refresh(now, this.livingFighters());
    this.minions.update(now, delta, this.abilityWorld, this.tactics);

    for (const unit of this.heroes) {
      if (!unit.isPlayer) {
        const target = this.pilots.get(unit)?.mind.target;
        const rival = target ? this.heroes.find((hero) => hero.body === target) : undefined;
        this.pilots.get(unit)?.update(now, delta, unit, this.tactics, this, this.abilityWorld, rival?.block, this.livingAlliesFor(unit.body));
      }
      if (unit.maybeRespawn(now) && unit.isPlayer) {
        this.spectator.disable();
        lockCameraFollow(this.cameras.main, unit.body.sprite);
        this.spectatorOverlay.hide();
        this.inputReader.setCombatVisible(true);
        this.abilityTray?.setVisible(true);
      }
    }
    this.drawAiDebug();

    this.resolveHeroDeaths(now);

    if (this.simulator || !this.player.alive) {
      if (!this.simulator) {
        this.player.body.stop();
      }
      this.runSpectator(delta, now);
      this.syncHud(now);
      return;
    }

    this.spectatorOverlay.hide();
    audio.setListener(this.player.body.x, this.player.body.y);
    this.inputReader.setAbilitiesLocked(this.player.body.status.isEnemyActionLocked(now));
    const frame = this.inputReader.sample(this.player.body.x, this.player.body.y);
    if (frame.ability1AimActive) {
      this.abilityAim = { x: frame.ability1Aim.x, y: frame.ability1Aim.y };
    }
    if (frame.ability2AimActive) {
      this.abilityAim = { x: frame.ability2Aim.x, y: frame.ability2Aim.y };
    }
    const ctx = this.player.abilityContext(
      now,
      delta,
      this.livingEnemies(),
      this.abilityWorld,
      undefined,
      this.livingAlliesFor(this.player.body),
    );
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
      this.player.abilityContext(
        now,
        delta,
        this.livingEnemies(),
        this.abilityWorld,
        this.liveAbilityAim(frame),
        this.livingAlliesFor(this.player.body),
      ),
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
      !this.player.body.down
    ) {
      this.player.body.applyMove(frame.move);
    }

    this.aimPlayer(frame);
    this.player.body.regenStamina(delta, now);
    this.player.body.regenBlockShield(delta, now);
    this.player.body.regenHealth(delta, now);
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
    const leveled = runtime?.progression.grantXp(amount);
    target.heal(MATCH.healing.minionKill);
    audio.play('ui-xp');
    if (leveled?.leveled) {
      audio.play('ui-level-up');
    }
  }

  private resolveHeroDeaths(now: number): void {
    for (const unit of this.heroes) {
      if (unit.dead || !unit.body.down) {
        continue;
      }
      const result = this.stats.registerHeroDeath(unit.body, now);
      if (result.killer && result.killer.team !== unit.team) {
        this.score.addKill(result.killer.team, now);
      }
      this.objectives?.notifyHeroDeath(now, unit, result.killer ?? undefined);
      unit.markDead(now);
      this.match.notifyHeroKill();
      const popupHero =
        this.spectator.enabled && this.spectator.target ? this.spectator.target : this.player;
      if (result.killer === popupHero.body && result.killer.team !== unit.team) {
        spawnKillPopup(this, 'KILL', unit.body.stats.displayName);
      } else if (result.assists.includes(popupHero.body)) {
        spawnKillPopup(this, 'ASSIST', unit.body.stats.displayName);
      }
      if (unit.isPlayer) {
        this.cameras.main.stopFollow();
      }
    }
  }

  private inputLocked(): boolean {
    return this.match.finished || this.match.paused || this.results.isOpen;
  }

  private spawnDraft(): void {
    const foe: TeamId = this.playerTeam === 'alpha' ? 'bravo' : 'alpha';
    for (const lane of LANES) {
      const isPlayer = lane === this.playerLane;
      const unit = this.spawnHero({
        instanceId: `${this.playerTeam}-${lane}${isPlayer ? '-player' : ''}`,
        heroId: this.roster[this.playerTeam][LANES.indexOf(lane)],
        team: this.playerTeam,
        lane,
        isPlayer,
      });
      if (isPlayer) {
        this.player = unit;
      }
    }
    for (const lane of LANES) {
      this.spawnHero({
        instanceId: `${foe}-${lane}`,
        heroId: this.roster[foe][LANES.indexOf(lane)],
        team: foe,
        lane,
        isPlayer: false,
      });
    }
  }

  private spawnSimulator(): void {
    for (const team of ['alpha', 'bravo'] as const) {
      LANES.forEach((lane, index) => {
        const unit = this.spawnHero({
          instanceId: `${team}-${lane}`,
          heroId: this.roster[team][index],
          team,
          lane,
          isPlayer: false,
        });
        if (team === 'alpha' && lane === 'mid') {
          this.player = unit;
        }
      });
    }
  }

  private spawnHero(options: {
    instanceId: string;
    heroId: HeroId;
    team: TeamId;
    lane: LaneId;
    isPlayer: boolean;
  }): HeroRuntime {
    const unit = new HeroRuntime(this, options);
    this.heroes.push(unit);
    this.stats.register(unit.body, { instanceId: unit.instanceId, player: options.isPlayer });
    return unit;
  }

  private runSpectator(delta: number, now: number): void {
    if (!this.spectator.enabled) {
      this.enableSpectator(this.player);
    }
    const focus = this.hudFocus();
    const frame = this.inputReader.sample(focus.body.x, focus.body.y);
    this.spectator.tick(frame.move, delta, this.inputLocked());
    const cam = this.cameras.main;
    const locked = this.spectator.mode === 'lock' ? this.spectator.target : null;
    if (locked?.alive) {
      audio.setListener(locked.body.x, locked.body.y);
    } else {
      audio.setListener(cam.worldView.centerX, cam.worldView.centerY);
    }
    this.marker.clear();
    const watching = locked?.alive ? locked : focus;
    this.spectatorOverlay.sync(
      {
        remainingMs: this.simulator || this.player.alive ? 0 : this.player.respawnAt - now,
        simulator: this.simulator,
        mode: this.spectator.mode,
        watchingName: watching.body.stats.displayName,
        watchingSide: this.watchingSide(watching),
      },
      this.scale.width,
      this.scale.height,
    );
  }

  private enableSpectator(origin: HeroRuntime): void {
    const living = this.heroes.filter((hero) => hero.alive);
    const ally = living.find((hero) => hero.team === origin.team && hero !== origin);
    const nearest = [...living].sort(
      (a, b) =>
        Math.hypot(a.body.x - origin.body.x, a.body.y - origin.body.y) -
        Math.hypot(b.body.x - origin.body.x, b.body.y - origin.body.y),
    )[0];
    this.spectator.enable(this.simulator ? origin : (ally ?? nearest ?? null));
    this.inputReader.setCombatVisible(false);
    this.abilityTray?.setVisible(false);
  }

  private hudFocus(): HeroRuntime {
    if (this.spectator.enabled && this.spectator.mode === 'lock' && this.spectator.target?.alive) {
      return this.spectator.target;
    }
    if (this.spectator.enabled) {
      const cam = this.cameras.main;
      const cx = cam.worldView.centerX;
      const cy = cam.worldView.centerY;
      let best: HeroRuntime | undefined;
      let bestD = Infinity;
      for (const hero of this.heroes) {
        if (!hero.alive) {
          continue;
        }
        const d = Math.hypot(hero.body.x - cx, hero.body.y - cy);
        if (d < bestD) {
          bestD = d;
          best = hero;
        }
      }
      if (best) {
        return best;
      }
    }
    return this.player;
  }

  private watchingSide(unit: HeroRuntime): string {
    if (this.simulator) {
      return unit.team === 'alpha' ? 'ALPHA' : 'BRAVO';
    }
    return unit.team === this.player.team ? 'ALLY' : 'ENEMY';
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

  private syncAimGuides(frame: { ability1Aiming: boolean; ability2Aiming: boolean; attackHeld: boolean }): void {
    const ninja = this.player.body;
    if (ninja.heroId === 'rope' && !frame.ability1Aiming && !frame.ability2Aiming) {
      this.marker.syncRopeAim(
        ninja.x,
        ninja.y,
        ninja.aim.x,
        ninja.aim.y,
        ninja.stats.attackRange * 1.25,
        frame.attackHeld,
        this.player.attacks.nextRopeArm,
        ROPE_SHOT.armOffsetRad,
      );
    } else if (ninja.heroId === 'mender' && !frame.ability1Aiming && !frame.ability2Aiming) {
      this.marker.syncPulseAim(
        ninja.x,
        ninja.y,
        ninja.aim.x,
        ninja.aim.y,
        ninja.stats.attackRange,
        frame.attackHeld,
        this.player.attacks.nextRopeArm,
        MENDER_PULSE.armOffsetRad,
      );
    } else if (ninja.heroId === 'witch') {
      this.marker.syncWitchAim(
        ninja.x,
        ninja.y,
        ninja.aim.x,
        ninja.aim.y,
        ninja.stats.attackRange,
        frame.attackHeld,
        witchHexAllyRange(),
      );
    } else if (ninja.heroId === 'rope') {
      this.marker.clearRange();
    } else if (ninja.heroId === 'mender') {
      this.marker.clearRange();
    } else {
      const range = ninja.heroId === 'cole' ? COLE_ATTACK.range : ninja.stats.attackRange;
      this.marker.sync(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, range, ninja.stats.attackArcDegrees);
    }
    if (ninja.heroId === 'cole') {
      this.marker.syncBallAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, COLE_BALL.explodeRadius, frame.ability1Aiming);
    } else if (ninja.heroId === 'death' && frame.ability1Aiming && !this.player.abilities.isBusy()) {
      this.marker.syncGunAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, DEATH_GUN.laserLength, true);
    } else if (ninja.heroId === 'death' && frame.ability2Aiming) {
      this.marker.syncSmashAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, DEATH_SMASH.radius, true, DEATH_SMASH.halfWidth);
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
    } else if (ninja.heroId === 'shadow' && frame.ability1Aiming) {
      this.marker.syncKickAim(
        ninja.x,
        ninja.y,
        ninja.aim.x,
        ninja.aim.y,
        SHADOW_CLAW.radius,
        true,
        SHADOW_CLAW.aimHalfWidth,
      );
    } else if (ninja.heroId === 'shadow' && frame.ability2Aiming) {
      this.marker.syncKickAim(
        ninja.x,
        ninja.y,
        ninja.aim.x,
        ninja.aim.y,
        SHADOW_DASH.distance,
        true,
        SHADOW_DASH.aimHalfWidth,
      );
    } else if (ninja.heroId === 'mender' && frame.ability1Aiming) {
      this.marker.syncBallAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, MENDER_ANGEL.radius, true);
    } else if (ninja.heroId === 'mender' && frame.ability2Aiming) {
      this.marker.syncKickAim(
        ninja.x,
        ninja.y,
        ninja.aim.x,
        ninja.aim.y,
        MENDER_SOUL.dashDistance,
        true,
        ninja.stats.bodyRadius * 2 + 8,
      );
    } else if (ninja.heroId === 'demon' && frame.ability1Aiming) {
      const len = Math.hypot(ninja.aim.x, ninja.aim.y) || 1;
      const nx = ninja.aim.x / len;
      const ny = ninja.aim.y / len;
      this.marker.syncBallAim(
        ninja.x + nx * DEMON_HELLFIRE.range,
        ninja.y + ny * DEMON_HELLFIRE.range,
        nx,
        ny,
        DEMON_HELLFIRE.radius,
        true,
      );
    } else if (ninja.heroId === 'rope' && frame.ability1Aiming && !this.player.abilities.isBusy()) {
      this.marker.syncRopeGrabAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, ROPE_GRAB.range, true);
    } else if (ninja.heroId === 'rope' && frame.ability2Aiming) {
      this.marker.syncPunchAim(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, ROPE_PUNCH.radius, true);
    } else {
      this.marker.clearBallAim();
    }
  }

  private syncHud(now: number): void {
    const focus = this.hudFocus();
    const spectating = this.simulator || !this.player.alive;
    this.hud.sync(
      focus.body,
      undefined,
      now,
      focus.attacks.comboStep,
      focus.block,
      focus.dash,
      spectating,
    );
    this.matchHud.sync(this.match.snapshot(), this.score.snapshot(), focus.progression);
    this.titleText?.setText(
      `${this.simulator ? 'SIMULATOR' : 'SECRET WARS'}  //  ${focus.body.stats.displayName.toUpperCase()}`,
    );
    if (this.battlefield && this.minimap) {
      this.minimap.sync({
        layout: this.battlefield.layout,
        player: focus.body,
        heroes: this.heroes.map((unit) => unit.body),
        minions: this.minions.allBodies(),
        objective: this.objectives?.worldPip(),
      });
    }
    if (spectating) {
      this.abilityTray?.setVisible(false);
      return;
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
    cueAbilityReady(this, states);
    this.cuePlayerCrowdControl(now);
  }

  private layoutAbilityTray(width: number, height: number): void {
    if (!this.abilityTray) {
      return;
    }
    if (!isPcCombatHud()) {
      this.abilityTray.layout(52, 148, 1);
      return;
    }
    const hud = layoutPcCombatHud(width, height);
    this.abilityTray.layout(hud.abilityXs[0], hud.abilityY, hud.abilityScale);
  }

  private cuePlayerCrowdControl(now: number): void {
    if (this.simulator || !this.player?.alive) {
      this.wasStunned = false;
      this.wasParalyzed = false;
      return;
    }
    const paralyzed = this.player.body.status.isParalyzed(now);
    const stunned = this.player.body.status.isStunned(now);
    if (paralyzed && !this.wasParalyzed) {
      spawnStatusPopup(this, 'PARALYZED');
    } else if (stunned && !paralyzed && !this.wasStunned) {
      spawnStatusPopup(this, 'STUNNED');
    }
    this.wasParalyzed = paralyzed;
    this.wasStunned = stunned;
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

  private livingAlliesFor(body: NinjaBody): NinjaBody[] {
    return this.heroes
      .filter((hero) => hero.alive && hero.body !== body && hero.team === body.team)
      .map((hero) => hero.body);
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
    const chrome = layoutHudChrome(measureViewport(this.scale.width, this.scale.height));
    this.chromeBar = this.add.rectangle(this.scale.width / 2, chrome.barY, this.scale.width, Math.max(1, chrome.barH), COLORS.ink, 0.78);
    this.chromeBar.setStrokeStyle(2, COLORS.paper).setScrollFactor(0).setDepth(99).setVisible(chrome.barH > 8);
    this.titleText = this.add
      .text(chrome.titleX, chrome.titleY, `SECRET WARS  //  ${this.player.body.stats.displayName.toUpperCase()}`, {
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
      onPress: () => this.openPause(),
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
    this.hud?.placeCombo(width / 2, chrome.comboY);
    this.matchHud?.layout(width, height);
    this.minimap?.layout(width, height);
    this.objectives?.layout(width, height);
    this.inputReader?.layout(width, height);
    this.layoutAbilityTray(width, height);
    resizeHudCamera(this, width, height);
    if ((this.simulator || (this.player && !this.player.alive)) && this.spectatorOverlay) {
      const focus = this.hudFocus();
      this.spectatorOverlay.sync(
        {
          remainingMs: this.simulator || this.player.alive ? 0 : this.player.respawnAt - this.time.now,
          simulator: this.simulator,
          mode: this.spectator.mode,
          watchingName: focus.body.stats.displayName,
          watchingSide: this.watchingSide(focus),
        },
        width,
        height,
      );
    }
    applyGameplayCamera(this.cameras.main, width, height);
    if (this.pauseOverlay?.isOpen) {
      this.pauseOverlay.show(this.stats.allLines());
    }
  }

  private togglePauseMenu = (): void => {
    if (this.returning) {
      return;
    }
    if (this.match.finished || this.results.isOpen) {
      this.returnToMenu();
      return;
    }
    if (this.match.paused) {
      this.closePause();
    } else {
      this.openPause();
    }
  };

  private openPause(): void {
    if (this.returning || this.match.finished || this.results.isOpen || this.match.paused) {
      return;
    }
    this.match.setPaused(true);
    this.physics.world.pause();
    this.time.paused = true;
    this.freezeField();
    this.setPauseChromeVisible(false);
    this.pauseOverlay.show(this.stats.allLines());
  }

  private closePause(): void {
    if (!this.match.paused || this.returning) {
      return;
    }
    this.match.setPaused(false);
    this.physics.world.resume();
    this.time.paused = false;
    this.setPauseChromeVisible(true);
    this.pauseOverlay.hide();
  }

  private setPauseChromeVisible(visible: boolean): void {
    this.chromeBar?.setVisible(visible);
    this.titleText?.setVisible(visible);
    this.menuButton?.setVisible(visible);
    this.matchHud?.setVisible(visible);
    this.minimap?.setVisible(visible);
    this.hud?.setVisible(visible);
    this.abilityTray?.setVisible(visible);
  }

  private restartMatch(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    this.time.paused = false;
    this.physics.world.resume();
    this.scene.restart({
      heroId: this.startHeroId,
      simulator: this.simulator,
      roster: this.simulator ? this.roster : undefined,
      draft: this.playDraft,
    });
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

  private bindDebugApi(): void {
    (window as Window & { secretWarsMatch?: object }).secretWarsMatch = {
      snapshot: () => this.gameState(),
      forceWave: () => this.waves.spawnWave(),
      giveXp: (amount = MATCH.xp.debugGrant) => this.player.progression.grantXp(amount),
      giveLevel: () => this.player.progression.giveLevel(),
      scores: () => this.score.snapshot(),
      phase: () => this.match.snapshot(),
      spawnObjective: (kind?: ObjectiveKind) => this.objectives?.debugSpawn(kind),
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
