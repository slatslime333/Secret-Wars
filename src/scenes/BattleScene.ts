import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { HitMarker } from '../combat/HitMarker';
import { QuickAttack } from '../combat/QuickAttack';
import { DummyTarget } from '../heroes/DummyTarget';
import { NinjaBody } from '../heroes/NinjaBody';
import { BattleInput } from '../input/BattleInput';
import { ActionButton } from '../ui/ActionButton';
import { BattleHud } from '../ui/BattleHud';
import { createArena } from '../ui/createArena';
import { COLORS, FONTS, GAME_WIDTH, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';

/**
 * Phase 2 battle: Ninja, dual-stick/mouse aim, aura/hitmarker, dummy hits.
 */
export class BattleScene extends Phaser.Scene {
  private returning = false;
  private ninja!: NinjaBody;
  private dummy!: DummyTarget;
  private inputReader!: BattleInput;
  private marker!: HitMarker;
  private attacks!: QuickAttack;
  private hud!: BattleHud;

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
    this.dummy = new DummyTarget(this, ARENA.enemySpawn.x, ARENA.enemySpawn.y);
    this.physics.add.collider(this.ninja.sprite, this.dummy.sprite);

    this.marker = new HitMarker(this);
    this.attacks = new QuickAttack(this, this.marker);
    this.inputReader = new BattleInput(this);
    this.hud = new BattleHud(this);

    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.startFollow(this.ninja.sprite, true, 0.16, 0.16);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(220, 7, 10, 18);

    this.createChrome();
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    });
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    const frame = this.inputReader.sample(this.ninja.x, this.ninja.y);
    this.ninja.applyMove(frame.move);
    this.ninja.syncView();
    this.dummy.syncView();
    this.ninja.setAim(frame.aim);
    this.ninja.regenStamina(delta, now);
    this.marker.sync(this.ninja.x, this.ninja.y, this.ninja.aim.x, this.ninja.aim.y);
    this.attacks.update(now, frame.attackHeld, this.ninja, this.dummy);
    this.dummy.update(now);
    this.hud.sync(this.ninja, this.dummy);
  }

  private createChrome(): void {
    const bar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH, 44, COLORS.ink, 0.78);
    bar.setStrokeStyle(2, COLORS.paper).setScrollFactor(0).setDepth(99);

    this.add
      .text(22, 22, 'SECRET WARS  //  NINJA', {
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

  private returnToMenu(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    fadeToScene(this, 'MainMenu');
  }
}
