import Phaser from 'phaser';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import {
  CONTROL_IDS,
  CONTROL_LABEL,
  clampControlScale,
  clearControlLayout,
  defaultControlPlacement,
  loadControlLayout,
  mergeControlLayout,
  resolveControls,
  saveControlLayout,
  type ControlId,
  type SavedControlLayout,
} from '../ui/controlLayout';
import { COLORS, FONTS, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';
import { resetUiCamera } from '../ui/layout/viewport';

type DummyControl = {
  id: ControlId;
  disc: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  accent: number;
};

/**
 * Drag-and-resize editor for combat buttons only. HUD bars and the minimap
 * stay locked in place.
 */
export class ControlLayoutScene extends Phaser.Scene {
  private returning = false;
  private working: SavedControlLayout = {};
  private selected: ControlId = 'ability1';
  private dummies: DummyControl[] = [];
  private hint?: Phaser.GameObjects.Text;
  private restoreWorking?: SavedControlLayout;
  private restoreSelected?: ControlId;

  constructor() {
    super('ControlLayout');
  }

  init(data: { working?: SavedControlLayout; selected?: ControlId } = {}): void {
    this.restoreWorking = data.working;
    this.restoreSelected = data.selected;
  }

  create(): void {
    this.returning = false;
    resetUiCamera(this);
    createBackdrop(this, { accent: COLORS.orange });
    this.cameras.main.fadeIn(180, 7, 10, 18);
    this.working = this.restoreWorking ? { ...this.restoreWorking } : { ...loadControlLayout() };
    if (this.restoreSelected) {
      this.selected = this.restoreSelected;
    }
    this.drawLockedHud();
    this.rebuildDummies();
    this.drawChrome();
    this.input.keyboard?.on('keydown-ESC', this.done, this);

    const onResize = () => {
      if (!this.returning) {
        this.scene.restart({ working: this.working, selected: this.selected });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.input.keyboard?.off('keydown-ESC', this.done, this);
      this.input.off(Phaser.Input.Events.DRAG, this.onDrag, this);
    });
  }

  private drawLockedHud(): void {
    const width = this.scale.width;
    const bar = this.add.rectangle(width / 2, 22, width, 44, COLORS.ink, 0.78).setStrokeStyle(2, COLORS.paper);
    this.add
      .text(22, 22, 'HUD LOCKED', {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: hex(COLORS.muted),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    this.add.rectangle(148, 56, 224, 10, COLORS.inkSoft).setStrokeStyle(1, COLORS.muted, 0.45);
    this.add.rectangle(148, 70, 224, 8, COLORS.inkSoft).setStrokeStyle(1, COLORS.muted, 0.45);
    const map = this.add
      .rectangle(width - 12, 52, 148, 108, 0x0b100e, 0.72)
      .setOrigin(1, 0)
      .setStrokeStyle(2, COLORS.paper, 0.55);
    this.add
      .text(map.x - 74, 100, 'MAP LOCKED', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    void bar;
  }

  private drawChrome(): void {
    const width = this.scale.width;
    this.add
      .text(width / 2, 6, 'EDIT BUTTONS', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setDepth(40);
    this.hint = this.add
      .text(width / 2, 78, this.hintText(), {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        letterSpacing: 1,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(40);

    new ActionButton(this, 200, 22, {
      label: 'RESET',
      width: 118,
      height: 36,
      compact: true,
      onPress: () => this.resetLayout(),
    }).setDepth(50);
    new ActionButton(this, width / 2 - 72, 48, {
      label: 'SMALLER',
      width: 130,
      height: 36,
      compact: true,
      onPress: () => this.nudgeScale(-0.1),
    }).setDepth(50);
    new ActionButton(this, width / 2 + 72, 48, {
      label: 'BIGGER',
      width: 130,
      height: 36,
      compact: true,
      onPress: () => this.nudgeScale(0.1),
    }).setDepth(50);
    new ActionButton(this, width - 200, 22, {
      label: 'DONE',
      width: 130,
      height: 36,
      primary: true,
      compact: true,
      onPress: () => this.done(),
    }).setDepth(50);
  }

  private rebuildDummies(): void {
    this.input.off(Phaser.Input.Events.DRAG, this.onDrag, this);
    this.dummies.forEach((dummy) => {
      dummy.disc.destroy();
      dummy.label.destroy();
    });
    this.dummies = [];
    const width = this.scale.width;
    const height = this.scale.height;
    const resolved = resolveControls(width, height, this.working);
    const accents: Record<ControlId, number> = {
      leftStick: COLORS.cyan,
      rightStick: COLORS.redBright,
      attack: COLORS.redBright,
      block: COLORS.cyan,
      dash: COLORS.orange,
      ability1: COLORS.paper,
      ability2: COLORS.orange,
      ultimate: COLORS.yellow,
    };
    for (const id of CONTROL_IDS) {
      const item = resolved[id];
      const selected = id === this.selected;
      const disc = this.add
        .circle(item.x, item.y, item.r, COLORS.panel, selected ? 0.72 : 0.5)
        .setStrokeStyle(selected ? 4 : 3, selected ? COLORS.yellow : accents[id])
        .setScrollFactor(0)
        .setDepth(30)
        .setInteractive({ useHandCursor: true });
      disc.setData('controlId', id);
      this.input.setDraggable(disc);
      disc.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.selected = id;
        this.refreshSelection();
      });
      const label = this.add
        .text(item.x, item.y, CONTROL_LABEL[id], {
          fontFamily: FONTS.display,
          fontSize: `${Math.max(10, Math.round(item.r * 0.34))}px`,
          color: hex(COLORS.paper),
          stroke: hex(COLORS.ink),
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(31);
      this.dummies.push({ id, disc, label, accent: accents[id] });
    }
    this.input.on(Phaser.Input.Events.DRAG, this.onDrag, this);
  }

  private onDrag = (
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
    dragX: number,
    dragY: number,
  ): void => {
    if (!gameObject || typeof gameObject.getData !== 'function') {
      return;
    }
    const id = gameObject.getData('controlId') as ControlId | undefined;
    if (!id) {
      return;
    }
    this.selected = id;
    const width = this.scale.width;
    const height = this.scale.height;
    const dummy = this.dummies.find((item) => item.id === id);
    const radius = dummy ? dummy.disc.radius : 30;
    const x = Phaser.Math.Clamp(dragX, radius + 10, width - radius - 10);
    const y = Phaser.Math.Clamp(dragY, radius + 90, height - radius - 10);
    const defaults = defaultControlPlacement(width, height);
    const current = this.working[id] ?? defaults[id];
    this.working[id] = {
      nx: x / width,
      ny: y / height,
      scale: current.scale,
    };
    if (dummy) {
      dummy.disc.setPosition(x, y);
      dummy.label.setPosition(x, y);
    }
    this.refreshSelection();
  };

  private refreshSelection(): void {
    this.dummies.forEach((dummy) => {
      const selected = dummy.id === this.selected;
      dummy.disc.setStrokeStyle(selected ? 4 : 3, selected ? COLORS.yellow : dummy.accent);
      dummy.disc.setFillStyle(COLORS.panel, selected ? 0.72 : 0.5);
    });
    this.hint?.setText(this.hintText());
  }

  private hintText(): string {
    return `DRAG TO MOVE   ${CONTROL_LABEL[this.selected]} SELECTED   HUD / MAP STAY LOCKED`;
  }

  private nudgeScale(delta: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const defaults = defaultControlPlacement(width, height);
    const current = this.working[this.selected] ?? defaults[this.selected];
    this.working[this.selected] = {
      ...current,
      scale: clampControlScale(current.scale + delta),
    };
    this.rebuildDummies();
  }

  private resetLayout(): void {
    this.working = {};
    clearControlLayout();
    this.rebuildDummies();
  }

  private done(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    const defaults = defaultControlPlacement(this.scale.width, this.scale.height);
    const merged = mergeControlLayout(this.scale.width, this.scale.height, this.working);
    const changed: SavedControlLayout = {};
    for (const id of CONTROL_IDS) {
      const entry = merged[id];
      const base = defaults[id];
      if (
        Math.abs(entry.nx - base.nx) > 0.004 ||
        Math.abs(entry.ny - base.ny) > 0.004 ||
        Math.abs(entry.scale - 1) > 0.02
      ) {
        changed[id] = entry;
      }
    }
    if (Object.keys(changed).length === 0) {
      clearControlLayout();
    } else {
      saveControlLayout(changed);
    }
    fadeToScene(this, 'Settings');
  }
}
