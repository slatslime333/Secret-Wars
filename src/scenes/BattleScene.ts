import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { RivalBrain } from '../ai/RivalBrain';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { HitMarker } from '../combat/HitMarker';
import { QuickAttack } from '../combat/QuickAttack';
import { AbilityController } from '../heroes/abilities/AbilityController';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { AbilityContext } from '../heroes/abilities/types';
import { ensureAbilityIcons } from '../heroes/abilities/icons';
import { getSelectedHero } from '../heroes/roster';
import { NinjaBody } from '../heroes/NinjaBody';
import { BattleInput } from '../input/BattleInput';
import { ActionButton } from '../ui/ActionButton';
import { AbilityTray } from '../ui/AbilityTray';
import { BattleHud } from '../ui/BattleHud';
import { createGrassyArena } from '../ui/createGrassyArena';
import { DevMenu } from '../ui/DevMenu';
import { RoundOverlay } from '../ui/RoundOverlay';
import { COLORS, FONTS, hex } from '../ui/theme';
import { isTouchPrimary } from '../device';
import { fadeToScene } from './fadeToScene';

/** Ninja vs rival Ninja. Dev menu can spawn or remove the CPU. */
export class BattleScene extends Phaser.Scene {
  private returning = false;
  private ninja!: NinjaBody;
  private rival?: NinjaBody;
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
  private brain?: RivalBrain;
  private hud!: BattleHud;
  private round!: RoundOverlay;
  private devMenu?: DevMenu;
  private chromeBar?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private menuButton?: ActionButton;
  private abilityAim?: { x: number; y: number };

  constructor() {
    super('Battle');
  }

