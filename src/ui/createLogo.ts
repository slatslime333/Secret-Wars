import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';

export const createLogo = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Container => {
  const container = scene.add.container(x, y).setScale(scale);
  const graphics = scene.add.graphics();

  graphics.fillStyle(COLORS.red, 0.95);
  graphics.fillTriangle(-270, 64, -205, 24, -180, 72);
  graphics.fillTriangle(-205, 72, -128, 23, -92, 78);
  graphics.fillTriangle(-120, 76, -40, 28, 5, 81);
  graphics.fillTriangle(-24, 78, 58, 24, 92, 76);
  graphics.fillTriangle(68, 74, 155, 20, 184, 71);
  graphics.fillTriangle(160, 67, 235, 28, 274, 63);

  graphics.fillStyle(COLORS.orange);
  graphics.fillTriangle(-208, 65, -175, 38, -150, 68);
  graphics.fillTriangle(-84, 73, -42, 39, -6, 75);
  graphics.fillTriangle(82, 68, 122, 35, 145, 70);
  graphics.fillTriangle(188, 62, 218, 42, 242, 62);

  graphics.lineStyle(9, COLORS.ink);
  graphics.beginPath();
  graphics.moveTo(-310, -72);
  graphics.lineTo(-236, -72);
  graphics.lineTo(-270, -21);
  graphics.lineTo(-226, -35);
  graphics.lineTo(-278, 26);
  graphics.lineTo(-260, -12);
  graphics.lineTo(-328, 8);
  graphics.closePath();
  graphics.strokePath();
  graphics.fillStyle(COLORS.cyan);
  graphics.fillPath();

  graphics.lineStyle(9, COLORS.ink);
  graphics.beginPath();
  graphics.moveTo(308, -80);
  graphics.lineTo(249, -66);
  graphics.lineTo(273, -27);
  graphics.lineTo(229, -28);
  graphics.lineTo(282, 31);
  graphics.lineTo(266, -7);
  graphics.lineTo(329, 3);
  graphics.closePath();
  graphics.strokePath();
  graphics.fillStyle(COLORS.yellow);
  graphics.fillPath();

  const shadow = scene.add
    .text(7, 8, 'WARS', {
      fontFamily: FONTS.display,
      fontSize: '118px',
      fontStyle: 'italic',
      color: hex(COLORS.red),
      stroke: hex(COLORS.ink),
      strokeThickness: 18,
      letterSpacing: -5,
    })
    .setOrigin(0.5);

  const wars = scene.add
    .text(0, 0, 'WARS', {
      fontFamily: FONTS.display,
      fontSize: '118px',
      fontStyle: 'italic',
      color: hex(COLORS.paper),
      stroke: hex(COLORS.ink),
      strokeThickness: 13,
      letterSpacing: -5,
    })
    .setOrigin(0.5);

  const secretPlate = scene.add.graphics();
  secretPlate.fillStyle(COLORS.ink);
  secretPlate.fillPoints(
    [
      new Phaser.Geom.Point(-125, -86),
      new Phaser.Geom.Point(132, -86),
      new Phaser.Geom.Point(116, -50),
      new Phaser.Geom.Point(-144, -50),
    ],
    true,
  );
  secretPlate.lineStyle(3, COLORS.cyan);
  secretPlate.strokePoints(
    [
      new Phaser.Geom.Point(-125, -86),
      new Phaser.Geom.Point(132, -86),
      new Phaser.Geom.Point(116, -50),
      new Phaser.Geom.Point(-144, -50),
    ],
    true,
  );

  const secret = scene.add
    .text(-5, -68, 'S E C R E T', {
      fontFamily: FONTS.display,
      fontSize: '25px',
      color: hex(COLORS.cyan),
      letterSpacing: 5,
    })
    .setOrigin(0.5);

  container.add([graphics, shadow, wars, secretPlate, secret]);
  return container;
};
