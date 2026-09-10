import Phaser from 'phaser';
import {
  NINJA_CONFIG,
  NINJA_STATS,
  type NinjaState,
} from '../gameplay/ninja';
import {
  ARENA_BOUNDS,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  createArena,
} from '../gameplay/createArena';
import { CombatButton } from '../ui/CombatButton';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, hex } from '../ui/theme';

const CARDINAL_LABELS = {
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W',
} as const;

type CardinalDirection = keyof typeof CARDINAL_LABELS;

export class BattleScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerVisual!: Phaser.GameObjects.Graphics;
  private directionText!: Phaser.GameObjects.Text;
  private attackAura!: Phaser.GameObjects.Arc;
  private aimMarker!: Phaser.GameObjects.Container;
  private leftStick!: VirtualJoystick;
  private rightStick!: VirtualJoystick;
  private blockButton!: CombatButton;
  private dashButton!: CombatButton;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private stateText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private facing = new Phaser.Math.Vector2(1, 0);
  private dashDirection = new Phaser.Math.Vector2(1, 0);
  private cardinal: CardinalDirection = 'east';
  private ninjaState: NinjaState = 'IDLE';
  private stamina: number = NINJA_CONFIG.maxStamina;
  private lastStaminaSpendAt = 0;
  private stateEndsAt = 0;
  private dashEndsAt = 0;
  private blockReadyAt = 0;
  private dashReadyAt = 0;
  private nextHeldAttackAt = 0;
  private lastTapAt = 0;
  private comboCount = 0;
  private matchEndsAt = 0;
  private returningHome = false;

  constructor() {
    super('Battle');
  }

  create(): void {
    createArena(this);
    this.createPlayer();
    this.createHud();
    this.createControls();

    this.cameras.main
      .setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT)
      .startFollow(this.player, true, 0.12, 0.12)
      .setRoundPixels(true);
    this.cameras.main.fadeIn(220, 7, 10, 18);

    this.matchEndsAt = this.time.now + 180_000;
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    const seconds = delta / 1000;
    const moveInput = this.leftStick.getValue();
    const aimInput = this.rightStick.getValue();

    this.updateFacing(moveInput, aimInput);
    this.handleCombatInput(now);
    this.movePlayer(moveInput, seconds, now);
    this.updateState(moveInput, now);
    this.updateStamina(seconds, now);
    this.updateAimMarker();
    this.updateHud(now);
    this.blockButton.update();
    this.dashButton.update();
  }

  private createPlayer(): void {
    const shadow = this.add.ellipse(0, 24, 54, 21, COLORS.ink, 0.42);
    this.attackAura = this.add
      .circle(0, 0, NINJA_CONFIG.attackRadius, COLORS.cyan, 0.045)
      .setStrokeStyle(2, COLORS.cyan, 0.52);
    this.playerVisual = this.add.graphics();
    this.directionText = this.add
      .text(0, 2, CARDINAL_LABELS[this.cardinal], {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.player = this.add.container(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, [
      shadow,
      this.attackAura,
      this.playerVisual,
      this.directionText,
    ]);
    this.player.setDepth(10);
    this.drawPlayer();

    const markerGraphics = this.add.graphics();
    markerGraphics.fillStyle(COLORS.paper, 0.95);
    markerGraphics.fillCircle(0, 0, 7);
    markerGraphics.lineStyle(3, COLORS.redBright);
    markerGraphics.strokeCircle(0, 0, 12);
    markerGraphics.lineStyle(2, COLORS.ink);
    markerGraphics.lineBetween(-17, 0, -8, 0);
    markerGraphics.lineBetween(8, 0, 17, 0);
    markerGraphics.lineBetween(0, -17, 0, -8);
    markerGraphics.lineBetween(0, 8, 0, 17);
    this.aimMarker = this.add.container(0, 0, [markerGraphics]).setDepth(15);
  }

  private drawPlayer(): void {
    this.playerVisual.clear();
    this.playerVisual.fillStyle(COLORS.ink, 0.9);
    this.playerVisual.fillRoundedRect(-23, -33, 46, 66, 5);
    this.playerVisual.lineStyle(3, COLORS.paper, 0.9);
    this.playerVisual.strokeRoundedRect(-23, -33, 46, 66, 5);
    this.playerVisual.fillStyle(COLORS.red);
    this.playerVisual.fillRect(-20, -23, 40, 10);
    this.playerVisual.fillStyle(COLORS.cyanDark);
    this.playerVisual.fillRect(-18, 17, 36, 10);

    if (this.ninjaState === 'BLOCK') {
      this.playerVisual.lineStyle(3, COLORS.cyan);
      this.playerVisual.strokeRoundedRect(-28, -38, 56, 76, 8);
    } else if (this.ninjaState === 'DASH') {
      this.playerVisual.lineStyle(3, COLORS.orange);
      this.playerVisual.strokeRoundedRect(-27, -37, 54, 74, 7);
    } else if (
      this.ninjaState === 'NORMAL_ATTACK' ||
      this.ninjaState === 'HEAVY_ATTACK'
    ) {
      this.playerVisual.fillStyle(
        this.ninjaState === 'HEAVY_ATTACK' ? COLORS.orange : COLORS.cyan,
        0.6,
      );
      this.playerVisual.fillRect(-19, -8, 38, 19);
    }
  }

  private createControls(): void {
    this.leftStick = new VirtualJoystick(this, 116, 419, {
      label: 'MOVE',
      accent: COLORS.cyan,
      radius: 67,
    });
    this.rightStick = new VirtualJoystick(this, 844, 421, {
      label: 'AIM / ATTACK',
      accent: COLORS.redBright,
      radius: 67,
    });

    this.dashButton = new CombatButton(this, 729, 358, {
      label: 'DASH',
      accent: COLORS.orange,
      onPress: () => this.tryDash(),
    });
    this.blockButton = new CombatButton(this, 817, 319, {
      label: 'BLOCK',
      accent: COLORS.cyan,
      onPress: () => this.tryBlock(),
    });
  }

  private createHud(): void {
    const hud = this.add.graphics().setScrollFactor(0).setDepth(100);
    hud.fillStyle(COLORS.ink, 0.86);
    hud.fillPoints(
      [
        new Phaser.Geom.Point(18, 17),
        new Phaser.Geom.Point(340, 17),
        new Phaser.Geom.Point(324, 111),
        new Phaser.Geom.Point(18, 111),
      ],
      true,
    );
    hud.lineStyle(2, COLORS.cyan, 0.85);
    hud.strokePoints(
      [
        new Phaser.Geom.Point(18, 17),
        new Phaser.Geom.Point(340, 17),
        new Phaser.Geom.Point(324, 111),
        new Phaser.Geom.Point(18, 111),
      ],
      true,
    );

    this.add
      .text(31, 27, 'NINJA', {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.add
      .text(130, 32, `// ${NINJA_CONFIG.role} // STATS ${NINJA_STATS.attack}`, {
        fontFamily: FONTS.body,
        fontSize: '9px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      })
      .setScrollFactor(0)
      .setDepth(102);

    hud.fillStyle(0x33141a, 1);
    hud.fillRect(31, 61, 270, 16);
    hud.fillStyle(COLORS.redBright);
    hud.fillRect(34, 64, 264, 10);
    hud.lineStyle(2, COLORS.paper, 0.45);
    hud.strokeRect(31, 61, 270, 16);
    this.add
      .text(306, 69, '100 HP', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(103);

    this.staminaBar = this.add.graphics().setScrollFactor(0).setDepth(102);

    this.stateText = this.add
      .text(31, 115, 'IDLE', {
        fontFamily: FONTS.display,
        fontSize: '11px',
        color: hex(COLORS.cyan),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(103);

    const timerPlate = this.add.graphics().setScrollFactor(0).setDepth(100);
    timerPlate.fillStyle(COLORS.ink, 0.82);
    timerPlate.fillPoints(
      [
        new Phaser.Geom.Point(416, 14),
        new Phaser.Geom.Point(544, 14),
        new Phaser.Geom.Point(530, 62),
        new Phaser.Geom.Point(430, 62),
      ],
      true,
    );
    timerPlate.lineStyle(2, COLORS.redBright);
    timerPlate.strokePoints(
      [
        new Phaser.Geom.Point(416, 14),
        new Phaser.Geom.Point(544, 14),
        new Phaser.Geom.Point(530, 62),
        new Phaser.Geom.Point(430, 62),
      ],
      true,
    );
    this.timerText = this.add
      .text(GAME_WIDTH / 2, 38, '03:00', {
        fontFamily: FONTS.display,
        fontSize: '23px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    const home = this.add
      .text(GAME_WIDTH - 25, 29, 'HOME', {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: hex(COLORS.paper),
        backgroundColor: hex(COLORS.ink),
        padding: { x: 14, y: 8 },
        stroke: hex(COLORS.red),
        strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(110)
      .setInteractive({ useHandCursor: true });
    home.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.returnHome());

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 13, 'MOBILE COMBAT TEST // NO ENEMIES DEPLOYED', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        backgroundColor: '#070a12cc',
        padding: { x: 9, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100);
  }

  private handleCombatInput(now: number): void {
    if (this.rightStick.consumePressed()) {
      this.handleAttackTap(now);
      this.nextHeldAttackAt = now + 300;
    }

    if (this.rightStick.consumeReleased()) {
      this.nextHeldAttackAt = 0;
    }

    if (
      this.rightStick.active &&
      this.nextHeldAttackAt > 0 &&
      now >= this.nextHeldAttackAt &&
      this.ninjaState !== 'BLOCK' &&
      this.ninjaState !== 'DASH'
    ) {
      this.performAttack(false);
      this.nextHeldAttackAt = now + NINJA_CONFIG.lightAttackInterval;
    }

    if (now - this.lastTapAt > NINJA_CONFIG.comboWindow) {
      this.comboCount = 0;
    }
  }

  private handleAttackTap(now: number): void {
    if (this.ninjaState === 'BLOCK' || this.ninjaState === 'DASH') {
      return;
    }
    if (now - this.lastTapAt > NINJA_CONFIG.comboWindow) {
      this.comboCount = 0;
    }

    this.comboCount += 1;
    this.lastTapAt = now;
    const heavy = this.comboCount >= 3;
    if (heavy) {
      this.comboCount = 0;
    }
    this.performAttack(heavy);
  }

  private performAttack(heavy: boolean): void {
    const cost = heavy ? NINJA_CONFIG.heavyAttackCost : NINJA_CONFIG.lightAttackCost;
    if (!this.spendStamina(cost)) {
      this.flashState('EXHAUSTED', COLORS.orange);
      return;
    }

    this.setState(heavy ? 'HEAVY_ATTACK' : 'NORMAL_ATTACK', heavy ? 260 : 135);
    this.createSlash(heavy);
    if (heavy) {
      this.cameras.main.shake(90, 0.004);
    }
  }

  private createSlash(heavy: boolean): void {
    const direction = this.getAttackDirection();
    const angle = direction.angle();
    const effect = this.add.graphics().setPosition(this.player.x, this.player.y).setDepth(14);
    const radius = heavy ? 94 : 76;

    effect.lineStyle(heavy ? 12 : 7, heavy ? COLORS.orange : COLORS.paper, 0.92);
    effect.beginPath();
    effect.arc(0, 0, radius, -0.56, 0.56, false);
    effect.strokePath();
    effect.lineStyle(heavy ? 5 : 3, heavy ? COLORS.yellow : COLORS.cyan, 0.9);
    effect.beginPath();
    effect.arc(0, 0, radius - 12, -0.48, 0.48, false);
    effect.strokePath();
    effect.setRotation(angle);

    const impact = this.add
      .rectangle(
        this.player.x + direction.x * radius,
        this.player.y + direction.y * radius,
        heavy ? 18 : 10,
        heavy ? 18 : 10,
        heavy ? COLORS.yellow : COLORS.cyan,
        0.9,
      )
      .setRotation(angle)
      .setDepth(15);

    this.tweens.add({
      targets: effect,
      alpha: 0,
      scaleX: heavy ? 1.32 : 1.18,
      scaleY: heavy ? 1.32 : 1.18,
      duration: heavy ? 230 : 130,
      ease: 'Stepped',
      easeParams: [4],
      onComplete: () => effect.destroy(),
    });
    this.tweens.add({
      targets: impact,
      alpha: 0,
      x: impact.x + direction.x * (heavy ? 28 : 15),
      y: impact.y + direction.y * (heavy ? 28 : 15),
      angle: impact.angle + 45,
      duration: heavy ? 220 : 120,
      ease: 'Stepped',
      easeParams: [4],
      onComplete: () => impact.destroy(),
    });
  }

  private tryBlock(): void {
    const now = this.time.now;
    if (now < this.blockReadyAt || !this.spendStamina(NINJA_CONFIG.blockCost)) {
      return;
    }
    this.blockReadyAt = now + NINJA_CONFIG.blockCooldown;
    this.blockButton.startCooldown(NINJA_CONFIG.blockCooldown);
    this.setState('BLOCK', NINJA_CONFIG.blockDuration);
    this.createBlockShield();
  }

  private createBlockShield(): void {
    const direction = this.getAttackDirection();
    const shield = this.add
      .rectangle(
        this.player.x + direction.x * 48,
        this.player.y + direction.y * 48,
        16,
        78,
        COLORS.cyan,
        0.38,
      )
      .setStrokeStyle(4, COLORS.paper, 0.9)
      .setRotation(direction.angle())
      .setDepth(14);

    this.tweens.add({
      targets: shield,
      alpha: 0,
      scaleY: 1.18,
      duration: NINJA_CONFIG.blockDuration,
      ease: 'Stepped',
      easeParams: [4],
      onComplete: () => shield.destroy(),
    });
  }

  private tryDash(): void {
    const now = this.time.now;
    if (now < this.dashReadyAt || !this.spendStamina(NINJA_CONFIG.dashCost)) {
      return;
    }

    const moveDirection = this.leftStick.getValue();
    this.dashDirection.copy(moveDirection.lengthSq() > 0.02 ? moveDirection.normalize() : this.facing);
    this.dashEndsAt = now + NINJA_CONFIG.dashDuration;
    this.dashReadyAt = now + NINJA_CONFIG.dashCooldown;
    this.dashButton.startCooldown(NINJA_CONFIG.dashCooldown);
    this.setState('DASH', NINJA_CONFIG.dashDuration);
    this.createDashBoost();
  }

  private createDashBoost(): void {
    const reverse = this.dashDirection.clone().negate();
    for (let index = 0; index < 5; index += 1) {
      const offset = 18 + index * 10;
      const trail = this.add
        .rectangle(
          this.player.x + reverse.x * offset + Phaser.Math.Between(-6, 6),
          this.player.y + reverse.y * offset + Phaser.Math.Between(-6, 6),
          19 - index * 2,
          5,
          index % 2 === 0 ? COLORS.paper : COLORS.cyan,
          0.75,
        )
        .setRotation(this.dashDirection.angle())
        .setDepth(8);
      this.tweens.add({
        targets: trail,
        alpha: 0,
        x: trail.x + reverse.x * 38,
        y: trail.y + reverse.y * 38,
        duration: 180 + index * 25,
        ease: 'Stepped',
        easeParams: [4],
        onComplete: () => trail.destroy(),
      });
    }
  }

  private movePlayer(moveInput: Phaser.Math.Vector2, seconds: number, now: number): void {
    const velocity = new Phaser.Math.Vector2();

    if (now < this.dashEndsAt) {
      velocity.copy(this.dashDirection).scale(NINJA_CONFIG.dashSpeed);
    } else if (this.ninjaState !== 'BLOCK' && moveInput.lengthSq() > 0.01) {
      const magnitude = Math.min(1, moveInput.length());
      const speed =
        magnitude < 0.46
          ? NINJA_CONFIG.walkSpeed * (0.62 + magnitude * 0.7)
          : NINJA_CONFIG.runSpeed * magnitude;
      velocity.copy(moveInput).normalize().scale(speed);
    }

    this.player.x = Phaser.Math.Clamp(
      this.player.x + velocity.x * seconds,
      ARENA_BOUNDS.left,
      ARENA_BOUNDS.right,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + velocity.y * seconds,
      ARENA_BOUNDS.top,
      ARENA_BOUNDS.bottom,
    );
  }

  private updateFacing(
    moveInput: Phaser.Math.Vector2,
    aimInput: Phaser.Math.Vector2,
  ): void {
    const source =
      this.rightStick.active && aimInput.lengthSq() > 0.015
        ? aimInput
        : moveInput.lengthSq() > 0.015
          ? moveInput
          : undefined;
    if (!source) {
      return;
    }

    this.facing.copy(source).normalize();
    const nextCardinal: CardinalDirection =
      Math.abs(this.facing.x) > Math.abs(this.facing.y)
        ? this.facing.x >= 0
          ? 'east'
          : 'west'
        : this.facing.y >= 0
          ? 'south'
          : 'north';
    if (nextCardinal !== this.cardinal) {
      this.cardinal = nextCardinal;
      this.directionText.setText(CARDINAL_LABELS[this.cardinal]);
    }
  }

  private getAttackDirection(): Phaser.Math.Vector2 {
    const aim = this.rightStick.getValue();
    return this.rightStick.active && aim.lengthSq() > 0.015
      ? aim.normalize()
      : this.facing.clone();
  }

  private updateAimMarker(): void {
    const direction = this.getAttackDirection();
    this.aimMarker.setPosition(
      this.player.x + direction.x * NINJA_CONFIG.attackRadius,
      this.player.y + direction.y * NINJA_CONFIG.attackRadius,
    );
    this.attackAura.setStrokeStyle(
      this.rightStick.active ? 3 : 2,
      this.rightStick.active ? COLORS.redBright : COLORS.cyan,
      this.rightStick.active ? 0.75 : 0.5,
    );
  }

  private setState(state: NinjaState, duration = 0): void {
    this.ninjaState = state;
    this.stateEndsAt = duration > 0 ? this.time.now + duration : 0;
    this.drawPlayer();
  }

  private updateState(moveInput: Phaser.Math.Vector2, now: number): void {
    if (this.stateEndsAt > now) {
      return;
    }
    const nextState: NinjaState = moveInput.lengthSq() > 0.015 ? 'WALK' : 'IDLE';
    if (nextState !== this.ninjaState) {
      this.setState(nextState);
    }
  }

  private spendStamina(amount: number): boolean {
    if (this.stamina < amount) {
      return false;
    }
    this.stamina -= amount;
    this.lastStaminaSpendAt = this.time.now;
    return true;
  }

  private updateStamina(seconds: number, now: number): void {
    if (
      now - this.lastStaminaSpendAt > 550 &&
      this.ninjaState !== 'BLOCK' &&
      this.ninjaState !== 'DASH'
    ) {
      this.stamina = Math.min(
        NINJA_CONFIG.maxStamina,
        this.stamina + NINJA_CONFIG.staminaRecoveryPerSecond * seconds,
      );
    }
  }

  private updateHud(now: number): void {
    const staminaRatio = this.stamina / NINJA_CONFIG.maxStamina;
    this.staminaBar.clear();
    this.staminaBar.fillStyle(0x112a31);
    this.staminaBar.fillRect(31, 84, 270, 13);
    this.staminaBar.fillStyle(staminaRatio < 0.2 ? COLORS.orange : COLORS.cyan);
    this.staminaBar.fillRect(34, 87, 264 * staminaRatio, 7);
    this.staminaBar.lineStyle(2, COLORS.paper, 0.35);
    this.staminaBar.strokeRect(31, 84, 270, 13);

    const combo = this.comboCount > 0 ? ` // COMBO ${this.comboCount}/3` : '';
    this.stateText.setText(`${this.ninjaState.replace('_', ' ')}${combo}`);

    const remaining = Math.max(0, this.matchEndsAt - now);
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.timerText.setText(`${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`);
  }

  private flashState(label: string, color: number): void {
    const alert = this.add
      .text(this.player.x, this.player.y - 66, label, {
        fontFamily: FONTS.display,
        fontSize: '13px',
        color: hex(color),
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: alert,
      y: alert.y - 20,
      alpha: 0,
      duration: 480,
      ease: 'Stepped',
      easeParams: [5],
      onComplete: () => alert.destroy(),
    });
  }

  private returnHome(): void {
    if (this.returningHome) {
      return;
    }
    this.returningHome = true;
    this.cameras.main.fadeOut(180, 7, 10, 18);
    this.time.delayedCall(190, () => this.scene.start('Home'));
  }
}
