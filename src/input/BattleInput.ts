import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { INPUT } from '../config/input';
import { isTouchPrimary } from '../device';
import { AbilitySlotState, HeroAbilityKit } from '../heroes/abilities/types';
import { AbilityButton } from '../ui/AbilityButton';
import { CombatButton } from '../ui/CombatButton';
import { COLORS, getTouchControlLayout } from '../ui/theme';
import { VirtualThumbstick } from './VirtualThumbstick';

export type BattleFrame = {
  move: Phaser.Math.Vector2;
  aim: Phaser.Math.Vector2;
  aimActive: boolean;
  attackHeld: boolean;
  attackPressed: boolean;
  blockHeld: boolean;
  dashPressed: boolean;
  ability1: boolean;
  ability2: boolean;
  ultimate: boolean;
};

type KeyMap = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
  block: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  ability1: Phaser.Input.Keyboard.Key;
  ability2: Phaser.Input.Keyboard.Key;
  ultimate: Phaser.Input.Keyboard.Key;
  ability1Alt: Phaser.Input.Keyboard.Key;
  ability2Alt: Phaser.Input.Keyboard.Key;
  ultimateAlt: Phaser.Input.Keyboard.Key;
};

/**
 * Left stick / WASD = move. Right stick / mouse = aim.
 * Right stick wins the hit marker whenever it is held.
 */
export class BattleInput {
  private readonly scene: Phaser.Scene;
  private readonly isRoundLocked: () => boolean;
  private readonly touch: boolean;
  private readonly leftStick?: VirtualThumbstick;
  private readonly rightStick?: VirtualThumbstick;
  private readonly blockButton?: CombatButton;
  private readonly dashButton?: CombatButton;
  private readonly ability1Button?: AbilityButton;
  private readonly ability2Button?: AbilityButton;
  private readonly ultimateButton?: AbilityButton;
  private readonly keys?: KeyMap;
  private readonly cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly lastAim = new Phaser.Math.Vector2(1, 0);
  private wasAttackHeld = false;
  private attackLatched = false;
  private blockHeldTouch = false;
  private dashLatched = false;
  private ability1Latched = false;
  private ability2Latched = false;
  private ultimateLatched = false;
  private lastAttackPressAt = -999;

  constructor(
    scene: Phaser.Scene,
    isRoundLocked: () => boolean = () => false,
    kit?: HeroAbilityKit,
  ) {
    this.scene = scene;
    this.isRoundLocked = isRoundLocked;
    this.touch = isTouchPrimary();

    if (this.touch) {
      const layout = getTouchControlLayout(scene.scale.width, scene.scale.height);

      this.leftStick = new VirtualThumbstick(scene, layout.leftStick.x, layout.leftStick.y, {
        label: 'MOVE',
        accent: COLORS.cyan,
        radius: layout.radius,
      });
      this.rightStick = new VirtualThumbstick(scene, layout.rightStick.x, layout.rightStick.y, {
        label: 'AIM',
        accent: COLORS.redBright,
        radius: layout.radius,
      });

      this.blockButton = new CombatButton(scene, layout.block.x, layout.block.y, {
        label: 'SHIELD',
        accent: COLORS.cyan,
        holdable: true,
        onPress: () => {
          this.blockHeldTouch = true;
        },
        onRelease: () => {
          this.blockHeldTouch = false;
        },
      });
      this.dashButton = new CombatButton(scene, layout.dash.x, layout.dash.y, {
        label: 'DASH',
        accent: COLORS.orange,
        onPress: () => {
          this.dashLatched = true;
        },
      });
      this.blockButton.setRadius(layout.buttonRadius);
      this.dashButton.setRadius(layout.buttonRadius);
      this.dashButton.setCharges(COMBAT.dashMaxCharges, COMBAT.dashMaxCharges);
      this.dashButton.setRecovered(1);

      if (kit) {
        this.ability1Button = new AbilityButton(
          scene,
          layout.ability1.x,
          layout.ability1.y,
          layout.abilityRadius,
          kit.ability1.iconKey,
          { onPress: () => { this.ability1Latched = true; } },
        );
        this.ability2Button = new AbilityButton(
          scene,
          layout.ability2.x,
          layout.ability2.y,
          layout.abilityRadius,
          kit.ability2.iconKey,
          { onPress: () => { this.ability2Latched = true; } },
        );
        this.ultimateButton = new AbilityButton(
          scene,
          layout.ultimate.x,
          layout.ultimate.y,
          layout.ultimateRadius,
          kit.ultimate.iconKey,
          { ultimate: true, onPress: () => { this.ultimateLatched = true; } },
        );
      }
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
        ability1: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        ability2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        ultimate: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
        ability1Alt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        ability2Alt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        ultimateAlt: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      };
      this.keys.attack.on('down', () => {
        this.attackLatched = true;
      });
      this.keys.dash.on('down', () => {
        this.dashLatched = true;
      });
      this.keys.ability1.on('down', () => {
        this.ability1Latched = true;
      });
      this.keys.ability2.on('down', () => {
        this.ability2Latched = true;
      });
      this.keys.ultimate.on('down', () => {
        this.ultimateLatched = true;
      });
      this.keys.ability1Alt.on('down', () => {
        this.ability1Latched = true;
      });
      this.keys.ability2Alt.on('down', () => {
        this.ability2Latched = true;
      });
      this.keys.ultimateAlt.on('down', () => {
        this.ultimateLatched = true;
      });
    }

