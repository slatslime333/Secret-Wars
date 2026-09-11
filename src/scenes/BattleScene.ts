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
import { COLORS, FONTS, GAME_WIDTH, hex } from '../ui/theme';
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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

    if (frame.blockPressed && !this.dash.isActive(now) && this.block.tryStart(now, this.ninja)) {
      this.inputReader.notifyBlockCooldown(now);
    }
    if (frame.dashPressed && !this.block.isActive(now) && this.dash.tryStart(now, frame.move, this.ninja.aim, this.ninja)) {
      this.inputReader.notifyDashCooldown(now);
    }

    this.dash.apply(now, this.ninja);
    if (!this.dash.isActive(now) && !this.ninja.status.isBlockStunned(now) && !this.ninja.down) {
      this.ninja.applyMove(frame.move);
    }

    this.ninja.setAim(frame.aim);
    this.ninja.regenStamina(delta, now);
    this.rival?.regenStamina(delta, now);
    this.marker.sync(this.ninja.x, this.ninja.y, this.ninja.aim.x, this.ninja.aim.y);
    this.block.sync(now, this.ninja);

    if (this.rival && this.brain) {
      this.brain.update(now, this.rival, this.ninja);
    }

    if (
      !this.ninja.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now)
    ) {
      this.attacks.update(now, frame.attackHeld, frame.attackPressed, this.ninja, this.rival, this.rivalBlock);
    }

    this.hud.sync(this.ninja, this.rival, now, this.attacks.comboStep, this.block, this.dash);
    this.inputReader.syncButtons(now);

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
    const bar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH, 44, COLORS.ink, 0.78);
    bar.setStrokeStyle(2, COLORS.paper).setScrollFactor(0).setDepth(99);

    this.add
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

    const menu = new ActionButton(this, GAME_WIDTH - 108, 22, {
      label: 'MENU',
      width: 150,
      height: 40,
      onPress: () => this.returnToMenu(),
    });
    menu.setScrollFactor(0).setDepth(120);
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
