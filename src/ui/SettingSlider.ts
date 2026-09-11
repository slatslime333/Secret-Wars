import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';

type SettingSliderOptions = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onRelease?: (value: number) => void;
};

/**
 * Chunk pixel slider for Settings. Value is 0–1.
 */
export class SettingSlider extends Phaser.GameObjects.Container {
  private readonly trackWidth = 360;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly handle: Phaser.GameObjects.Rectangle;
  private readonly valueText: Phaser.GameObjects.Text;
  private value: number;
  private dragging = false;
  private readonly onChange: (value: number) => void;
  private readonly onRelease?: (value: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, options: SettingSliderOptions) {
    super(scene, x, y);
    this.value = Phaser.Math.Clamp(options.value, 0, 1);
    this.onChange = options.onChange;
    this.onRelease = options.onRelease;

    const label = scene.add
      .text(-230, -22, options.label, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0, 0.5);

    const track = scene.add.rectangle(0, 10, this.trackWidth, 18, COLORS.ink, 1);
    track.setStrokeStyle(2, COLORS.paper);
    track.setOrigin(0.5);

    this.fill = scene.add.rectangle(-this.trackWidth / 2, 10, 8, 12, COLORS.cyan);
    this.fill.setOrigin(0, 0.5);

    this.handle = scene.add.rectangle(0, 10, 14, 28, COLORS.paper);
    this.handle.setStrokeStyle(3, COLORS.ink);

    this.valueText = scene.add
      .text(210, 10, '0', {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);

    this.add([label, track, this.fill, this.handle, this.valueText]);
    this.setSize(this.trackWidth + 80, 52);
    this.setInteractive({ useHandCursor: true });
    this.draw();

    this.on(Phaser.Input.Events.POINTER_DOWN, this.beginDrag, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.endDrag, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.unbind, this);

    scene.add.existing(this);
  }

  private unbind(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.endDrag, this);
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    this.dragging = true;
    this.applyPointer(pointer);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragging) {
      this.applyPointer(pointer);
    }
  }

  private endDrag(): void {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.onRelease?.(this.value);
  }

  private applyPointer(pointer: Phaser.Input.Pointer): void {
    const localX = pointer.worldX - this.x;
    const ratio = (localX + this.trackWidth / 2) / this.trackWidth;
    const next = Phaser.Math.Clamp(ratio, 0, 1);
    if (Math.abs(next - this.value) < 0.001) {
      return;
    }
    this.value = next;
    this.draw();
    this.onChange(this.value);
  }

  private draw(): void {
    const width = Math.max(8, this.trackWidth * this.value);
    this.fill.width = width;
    this.handle.x = -this.trackWidth / 2 + width;
    this.valueText.setText(String(Math.round(this.value * 100)));
  }
}