    if (!this.touch) {
      scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isRoundLocked()) {
      return;
    }
    if (pointer.leftButtonDown()) {
      this.attackLatched = true;
    }
  }

  layout(width: number, height: number): void {
    if (!this.touch) {
      return;
    }
    const layout = getTouchControlLayout(width, height);
    this.leftStick?.setRadius(layout.radius);
    this.rightStick?.setRadius(layout.radius);
    this.leftStick?.setPosition(layout.leftStick.x, layout.leftStick.y);
    this.rightStick?.setPosition(layout.rightStick.x, layout.rightStick.y);
    this.blockButton?.setRadius(layout.buttonRadius);
    this.dashButton?.setRadius(layout.buttonRadius);
    this.blockButton?.setPosition(layout.block.x, layout.block.y);
    this.dashButton?.setPosition(layout.dash.x, layout.dash.y);
    this.ability1Button?.setRadius(layout.abilityRadius);
    this.ability2Button?.setRadius(layout.abilityRadius);
    this.ultimateButton?.setRadius(layout.ultimateRadius);
    this.ability1Button?.setPosition(layout.ability1.x, layout.ability1.y);
    this.ability2Button?.setPosition(layout.ability2.x, layout.ability2.y);
    this.ultimateButton?.setPosition(layout.ultimate.x, layout.ultimate.y);
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

    const now = this.scene.time.now;
    const attackEdge = attackPressed && now - this.lastAttackPressAt >= 90;
    if (attackEdge) {
      this.lastAttackPressAt = now;
    }

    const blockHeld =
      this.blockHeldTouch ||
      Boolean(this.keys?.block.isDown);
    const dashPressed =
      this.consumeLatch('dashLatched') ||
      Boolean(this.keys && Phaser.Input.Keyboard.JustDown(this.keys.dash));
    const ability1 = this.consumeLatch('ability1Latched');
    const ability2 = this.consumeLatch('ability2Latched');
    const ultimate = this.consumeLatch('ultimateLatched');

    return {
      move,
      aim,
      aimActive,
      attackHeld,
      attackPressed: attackEdge,
      blockHeld,
      dashPressed,
      ability1,
      ability2,
      ultimate,
    };
  }

  private consumeLatch(
    key: 'attackLatched' | 'dashLatched' | 'ability1Latched' | 'ability2Latched' | 'ultimateLatched',
  ): boolean {
    if (!this[key]) {
      return false;
    }
    this[key] = false;
    return true;
  }

  syncButtons(state: {
    dashCharges: number;
    dashMax: number;
    dashRecharge: number;
    blocking: boolean;
    staminaRatio: number;
  }): void {
    this.dashButton?.setCharges(state.dashCharges, state.dashMax);
    this.dashButton?.setRecovered(state.dashCharges <= 0 ? 1 - state.dashRecharge : 1);
    this.dashButton?.setDimmed(state.dashCharges <= 0);
    this.blockButton?.setHeldVisual(state.blocking);
    this.blockButton?.setRecovered(state.staminaRatio);
    this.blockButton?.setDimmed(state.staminaRatio <= 0.02);
  }

  syncAbilities(states: AbilitySlotState[]): void {
    if (states[0]) {
      this.ability1Button?.sync(states[0]);
    }
    if (states[1]) {
      this.ability2Button?.sync(states[1]);
    }
    if (states[2]) {
      this.ultimateButton?.sync(states[2]);
    }
  }

  destroy(): void {
    this.leftStick?.destroy();
    this.rightStick?.destroy();
    this.blockButton?.destroy();
    this.dashButton?.destroy();
    this.ability1Button?.destroy();
    this.ability2Button?.destroy();
    this.ultimateButton?.destroy();
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
