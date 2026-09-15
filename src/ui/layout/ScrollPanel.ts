import Phaser from 'phaser';
import { adoptHud } from './hudCamera';

export type ScrollAxis = 'y' | 'x';

type ScrollPanelOptions = {
  axis?: ScrollAxis;
  depth?: number;
  scrollFactor?: number;
};

/**
 * Clipped scroll region for menus and modals. Gameplay never uses this —
 * only content that can exceed the viewport. Drag and wheel move the content;
 * a tap that barely moved still reaches children.
 */
export class ScrollPanel {
  readonly root: Phaser.GameObjects.Container;
  readonly content: Phaser.GameObjects.Container;
  wasDragged = false;

  private readonly scene: Phaser.Scene;
  private readonly axis: ScrollAxis;
  private readonly maskGfx: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private viewW: number;
  private viewH: number;
  private originX: number;
  private originY: number;
  private contentW: number;
  private contentH: number;
  private scroll = 0;
  private dragging = false;
  private dragStart = 0;
  private scrollStart = 0;
  private readonly onWheel: (pointer: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number) => void;
  private readonly onDown: (pointer: Phaser.Input.Pointer) => void;
  private readonly onMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly onUp: (pointer: Phaser.Input.Pointer) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    options: ScrollPanelOptions = {},
  ) {
    this.scene = scene;
    this.axis = options.axis ?? 'y';
    this.originX = x;
    this.originY = y;
    this.viewW = Math.max(8, width);
    this.viewH = Math.max(8, height);
    this.contentW = this.viewW;
    this.contentH = this.viewH;

    this.root = scene.add.container(x, y).setDepth(options.depth ?? 0);
    if (options.scrollFactor !== undefined) {
      this.root.setScrollFactor(options.scrollFactor);
    }
    this.content = scene.add.container(0, 0);
    this.hit = scene.add.rectangle(this.viewW / 2, this.viewH / 2, this.viewW, this.viewH, 0x000000, 0.001);
    this.hit.setInteractive();
    this.root.add([this.hit, this.content]);

    this.maskGfx = scene.add.graphics().setVisible(false);
    if (options.scrollFactor !== undefined) {
      this.maskGfx.setScrollFactor(options.scrollFactor);
    }
    this.redrawMask();
    this.root.setMask(this.maskGfx.createGeometryMask());
    if (options.scrollFactor === 0) {
      adoptHud(scene, this.root, this.maskGfx);
    }

    this.onDown = (pointer) => {
      if (!this.contains(pointer.x, pointer.y) || !this.root.visible) {
        return;
      }
      this.dragging = true;
      this.wasDragged = false;
      this.dragStart = this.axis === 'y' ? pointer.y : pointer.x;
      this.scrollStart = this.scroll;
    };
    this.onMove = (pointer) => {
      if (!this.dragging) {
        return;
      }
      const now = this.axis === 'y' ? pointer.y : pointer.x;
      const delta = now - this.dragStart;
      if (Math.abs(delta) > 8) {
        this.wasDragged = true;
      }
      this.setScroll(this.scrollStart - delta);
    };
    this.onUp = () => {
      this.dragging = false;
    };
    this.onWheel = (pointer, _over, dx, dy) => {
      if (!this.contains(pointer.x, pointer.y) || !this.root.visible) {
        return;
      }
      this.setScroll(this.scroll + (this.axis === 'y' ? dy : dx + dy));
    };

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp);
    scene.input.on('wheel', this.onWheel);
  }

  add(child: Phaser.GameObjects.GameObject): this {
    this.content.add(child);
    return this;
  }

  setContentSize(width: number, height: number): void {
    this.contentW = Math.max(this.viewW, width);
    this.contentH = Math.max(this.viewH, height);
    this.setScroll(this.scroll);
  }

  resize(x: number, y: number, width: number, height: number): void {
    this.originX = x;
    this.originY = y;
    this.viewW = Math.max(8, width);
    this.viewH = Math.max(8, height);
    this.root.setPosition(x, y);
    this.hit.setPosition(this.viewW / 2, this.viewH / 2);
    this.hit.setSize(this.viewW, this.viewH);
    this.redrawMask();
    this.setScroll(this.scroll);
  }

  overflow(): boolean {
    return this.maxScroll() > 1;
  }

  /** Keep a content-space x range inside the clip. Optionally leave `peek` of the next item visible. */
  revealX(contentX: number, itemW: number, peek = 0): void {
    if (this.axis !== 'x') {
      return;
    }
    const left = contentX - itemW / 2;
    const right = contentX + itemW / 2 + peek;
    if (left < this.scroll) {
      this.setScroll(left);
      return;
    }
    if (right > this.scroll + this.viewW) {
      this.setScroll(right - this.viewW);
    }
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp);
    this.scene.input.off('wheel', this.onWheel);
    this.root.clearMask(true);
    this.maskGfx.destroy();
    this.root.destroy(true);
  }

  private maxScroll(): number {
    return this.axis === 'y'
      ? Math.max(0, this.contentH - this.viewH)
      : Math.max(0, this.contentW - this.viewW);
  }

  private setScroll(next: number): void {
    this.scroll = Phaser.Math.Clamp(next, 0, this.maxScroll());
    if (this.axis === 'y') {
      this.content.y = -this.scroll;
    } else {
      this.content.x = -this.scroll;
    }
  }

  private contains(x: number, y: number): boolean {
    return x >= this.originX && x <= this.originX + this.viewW && y >= this.originY && y <= this.originY + this.viewH;
  }

  private redrawMask(): void {
    this.maskGfx.clear();
    this.maskGfx.fillStyle(0xffffff, 1);
    this.maskGfx.fillRect(this.originX, this.originY, this.viewW, this.viewH);
  }
}
