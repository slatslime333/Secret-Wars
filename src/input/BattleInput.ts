import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { INPUT } from '../config/input';
import { isTouchPrimary } from '../device';
import { AbilitySlot, AbilitySlotState, HeroAbilityKit } from '../heroes/abilities/types';
import { AbilityButton } from '../ui/AbilityButton';
import { CombatButton } from '../ui/CombatButton';
import { COLORS } from '../ui/theme';
import { resolveControls } from '../ui/controlLayout';
import { VirtualAimPad } from './VirtualAimPad';
import { VirtualThumbstick } from './VirtualThumbstick';

export type BattleFrame = {
  move: Phaser.Math.Vector2;
  aim: Phaser.Math.Vector2;
  aimActive: boolean;
  attackHeld: boolean;
  attackPressed: boolean;
  blockHeld: boolean;
  blockAim: Phaser.Math.Vector2;
  blockAimActive: boolean;
  dashPressed: boolean;
  ability1: boolean;
  ability1Aim: Phaser.Math.Vector2;
  ability1AimActive: boolean;
  ability1Aiming: boolean;
  ability2: boolean;
  ability2Aim: Phaser.Math.Vector2;
  ability2AimActive: boolean;
  ability2Aiming: boolean;
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
  private readonly blockPad?: VirtualAimPad;
  private readonly dashButton?: CombatButton;
  private readonly ability1Button?: AbilityButton;
  private readonly ability1Pad?: VirtualAimPad;
  private readonly ability1Aim = new Phaser.Math.Vector2();
  private ability1AimActive = false;
  private ability1AimingHeld = false;
  private readonly ability2Button?: AbilityButton;
  private readonly ability2Pad?: VirtualAimPad;
  private readonly ability2Aim = new Phaser.Math.Vector2();
  private ability2AimActive = false;
  private ability2AimingHeld = false;
  private ability2AimOnRelease = false;
  private ability1AimOnRelease = false;
  private ability1Ready = true;
  private ability2Ready = true;
  private pcAim: 'ability1' | 'ability2' | null = null;
  private uiPointerAt = -1;
  private suppressAttack = false;
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
    dashMaxCharges: number = COMBAT.dashMaxCharges,
    combatHud = true,
  ) {
    this.scene = scene;
    this.isRoundLocked = isRoundLocked;
    this.touch = isTouchPrimary();
    this.ability1AimOnRelease = Boolean(kit?.ability1.aimOnRelease);
    this.ability2AimOnRelease = Boolean(kit?.ability2.aimOnRelease);

    if (this.touch) {
      const layout = resolveControls(scene.scale.width, scene.scale.height);

      this.leftStick = new VirtualThumbstick(scene, layout.leftStick.x, layout.leftStick.y, {
        label: 'MOVE',
        accent: COLORS.cyan,
        radius: layout.leftStick.r,
      });
      if (combatHud) {
        this.rightStick = new VirtualThumbstick(scene, layout.rightStick.x, layout.rightStick.y, {
          label: 'AIM',
          accent: COLORS.redBright,
          radius: layout.rightStick.r,
        });
      }

      if (combatHud) {
      this.blockPad = new VirtualAimPad(scene, layout.block.x, layout.block.y, {
        label: 'SHIELD',
        accent: COLORS.cyan,
        radius: layout.block.r,
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
      this.dashButton.setRadius(layout.dash.r);
      this.dashButton.setCharges(dashMaxCharges, dashMaxCharges);
      this.dashButton.setRecovered(1);

      if (kit) {
        if (kit.ability1.aimOnRelease) {
          this.ability1Pad = new VirtualAimPad(scene, layout.ability1.x, layout.ability1.y, {
            label: kit.ability1.padLabel ?? 'AIM',
            accent: kit.ability1.accent,
            radius: layout.ability1.r,
            onPress: () => {
              if (!this.ability1Ready) {
                return;
              }
              this.ability1AimingHeld = true;
            },
            onRelease: (aim) => {
              if (!this.ability1AimingHeld) {
                return;
              }
              this.ability1AimingHeld = false;
              this.ability1AimActive = aim.length() >= INPUT.aimPadDeadzone;
              if (this.ability1AimActive) {
                this.ability1Aim.copy(aim).normalize();
              }
              this.ability1Latched = true;
            },
          });
        } else {
          this.ability1Button = new AbilityButton(
            scene,
            layout.ability1.x,
            layout.ability1.y,
            layout.ability1.r,
            kit.ability1.iconKey,
            { onPress: () => { this.ability1Latched = true; } },
          );
        }
        if (kit.ability2.aimOnRelease) {
          this.ability2Pad = new VirtualAimPad(scene, layout.ability2.x, layout.ability2.y, {
            label: kit.ability2.padLabel ?? 'AIM',
            accent: kit.ability2.accent,
            radius: layout.ability2.r,
            onPress: () => {
              if (!this.ability2Ready) {
                return;
              }
              this.ability2AimingHeld = true;
            },
            onRelease: (aim) => {
              if (!this.ability2AimingHeld) {
                return;
              }
              this.ability2AimingHeld = false;
              this.ability2AimActive = aim.length() >= INPUT.aimPadDeadzone;
              if (this.ability2AimActive) {
                this.ability2Aim.copy(aim).normalize();
              }
              this.ability2Latched = true;
            },
          });
        } else {
          this.ability2Button = new AbilityButton(
            scene,
            layout.ability2.x,
            layout.ability2.y,
            layout.ability2.r,
            kit.ability2.iconKey,
            { onPress: () => { this.ability2Latched = true; } },
          );
        }
        this.ultimateButton = new AbilityButton(
          scene,
          layout.ultimate.x,
          layout.ultimate.y,
          layout.ultimate.r,
          kit.ultimate.iconKey,
          { ultimate: true, onPress: () => { this.ultimateLatched = true; } },
        );
      }
      }
    }

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      keyboard.addCapture(['SPACE', 'SHIFT']);
      this.cursors = keyboard.createCursorKeys();
      this.keys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        attack: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
        block: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        dash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
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
        this.handleAbilityKey('ability1');
      });
      this.keys.ability2.on('down', () => {
        this.handleAbilityKey('ability2');
      });
      this.keys.ultimate.on('down', () => {
        this.ultimateLatched = true;
      });
      this.keys.ability1Alt.on('down', () => {
        this.handleAbilityKey('ability1');
      });
      this.keys.ability2Alt.on('down', () => {
        this.handleAbilityKey('ability2');
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
    if (!pointer.leftButtonDown()) {
      return;
    }
    if (this.scene.time.now - this.uiPointerAt < 250) {
      return;
    }
    if (this.pcAim === 'ability1') {
      this.firePcAim('ability1');
      return;
    }
    if (this.pcAim === 'ability2') {
      this.firePcAim('ability2');
      return;
    }
    this.attackLatched = true;
  }

  pcAimSlot(): AbilitySlot | null {
    return this.pcAim;
  }

  noteUiPointer(): void {
    this.uiPointerAt = this.scene.time.now;
  }

  togglePcAim(slot: AbilitySlot): void {
    this.noteUiPointer();
    if (slot === 'ultimate') {
      this.ultimateLatched = true;
      this.pcAim = null;
      return;
    }
    const ready = slot === 'ability1' ? this.ability1Ready : this.ability2Ready;
    if (!ready) {
      if (this.pcAim === slot) {
        this.pcAim = null;
      }
      return;
    }
    const aimable = slot === 'ability1' ? this.ability1AimOnRelease : this.ability2AimOnRelease;
    if (!aimable || this.touch) {
      if (slot === 'ability1') {
        this.ability1Latched = true;
      } else {
        this.ability2Latched = true;
      }
      this.pcAim = null;
      return;
    }
    this.pcAim = this.pcAim === slot ? null : slot;
  }

  private handleAbilityKey(slot: 'ability1' | 'ability2'): void {
    if (this.touch) {
      if (slot === 'ability1') {
        this.ability1Latched = true;
      } else if (!this.ability2AimOnRelease) {
        this.ability2Latched = true;
      }
      return;
    }
    this.togglePcAim(slot);
  }

  private firePcAim(slot: 'ability1' | 'ability2'): void {
    const aim = this.lastAim.lengthSq() > 0.01 ? this.lastAim : new Phaser.Math.Vector2(1, 0);
    if (slot === 'ability1') {
      this.ability1Aim.copy(aim);
      this.ability1AimActive = true;
      this.ability1Latched = true;
    } else {
      this.ability2Aim.copy(aim);
      this.ability2AimActive = true;
      this.ability2Latched = true;
    }
    this.pcAim = null;
    this.suppressAttack = true;
    this.wasAttackHeld = true;
  }

  layout(width: number, height: number): void {
    if (!this.touch) {
      return;
    }
    const layout = resolveControls(width, height);
    this.leftStick?.setRadius(layout.leftStick.r);
    this.rightStick?.setRadius(layout.rightStick.r);
    this.leftStick?.setPosition(layout.leftStick.x, layout.leftStick.y);
    this.rightStick?.setPosition(layout.rightStick.x, layout.rightStick.y);
    this.blockPad?.setRadius(layout.block.r);
    this.dashButton?.setRadius(layout.dash.r);
    this.blockPad?.setPosition(layout.block.x, layout.block.y);
    this.dashButton?.setPosition(layout.dash.x, layout.dash.y);
    this.ability1Button?.setRadius(layout.ability1.r);
    this.ability1Pad?.setRadius(layout.ability1.r);
    this.ability2Button?.setRadius(layout.ability2.r);
    this.ability2Pad?.setRadius(layout.ability2.r);
    this.ultimateButton?.setRadius(layout.ultimate.r);
    this.ability1Button?.setPosition(layout.ability1.x, layout.ability1.y);
    this.ability1Pad?.setPosition(layout.ability1.x, layout.ability1.y);
    this.ability2Button?.setPosition(layout.ability2.x, layout.ability2.y);
    this.ability2Pad?.setPosition(layout.ability2.x, layout.ability2.y);
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

    const aimingAbility = this.pcAim !== null;
    const pointerAttack = !this.touch && this.scene.input.activePointer.leftButtonDown();
    if (this.suppressAttack && !pointerAttack) {
      this.suppressAttack = false;
    }
    const attackHeld =
      !aimingAbility &&
      !this.suppressAttack &&
      (rightActive || Boolean(this.keys?.attack.isDown) || pointerAttack);
    const attackPressed =
      !this.suppressAttack &&
      (this.consumeLatch('attackLatched') ||
        Boolean(this.keys && Phaser.Input.Keyboard.JustDown(this.keys.attack)) ||
        (attackHeld && !this.wasAttackHeld));
    this.wasAttackHeld = attackHeld || this.suppressAttack;

    const now = this.scene.time.now;
    const attackEdge = attackPressed && now - this.lastAttackPressAt >= 90;
    if (attackEdge) {
      this.lastAttackPressAt = now;
    }

    const blockHeld =
      this.blockHeldTouch ||
      Boolean(this.keys?.block.isDown);
    const blockAim = this.blockPad?.getValue() ?? new Phaser.Math.Vector2();
    const blockAimActive = Boolean(this.blockPad?.aiming());
    const dashPressed =
      this.consumeLatch('dashLatched') ||
      Boolean(this.keys && Phaser.Input.Keyboard.JustDown(this.keys.dash));
    if (this.ability1Pad?.active) {
      const padAim = this.ability1Pad.getValue();
      if (padAim.length() >= INPUT.aimPadDeadzone) {
        this.ability1Aim.copy(padAim).normalize();
      }
    }
    if (this.ability2Pad?.active) {
      const padAim = this.ability2Pad.getValue();
      if (padAim.length() >= INPUT.aimPadDeadzone) {
        this.ability2Aim.copy(padAim).normalize();
      }
    }
    const ability2KeyAiming =
      this.touch &&
      this.ability2AimOnRelease &&
      Boolean(this.keys?.ability2.isDown || this.keys?.ability2Alt.isDown);
    if (ability2KeyAiming || this.pcAim === 'ability2') {
      this.ability2Aim.copy(this.lastAim);
    }
    if (this.pcAim === 'ability1') {
      this.ability1Aim.copy(this.lastAim);
    }
    const ability1 = this.consumeLatch('ability1Latched');
    const ability2 = this.consumeLatch('ability2Latched');
    const ultimate = this.consumeLatch('ultimateLatched');
    const ability1AimActive = ability1 && this.ability1AimActive;
    if (ability1) {
      this.ability1AimActive = false;
    }
    const ability2AimActive = ability2 && this.ability2AimActive;
    if (ability2) {
      this.ability2AimActive = false;
    }
    const ability1Aiming =
      this.pcAim === 'ability1' ||
      this.ability1AimingHeld ||
      Boolean(this.ability1Pad?.active) ||
      (this.touch && Boolean(this.keys?.ability1.isDown));
    const ability2Aiming =
      this.pcAim === 'ability2' ||
      this.ability2AimingHeld ||
      Boolean(this.ability2Pad?.active) ||
      ability2KeyAiming;

    return {
      move,
      aim,
      aimActive,
      attackHeld,
      attackPressed: attackEdge,
      blockHeld,
      blockAim,
      blockAimActive,
      dashPressed,
      ability1,
      ability1Aim: this.ability1Aim.clone(),
      ability1AimActive,
      ability1Aiming,
      ability2,
      ability2Aim: this.ability2Aim.clone(),
      ability2AimActive,
      ability2Aiming,
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
    this.blockPad?.setHeldVisual(state.blocking);
    this.blockPad?.setRecovered(state.staminaRatio);
    this.blockPad?.setDimmed(state.staminaRatio <= 0.02);
  }

  syncAbilities(states: AbilitySlotState[]): void {
    if (states[0]) {
      this.ability1Ready = states[0].ready;
      this.ability1Button?.sync(states[0]);
      this.ability1Pad?.setRecovered(states[0].ready ? 1 : 1 - states[0].cooldownRatio);
      this.ability1Pad?.setDimmed(!states[0].ready || states[0].consumed);
      if (!states[0].ready && this.pcAim === 'ability1') {
        this.pcAim = null;
      }
    }
    if (states[1]) {
      this.ability2Ready = states[1].ready;
      this.ability2Button?.sync(states[1]);
      this.ability2Pad?.setRecovered(states[1].ready ? 1 : 1 - states[1].cooldownRatio);
      this.ability2Pad?.setDimmed(!states[1].ready || states[1].consumed);
      if (!states[1].ready && this.pcAim === 'ability2') {
        this.pcAim = null;
      }
    }
    if (states[2]) {
      this.ultimateButton?.sync(states[2]);
    }
  }

  rebindHero(kit: HeroAbilityKit, dashMaxCharges: number = COMBAT.dashMaxCharges): void {
    this.ability1AimOnRelease = Boolean(kit.ability1.aimOnRelease);
    this.ability2AimOnRelease = Boolean(kit.ability2.aimOnRelease);
    this.pcAim = null;
    this.ability1AimingHeld = false;
    this.ability2AimingHeld = false;
    this.ability1AimActive = false;
    this.ability2AimActive = false;
    this.ability1Latched = false;
    this.ability2Latched = false;
    this.dashLatched = false;
    this.dashButton?.setCharges(dashMaxCharges, dashMaxCharges);
  }

  destroy(): void {
    this.leftStick?.destroy();
    this.rightStick?.destroy();
    this.blockPad?.destroy();
    this.dashButton?.destroy();
    this.ability1Button?.destroy();
    this.ability1Pad?.destroy();
    this.ability2Button?.destroy();
    this.ability2Pad?.destroy();
    this.ultimateButton?.destroy();
    this.scene.input?.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
  }

  setCombatVisible(visible: boolean): void {
    this.rightStick?.setVisible(visible);
    this.blockPad?.setVisible(visible);
    this.dashButton?.setVisible(visible);
    this.ability1Button?.setVisible(visible);
    this.ability1Pad?.setVisible(visible);
    this.ability2Button?.setVisible(visible);
    this.ability2Pad?.setVisible(visible);
    this.ultimateButton?.setVisible(visible);
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
