import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';

type ActionButtonOptions = {
  label: string;
  width?: number;
  height?: number;
  primary?: boolean;
  onPress: () => void;
};

export class ActionButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly primary: boolean;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private focused = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ActionButtonOptions) {
    super(scene, x, y);

    this.primary = options.primary ?? false;
    this.buttonWidth = options.width ?? 300;
    this.buttonHeight = options.height ?? 72;
    this.background = scene.add.graphics();
    this.labelText = scene.add
      .text(0, -2, options.label, {
        fontFamily: FONTS.display,
        fontSize: this.primary ? '30px' : '23px',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.add([this.background, this.labelText]);
    this.setSize(this.buttonWidth, this.buttonHeight);
    this.setInteractive({ useHandCursor: true });
    this.draw();

    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.setFocused(true));
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setFocused(false));
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.setScale(0.97);
      this.labelText.setY(2);
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.setScale(1);
      this.labelText.setY(-2);
      options.onPress();
    });

    scene.add.existing(this);
  }

  setFocused(value: boolean): this {
    this.focused = value;
    this.draw();
    return this;
  }

  private draw(): void {
    const width = this.buttonWidth;
    const height = this.buttonHeight;
    const edge = this.primary ? 20 : 14;
    const fill = this.primary
      ? this.focused
        ? COLORS.redBright
        : COLORS.red
      : this.focused
        ? COLORS.cyanDark
        : COLORS.panel;
    const border = this.primary ? COLORS.orange : COLORS.cyan;

    this.background.clear();
    this.background.fillStyle(COLORS.ink, 0.8);
    this.background.fillPoints(
      [
        new Phaser.Geom.Point(-width / 2 + 8, -height / 2 + 8),
        new Phaser.Geom.Point(width / 2 + 8, -height / 2 + 8),
        new Phaser.Geom.Point(width / 2 - edge + 8, height / 2 + 8),
        new Phaser.Geom.Point(-width / 2 - edge + 8, height / 2 + 8),
      ],
      true,
    );
    this.background.fillStyle(fill);
    this.background.fillPoints(
      [
        new Phaser.Geom.Point(-width / 2, -height / 2),
        new Phaser.Geom.Point(width / 2, -height / 2),
        new Phaser.Geom.Point(width / 2 - edge, height / 2),
        new Phaser.Geom.Point(-width / 2 - edge, height / 2),
      ],
      true,
    );
    this.background.lineStyle(this.focused ? 4 : 2, border);
    this.background.strokePoints(
      [
        new Phaser.Geom.Point(-width / 2, -height / 2),
        new Phaser.Geom.Point(width / 2, -height / 2),
        new Phaser.Geom.Point(width / 2 - edge, height / 2),
        new Phaser.Geom.Point(-width / 2 - edge, height / 2),
      ],
      true,
    );
    this.background.fillStyle(border);
    this.background.fillTriangle(
      -width / 2,
      -height / 2,
      -width / 2 + 32,
      -height / 2,
      -width / 2 - 8,
      height / 2,
    );
  }
}
