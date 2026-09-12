import Phaser from 'phaser';
import { audio } from '../audio';
import type { TeamId } from '../config/hero';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import { ActionButton } from './ActionButton';
import { COLORS, FONTS, hex } from './theme';

export type PostMatchHandlers = {
  onRematch: () => void;
  onMenu: () => void;
};

export class PostMatchOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene, private readonly handlers: PostMatchHandlers) {
    this.root = scene.add.container(0, 0).setDepth(240).setScrollFactor(0).setVisible(false);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  show(winner: TeamId | 'draw' | null, playerTeam: TeamId, lines: HeroStatLine[]): void {
    this.root.removeAll(true);
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const result =
      winner === 'draw' || winner === null
        ? 'DRAW'
        : winner === playerTeam
          ? 'VICTORY'
          : 'DEFEAT';
    const resultColor = result === 'VICTORY' ? COLORS.cyan : result === 'DEFEAT' ? COLORS.redBright : COLORS.yellow;

    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.82);
    const title = this.scene.add
      .text(width / 2, 36, result, {
        fontFamily: FONTS.display,
        fontSize: '34px',
        color: hex(resultColor),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);
    const sub = this.scene.add
      .text(width / 2, 76, 'MATCH REPORT', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.root.add([veil, title, sub]);

    const header = 'FIGHTER          K  A  D   HERO DMG   TAKEN   ABILITY   LIGHT';
    this.root.add(
      this.scene.add
        .text(width / 2, 104, header, {
          fontFamily: FONTS.body,
          fontSize: '11px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0),
    );

    const ordered = [...lines].sort((a, b) => {
      if (a.team !== b.team) {
        return a.team === 'alpha' ? -1 : 1;
      }
      if (a.player !== b.player) {
        return a.player ? -1 : 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    ordered.forEach((line, index) => {
      const tag = line.player ? 'YOU' : line.team === 'alpha' ? 'ALLY' : 'ENEMY';
      const row = `${pad(line.displayName.toUpperCase(), 10)} ${tag.padEnd(5)}  ${n(line.kills)}  ${n(line.assists)}  ${n(line.deaths)}    ${n(line.playerDamage, 4)}     ${n(line.playerDamageReceived, 4)}     ${n(line.abilityDamage, 4)}    ${n(line.lightDamage, 4)}`;
      this.root.add(
        this.scene.add
          .text(width / 2, 126 + index * 22, row, {
            fontFamily: FONTS.body,
            fontSize: '12px',
            fontStyle: 'bold',
            color: hex(line.team === 'alpha' ? COLORS.cyan : COLORS.redBright),
            stroke: hex(COLORS.ink),
            strokeThickness: 3,
          })
          .setOrigin(0.5, 0),
      );
    });

    const rematch = new ActionButton(this.scene, width / 2 - 110, height - 48, {
      label: 'REMATCH',
      width: 190,
      height: 48,
      primary: true,
      compact: true,
      onPress: () => this.handlers.onRematch(),
    });
    rematch.setScrollFactor(0).setDepth(241);
    const menu = new ActionButton(this.scene, width / 2 + 110, height - 48, {
      label: 'MENU',
      width: 190,
      height: 48,
      compact: true,
      onPress: () => this.handlers.onMenu(),
    });
    menu.setScrollFactor(0).setDepth(241);
    this.root.add([rematch, menu]);
    this.root.setVisible(true);
    this.visible = true;
    audio.play(result === 'VICTORY' ? 'ui-victory' : result === 'DEFEAT' ? 'ui-defeat' : 'ui-draw');
  }

  destroy(): void {
    this.root.destroy();
  }
}

const n = (value: number, width = 2): string => Math.round(value).toString().padStart(width, ' ');
const pad = (value: string, width: number): string => value.slice(0, width).padEnd(width, ' ');
