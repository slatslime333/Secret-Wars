import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { RivalBrain } from '../ai/RivalBrain';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { HitMarker } from '../combat/HitMarker';
import { QuickAttack } from '../combat/QuickAttack';
import { NinjaBody } from '../heroes/NinjaBody';
import { BattleInput } from '../input/BattleInput';
import { ActionButton } from '../ui/ActionButton';
import { BattleHud } from '../ui/BattleHud';
import { createGrassyArena } from '../ui/createGrassyArena';
import { DevMenu } from '../ui/DevMenu';
import { RoundOverlay } from '../ui/RoundOverlay';
import { COLORS, FONTS, getUiScale, getViewZoom, hex } from '../ui/theme';
import { NINJA } from '../config/ninja';
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

  constructor() {
    super('Battle');
  }

  create(): void {
    this.returning = false;
    createGrassyArena(this);
    this.physics.world.setBounds(
      ARENA.wallThickness,
      ARENA.wallThickness,
      ARENA.width - ARENA.wallThickness * 2,
      ARENA.height - ARENA.wallThickness * 2,
    );

    this.ninja = new NinjaBody(this, ARENA.playerSpawn.x, ARENA.playerSpawn.y);
    this.marker = new HitMarker(this);
    this.attacks = new QuickAttack(this, this.marker);
    this.block = new BlockController(this);
    this.dash = new DashController(this);
    this.inputReader = new BattleInput(this, () => this.round.isLocked);
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
    this.applyView(this.scale.width, this.scale.height);
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
      return;
    }

    const frame = this.inputReader.sample(this.ninja.x, this.ninja.y);

    if (!this.dash.isActive(now)) {
      this.block.setHeld(now, this.ninja, frame.blockHeld);
    } else {
      this.block.setHeld(now, this.ninja, false);
    }
    this.block.tick(delta, now, this.ninja);

    if (frame.dashPressed && !this.block.isActive(now) && this.dash.tryStart(now, frame.move, this.ninja.aim, this.ninja)) {
      this.attacks.interrupt(now);
    }

    this.dash.apply(now, this.ninja);
    if (
      !this.dash.isActive(now) &&
      !this.ninja.status.shouldLockMovement(now) &&
      !this.block.isActive(now) &&
      !this.ninja.down
    ) {
      this.ninja.applyMove(frame.move);
    }

    this.ninja.setAim(frame.aim);
    this.ninja.tickAmmo(now);
    if (!this.block.isActive(now)) {
      this.ninja.regenStamina(delta, now);
    }
    this.marker.sync(this.ninja.x, this.ninja.y, this.ninja.aim.x, this.ninja.aim.y);
    this.block.sync(now, this.ninja);

    if (this.rival && this.brain) {
      this.brain.update(now, delta, this.rival, this.ninja);
    }
    this.rival?.tickAmmo(now);
    if (this.rival && !this.rivalBlock?.isActive(now)) {
      this.rival.regenStamina(delta, now);
    }

    if (
      !this.ninja.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now)
    ) {
      this.attacks.update(now, frame.attackHeld, frame.attackPressed, this.ninja, this.rival, this.rivalBlock);
    } else {
      this.attacks.update(now, false, false, this.ninja, this.rival, this.rivalBlock);
    }

    this.hud.sync(this.ninja, this.rival, now, this.attacks.comboStep, this.block, this.dash);
    this.inputReader.syncButtons({
      dashCharges: this.dash.chargeCount,
      dashMax: this.dash.maxCharges,
      dashRecharge: this.dash.rechargeRatio(now),
      blocking: this.block.isActive(now),
      staminaRatio: this.ninja.stamina / NINJA.maxStamina,
    });

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
    this.rival = new NinjaBody(this, ARENA.enemySpawn.x, ARENA.enemySpawn.y, { rival: true });
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
      .text(22, 22, 'SECRET WARS  //  NINJA VS NINJA', {
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
    this.layoutChrome(width, this.scale.height);
  }

  private applyView(width: number, height: number): void {
    this.cameras.main.setSize(width, height);
    this.cameras.main.setZoom(getViewZoom(width, height));
  }

  private layoutChrome(width: number, height: number): void {
    const ui = getUiScale(width, height);
    this.chromeBar?.setPosition(width / 2, 22 * ui).setSize(width, 44 * ui);
    this.titleText?.setPosition(22 * ui, 22 * ui).setScale(ui);
    this.menuButton?.setScale(ui).setPosition(width - 108 * ui, 22 * ui);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    this.layoutChrome(width, height);
    this.hud?.layout(width, height);
    this.inputReader?.layout(width, height);
    this.devMenu?.layout(width, height);
    this.applyView(width, height);
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
