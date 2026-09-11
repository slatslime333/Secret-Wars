import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { ChaseBrain } from '../ai/ChaseBrain';
import { BlockController } from '../combat/BlockController';
import { ChaserAttack } from '../combat/ChaserAttack';
import { DashController } from '../combat/DashController';
import { HitMarker } from '../combat/HitMarker';
import { QuickAttack } from '../combat/QuickAttack';
import { ChaserBody } from '../heroes/ChaserBody';
import { NinjaBody } from '../heroes/NinjaBody';
import { BattleInput } from '../input/BattleInput';
import { ActionButton } from '../ui/ActionButton';
import { BattleHud } from '../ui/BattleHud';
import { createArena } from '../ui/createArena';
import { RoundOverlay } from '../ui/RoundOverlay';
import { COLORS, FONTS, GAME_WIDTH, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';

/** Phase 4 battle: Ninja vs a chasing opponent. KO → restart or menu. */
export class BattleScene extends Phaser.Scene {
  private returning = false;
  private ninja!: NinjaBody;
  private chaser!: ChaserBody;
  private inputReader!: BattleInput;
  private marker!: HitMarker;
  private attacks!: QuickAttack;
  private block!: BlockController;
  private dash!: DashController;
  private brain!: ChaseBrain;
  private hud!: BattleHud;
  private round!: RoundOverlay;

  constructor() {
    super('Battle');
  }

  create(): void {
    this.returning = false;
    createArena(this);
    this.physics.world.setBounds(
      ARENA.wallThickness,
      ARENA.wallThickness,
      ARENA.width - ARENA.wallThickness * 2,
      ARENA.height - ARENA.wallThickness * 2,
    );

    this.ninja = new NinjaBody(this, ARENA.playerSpawn.x, ARENA.playerSpawn.y);
    this.chaser = new ChaserBody(this, ARENA.enemySpawn.x, ARENA.enemySpawn.y);
    this.physics.add.collider(this.ninja.sprite, this.chaser.sprite);

    this.marker = new HitMarker(this);
    this.attacks = new QuickAttack(this, this.marker);
    this.block = new BlockController(this);
    this.dash = new DashController(this);
    this.brain = new ChaseBrain(new ChaserAttack(this));
    this.inputReader = new BattleInput(this);
    this.hud = new BattleHud(this);
    this.round = new RoundOverlay(this, {
      onRestart: () => this.restartBattle(),
      onMenu: () => this.returnToMenu(),
    });

    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.startFollow(this.ninja.sprite, true, 0.16, 0.16);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(220, 7, 10, 18);

    this.createChrome();
    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.input.keyboard?.on('keydown-R', this.onRestartKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
      this.input.keyboard?.off('keydown-R', this.onRestartKey, this);
    });
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    this.ninja.syncView();
    this.chaser.syncView();

    if (this.round.isLocked) {
      this.ninja.stop();
      this.chaser.stop();
      this.hud.sync(this.ninja, this.chaser, now, this.attacks.comboStep, this.block, this.dash);
      return;
    }

    const frame = this.inputReader.sample(this.ninja.x, this.ninja.y);

    if (frame.blockPressed && !this.dash.isActive(now) && this.block.tryStart(now, this.ninja)) {
      this.inputReader.notifyBlockCooldown(now);
    }
    if (frame.dashPressed && !this.block.isActive(now) && this.dash.tryStart(now, frame.move, this.ninja.aim, this.ninja)) {
      this.inputReader.notifyDashCooldown(now);
    }

    this.dash.apply(now, this.ninja);
    if (!this.dash.isActive(now) && !this.ninja.isStunned(now) && !this.ninja.down) {
      this.ninja.applyMove(frame.move);
    }

    this.ninja.setAim(frame.aim);
    this.ninja.regenStamina(delta, now);
    this.marker.sync(this.ninja.x, this.ninja.y, this.ninja.aim.x, this.ninja.aim.y);
    this.block.sync(now, this.ninja);
    this.brain.update(now, this.chaser, this.ninja, this.block);

    if (
      !this.ninja.down &&
      !this.ninja.isStunned(now) &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now)
    ) {
      this.attacks.update(now, frame.attackHeld, frame.attackPressed, this.ninja, this.chaser);
    }

    this.hud.sync(this.ninja, this.chaser, now, this.attacks.comboStep, this.block, this.dash);
    this.inputReader.syncButtons(now);

    if (this.ninja.down || this.chaser.down) {
      this.round.lock(this.chaser.down ? 'ninja' : 'chaser');
    }
  }

  private createChrome(): void {
    const bar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH, 44, COLORS.ink, 0.78);
    bar.setStrokeStyle(2, COLORS.paper).setScrollFactor(0).setDepth(99);

    this.add
      .text(22, 22, 'SECRET WARS  //  NINJA VS CHASER', {
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

    const menu = new ActionButton(this, GAME_WIDTH - 108, 22, {
      label: 'MENU',
      width: 150,
      height: 40,
      onPress: () => this.returnToMenu(),
    });
    menu.setScrollFactor(0).setDepth(120);
  }

  private onRestartKey(): void {
    if (this.round.isLocked) {
      this.restartBattle();
    }
  }

  private restartBattle(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
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
