import Phaser from 'phaser';
import { adoptHud, hudPointer } from './hudCamera';
import { TAP_PX, normalizedWheelDelta } from './tapGesture';

export type ScrollAxis = 'y' | 'x';

type ScrollPanelOptions = {
  axis?: ScrollAxis;
  depth?: number;
  scrollFactor?: number;
};

/**
 * Clipped scroll region for menus and modals. Gameplay never uses this —
 * only content that can exceed the viewport. Drag and wheel move the content;
 * a tap that barely moved still reaches children. Geometry masks do not clip
 * Phaser input, so children outside the view have input disabled.
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
  private velocity = 0;
  private lastPoint = 0;
  private lastMoveAt = 0;
  private onScroll?: () => void;
  private readonly onWheel: (pointer: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number) => void;
  private readonly onDown: (pointer: Phaser.Input.Pointer) => void;
  private readonly onMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly onUp: (pointer: Phaser.Input.Pointer) => void;
  private readonly onTick: (_time: number, delta: number) => void;

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
      if (!this.pointerInView(pointer) || !this.root.visible) {
        return;
      }
      const point = this.axisValue(pointer);
      this.dragging = true;
      this.wasDragged = false;
      this.velocity = 0;
      this.dragStart = point;
      this.scrollStart = this.scroll;
      this.lastPoint = point;
      this.lastMoveAt = pointer.time;
      this.syncChildInput();
    };
    this.onMove = (pointer) => {
      if (!this.dragging) {
        return;
      }
      const point = this.axisValue(pointer);
      const delta = point - this.dragStart;
      const now = pointer.time;
      const step = point - this.lastPoint;
      const dt = Math.max(8, now - this.lastMoveAt);
      this.lastPoint = point;
      this.lastMoveAt = now;
      if (Math.abs(delta) <= TAP_PX) {
        return;
      }
      if (!this.wasDragged) {
        this.wasDragged = true;
        this.setContentInput(false);
      }
      this.velocity = (-step / dt) * 16.67;
      this.setScroll(this.scrollStart - delta);
    };
    this.onUp = () => {
      this.dragging = false;
      this.syncChildInput();
    };
    this.onWheel = (pointer, _over, dx, dy) => {
      if (!this.pointerInView(pointer) || !this.root.visible) {
        return;
      }
      const event = pointer.event as WheelEvent | undefined;
      event?.preventDefault?.();
      this.velocity = 0;
      this.setScroll(this.scroll + normalizedWheelDelta(pointer, dx, dy, this.axis));
    };
    this.onTick = (_time, delta) => {
      if (this.dragging || !this.root.visible || Math.abs(this.velocity) < 0.35) {
        if (!this.dragging && Math.abs(this.velocity) < 0.35) {
          this.velocity = 0;
        }
        return;
      }
      const frames = delta / 16.67;
      this.setScroll(this.scroll + this.velocity * frames);
      this.velocity *= Math.pow(0.9, frames);
    };

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp);
    scene.input.on('wheel', this.onWheel);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onTick);
  }

  add(child: Phaser.GameObjects.GameObject): this {
    this.content.add(child);
    this.syncChildInput();
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

  getScroll(): number {
    return this.scroll;
  }

  getMaxScroll(): number {
    return this.maxScroll();
  }

  onScrollChange(handler: () => void): void {
    this.onScroll = handler;
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
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onTick);
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
    if (this.dragging && this.wasDragged) {
      this.setContentInput(false);
    } else {
      this.syncChildInput();
    }
    this.onScroll?.();
  }

  private axisValue(pointer: Phaser.Input.Pointer): number {
    const point = hudPointer(this.scene, pointer);
    return this.axis === 'y' ? point.y : point.x;
  }

  private pointerInView(pointer: Phaser.Input.Pointer): boolean {
    const point = hudPointer(this.scene, pointer);
    return (
      point.x >= this.originX &&
      point.x <= this.originX + this.viewW &&
      point.y >= this.originY &&
      point.y <= this.originY + this.viewH
    );
  }

  private setContentInput(enabled: boolean): void {
    this.walkInput(this.content, enabled);
  }

  private syncChildInput(): void {
    const view = new Phaser.Geom.Rectangle(this.originX, this.originY, this.viewW, this.viewH);
    this.clipInput(this.content, view);
  }

  private walkInput(object: Phaser.GameObjects.GameObject, enabled: boolean): void {
    if (object.input) {
      object.input.enabled = enabled;
    }
    const nested = object as Phaser.GameObjects.Container;
    if (Array.isArray(nested.list)) {
      nested.list.forEach((child) => this.walkInput(child, enabled));
    }
  }

  private clipInput(object: Phaser.GameObjects.GameObject, view: Phaser.Geom.Rectangle): void {
    if (object.input && 'getBounds' in object && typeof object.getBounds === 'function') {
      const bounds = (object as Phaser.GameObjects.Container).getBounds();
      object.input.enabled = Phaser.Geom.Intersects.RectangleToRectangle(view, bounds);
    }
    const nested = object as Phaser.GameObjects.Container;
    if (Array.isArray(nested.list)) {
      nested.list.forEach((child) => this.clipInput(child, view));
    }
  }

  private redrawMask(): void {
    this.maskGfx.clear();
    this.maskGfx.fillStyle(0xffffff, 1);
    this.maskGfx.fillRect(this.originX, this.originY, this.viewW, this.viewH);
  }
}