  create(): void {
    this.returning = false;
    ensureAbilityIcons(this);
    createGrassyArena(this);
    this.physics.world.setBounds(
      ARENA.wallThickness,
      ARENA.wallThickness,
      ARENA.width - ARENA.wallThickness * 2,
      ARENA.height - ARENA.wallThickness * 2,
    );

    const hero = getSelectedHero();
    this.ninja = new NinjaBody(this, ARENA.playerSpawn.x, ARENA.playerSpawn.y, {
      stats: hero.stats,
      draw: hero.draw,
      handSparks: hero.handSparks,
      team: 'alpha',
    });
    this.marker = new HitMarker(this);
    this.attacks = new QuickAttack(this, this.marker);
    this.block = new BlockController(this);
    this.dash = new DashController(this);
    this.abilityWorld = new AbilityWorld();
    this.abilities = new AbilityController(hero.kit);
    this.inputReader = new BattleInput(this, () => this.round.isLocked, hero.kit);
    if (!isTouchPrimary()) {
      this.abilityTray = new AbilityTray(this, 52, 128);
    }
    this.hud = new BattleHud(this);
    this.round = new RoundOverlay(this, {
      onRestart: () => this.restartBattle(),
      onMenu: () => this.returnToMenu(),
    });
    this.devMenu = new DevMenu(this, {
      onToggleCpu: () => this.toggleCpu(),
      cpuPresent: () => Boolean(this.rival),
    });

    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.startFollow(this.ninja.sprite, true, 0.16, 0.16);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(1);
    this.cameras.main.fadeIn(220, 7, 10, 18);

    this.createChrome();
    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard?.addCapture(['ESC', 'R']);
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
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
        this.returnToMenu();
      }
    };
    window.addEventListener('keydown', onDomKey);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
      this.input.keyboard?.off('keydown-R', this.onRestartKey, this);
      window.removeEventListener('keydown', onDomKey);
      this.abilities.destroy();
      this.abilityWorld.destroy();
      this.abilityTray?.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    this.ninja.syncView();
    this.rival?.syncView();
    if (this.rival && this.rivalBlock) {
      this.rivalBlock.sync(now, this.rival);
    }

    if (this.round.isLocked) {
      this.hud.sync(this.ninja, this.rival, now, this.attacks.comboStep, this.block, this.dash);
      this.syncAbilityUi(now);
      return;
    }

    const frame = this.inputReader.sample(this.ninja.x, this.ninja.y);
    if (frame.ability1AimActive) {
      this.abilityAim = { x: frame.ability1Aim.x, y: frame.ability1Aim.y };
    }
    const ctx = this.makeAbilityContext(now, delta);
    if (frame.ability1) {
      this.abilities.tryActivate('ability1', ctx);
      this.abilityAim = undefined;
    }
    if (frame.ability2) {
      this.abilities.tryActivate('ability2', ctx);
    }
    if (frame.ultimate) {
      this.abilities.tryActivate('ultimate', ctx);
    }
    this.abilities.update(this.makeAbilityContext(now, delta));
    this.abilityWorld.update(now, this.livingFighters(), delta);

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
      !this.block.isActive(now) &&
      !this.ninja.down
    ) {
      this.ninja.applyMove(frame.move);
    }

    if (frame.blockHeld && frame.blockAimActive) {
      this.ninja.setAim(frame.blockAim);
    } else {
      this.ninja.setAim(frame.aim);
    }
    this.ninja.tickAmmo(now);
    if (!this.block.isActive(now)) {
      this.ninja.regenStamina(delta, now);
    }
    this.marker.sync(
      this.ninja.x,
      this.ninja.y,
      this.ninja.aim.x,
      this.ninja.aim.y,
      this.ninja.stats.attackRange,
      this.ninja.stats.attackArcDegrees,
    );
    this.block.sync(now, this.ninja);

    if (this.rival && this.brain) {
      this.brain.update(now, delta, this.rival, this.ninja);
    }
    this.rival?.tickAmmo(now);
    if (this.rival && !this.rivalBlock?.isActive(now)) {
      this.rival.regenStamina(delta, now);
    }

    if (
      !control.attack &&
      !this.ninja.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now)
    ) {
      this.attacks.update(now, frame.attackHeld, frame.attackPressed, this.ninja, this.livingEnemies(), this.rivalBlock);
    } else {
      this.attacks.update(now, false, false, this.ninja, this.livingEnemies(), this.rivalBlock);
    }

    this.hud.sync(this.ninja, this.rival, now, this.attacks.comboStep, this.block, this.dash);
    this.inputReader.syncButtons({
      dashCharges: this.dash.chargeCount,
      dashMax: this.dash.maxCharges,
      dashRecharge: this.dash.rechargeRatio(now),
      blocking: this.block.isActive(now),
      staminaRatio: this.ninja.stamina / this.ninja.stats.maxStamina,
    });
    this.syncAbilityUi(now);

    if (this.ninja.down) {
      this.devMenu?.close();
      this.round.lock('rival');
    } else if (this.rival?.down) {
      this.devMenu?.close();
      this.round.lock('ninja');
    }
  }

  private spawnCpu(): void {
    if (this.rival) {
      return;
    }
    this.rival = new NinjaBody(this, ARENA.enemySpawn.x, ARENA.enemySpawn.y, { rival: true, team: 'bravo' });
    this.rivalCollider = this.physics.add.collider(this.ninja.sprite, this.rival.sprite);
    this.rivalAttacks = new QuickAttack(this);
    this.rivalBlock = new BlockController(this);
    this.rivalDash = new DashController(this);
    this.brain = new RivalBrain(this.rivalAttacks, this.rivalBlock, this.rivalDash, this.block);
    this.devMenu?.sync(true);
  }

  private removeCpu(): void {
    if (!this.rival) {
      return;
    }
    this.rivalCollider?.destroy();
    this.rivalCollider = undefined;
    this.rivalBlock?.destroy();
    this.rival.destroy();
    this.rival = undefined;
    this.rivalAttacks = undefined;
    this.rivalBlock = undefined;
    this.rivalDash = undefined;
    this.brain = undefined;
    this.devMenu?.sync(false);
  }

  private toggleCpu(): void {
    if (this.round.isLocked) {
      return;
    }
    if (this.rival) {
      this.removeCpu();
      return;
    }
    this.spawnCpu();
  }

  private createChrome(): void {
    const width = this.scale.width;
    this.chromeBar = this.add.rectangle(width / 2, 22, width, 44, COLORS.ink, 0.78);
    this.chromeBar.setStrokeStyle(2, COLORS.paper).setScrollFactor(0).setDepth(99);

    this.titleText = this.add
      .text(22, 22, `SECRET WARS  //  ${this.ninja.stats.displayName.toUpperCase()} VS NINJA`, {
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
    this.titleText?.setPosition(22, 22).setScale(1);
    this.menuButton?.setScale(1).setPosition(width - 108, 22);
    this.hud?.layout(width);
    this.inputReader?.layout(width, height);
    this.abilityTray?.layout(52, 128, 1);
    this.devMenu?.layout(width, height);
    this.cameras.main.setSize(width, height);
    this.cameras.main.setZoom(1);
  }

  private makeAbilityContext(now: number, delta: number): AbilityContext {
    return {
      scene: this,
      now,
      delta,
      caster: this.ninja,
      enemies: this.rival && !this.rival.down ? [this.rival] : [],
      world: this.abilityWorld,
      interruptCombat: () => {
        this.attacks.interrupt(now);
        this.dash.cancel(this.ninja);
        this.block.setHeld(now, this.ninja, false);
      },
      rivalBlock: this.rivalBlock,
      aimOverride: this.abilityAim,
    };
  }

  private livingFighters(): NinjaBody[] {
    return this.rival ? [this.ninja, this.rival] : [this.ninja];
  }

  private livingEnemies(): NinjaBody[] {
    return this.rival && !this.rival.down ? [this.rival] : [];
  }

  private syncAbilityUi(now: number): void {
    const states = this.abilities.allStates(now);
    this.inputReader.syncAbilities(states);
    this.abilityTray?.sync(states);
  }

  private onRestartKey(): void {
    this.restartBattle();
  }

  private restartBattle(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    this.removeCpu();
    this.scene.restart();
  }

  private returnToMenu(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    fadeToScene(this, 'MainMenu');
  }
}
