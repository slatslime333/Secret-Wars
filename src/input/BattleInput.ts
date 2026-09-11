import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { INPUT } from '../config/input';
import { CombatButton } from '../ui/CombatButton';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../ui/theme';
import { VirtualThumbstick } from './VirtualThumbstick';

export type BattleFrame = {
  move: Phaser.Math.Vector2;
  aim: Phaser.Math.Vector2;
  aimActive: boolean;
  attackHeld: boolean;
  attackPressed: boolean;
  blockPressed: boolean;
  dashPressed: boolean;
};

type KeyMap = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
  block: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
};

/**
 * Left stick / WASD = move. Right stick / mouse = aim.
 * Right stick wins the hit marker whenever it is held.
 */
export class BattleInput {
  private readonly scene: Phaser.Scene;
  private readonly touch: boolean;
  private readonly leftStick?: VirtualThumbstick;
  private readonly rightStick?: VirtualThumbstick;
  private readonly blockButton?: CombatButton;
  private readonly dashButton?: CombatButton;
  private readonly keys?: KeyMap;
  private readonly cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly lastAim = new Phaser.Math.Vector2(1, 0);
  private wasAttackHeld = false;
  private attackLatched = false;
  private blockLatched = false;
  private dashLatched = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.touch = scene.sys.game.device.input.touch;

    if (this.touch) {
      this.leftStick = new VirtualThumbstick(scene, 108, GAME_HEIGHT - 108, {
        label: 'MOVE',
        accent: COLORS.cyan,
        radius: INPUT.stickRadius,
      });
      this.rightStick = new VirtualThumbstick(scene, GAME_WIDTH - 108, GAME_HEIGHT - 108, {
        label: 'AIM',
        accent: COLORS.redBright,
        radius: INPUT.stickRadius,
      });
      this.blockButton = new CombatButton(scene, GAME_WIDTH - 186, GAME_HEIGHT - 228, {
        label: 'BLOCK',
        accent: COLORS.cyan,
        onPress: () => {
          this.blockLatched = true;
        },
      });
      this.dashButton = new CombatButton(scene, GAME_WIDTH - 86, GAME_HEIGHT - 228, {
        label: 'DASH',
        accent: COLORS.orange,
        onPress: () => {
          this.dashLatched = true;
        },
      });
    }

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.keys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        attack: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
        block: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
        dash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      };
      this.keys.attack.on('down', () => {
        this.attackLatched = true;
      });
      this.keys.block.on('down', () => {
        this.blockLatched = true;
      });
      this.keys.dash.on('down', () => {
        this.dashLatched = true;
      });
    }

    if (!this.touch) {
      scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.leftButtonDown()) {
      this.attackLatched = true;
    }
  }

  sample(originX: number, originY: number): BattleFrame {
    const move = this.readMove();
    const right = this.rightStick?.getValue() ?? new Phaser.Math.Vector2();
    const rightActive = Boolean(this.rightStick?.active && right.length() >= INPUT.rightDeadzone);

    const aim = this.lastAim.clone();
    let aimActive = false;

    if (rightActive) {
      aim.copy(right).normalize();
      aimActive = true;
    } else if (!this.touch) {
      const mouseAim = this.readMouseAim(originX, originY);
      if (mouseAim) {
        aim.copy(mouseAim);
        aimActive = true;
      } else if (move.lengthSq() > 0) {
        aim.copy(move).normalize();
      }
    } else if (move.lengthSq() > 0) {
      aim.copy(move).normalize();
    }

    this.lastAim.copy(aim);

    const attackHeld =
      rightActive ||
      Boolean(this.keys?.attack.isDown) ||
      (!this.touch && this.scene.input.activePointer.leftButtonDown());
    const attackPressed =
      this.consumeLatch('attackLatched') ||
      Boolean(this.keys && Phaser.Input.Keyboard.JustDown(this.keys.attack)) ||
      (attackHeld && !this.wasAttackHeld);
    this.wasAttackHeld = attackHeld;

    const blockPressed =
      this.consumeLatch('blockLatched') ||
      Boolean(this.keys && Phaser.Input.Keyboard.JustDown(this.keys.block));
    const dashPressed =
      this.consumeLatch('dashLatched') ||
      Boolean(this.keys && Phaser.Input.Keyboard.JustDown(this.keys.dash));

    return { move, aim, aimActive, attackHeld, attackPressed, blockPressed, dashPressed };
  }

  private consumeLatch(key: 'attackLatched' | 'blockLatched' | 'dashLatched'): boolean {
    if (!this[key]) {
      return false;
    }
    this[key] = false;
    return true;
  }

  syncButtons(now: number): void {
    this.blockButton?.sync(now);
    this.dashButton?.sync(now);
  }

  notifyBlockCooldown(now: number): void {
    this.blockButton?.startCooldown(COMBAT.blockCooldownMs, now);
  }

  notifyDashCooldown(now: number): void {
    this.dashButton?.startCooldown(COMBAT.dashCooldownMs, now);
  }

  destroy(): void {
    this.leftStick?.destroy();
    this.rightStick?.destroy();
    this.scene.input?.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
  }

  private readMove(): Phaser.Math.Vector2 {
    const move = new Phaser.Math.Vector2();
    const left = this.leftStick?.getValue();
    if (left && left.length() >= INPUT.leftDeadzone) {
      move.copy(left);
    }

    const cursors = this.cursors;
    if (this.keys?.up.isDown || cursors?.up.isDown) {
      move.y -= 1;
    }
    if (this.keys?.down.isDown || cursors?.down.isDown) {
      move.y += 1;
    }
    if (this.keys?.left.isDown || cursors?.left.isDown) {
      move.x -= 1;
    }
    if (this.keys?.right.isDown || cursors?.right.isDown) {
      move.x += 1;
    }

    if (move.lengthSq() > 1) {
      move.normalize();
    }
    return move;
  }

  private readMouseAim(originX: number, originY: number): Phaser.Math.Vector2 | null {
    const pointer = this.scene.input.activePointer;
    const camera = this.scene.cameras.main;
    pointer.updateWorldPoint(camera);
    const aim = new Phaser.Math.Vector2(pointer.worldX - originX, pointer.worldY - originY);
    if (aim.length() < INPUT.mouseAimDeadzone) {
      return null;
    }
    return aim.normalize();
  }
}
