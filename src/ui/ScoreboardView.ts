import Phaser from 'phaser';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import { COLORS, FONTS, hex } from './theme';

const HEADER = 'FIGHTER          K  A  D   HERO DMG   TAKEN   ABILITY   LIGHT   BLOCK';

export const sortScoreboardLines = (lines: HeroStatLine[]): HeroStatLine[] =>
  [...lines].sort((a, b) => {
    if (a.team !== b.team) {
      return a.team === 'alpha' ? -1 : 1;
    }
    if (a.player !== b.player) {
      return a.player ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });

/** Shared K/D/damage table used by pause and post-match. */
export const addScoreboard = (
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  lines: HeroStatLine[],
  originY: number,
  width: number,
): number => {
  root.add(
    scene.add
      .text(width / 2, originY, HEADER, {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0),
  );

  const ordered = sortScoreboardLines(lines);
  ordered.forEach((line, index) => {
    const tag = line.player ? 'YOU' : line.team === 'alpha' ? 'ALLY' : 'ENEMY';
    const row = `${pad(line.displayName.toUpperCase(), 10)} ${tag.padEnd(5)}  ${n(line.kills)}  ${n(line.assists)}  ${n(line.deaths)}    ${n(line.playerDamage, 4)}     ${n(line.playerDamageReceived, 4)}     ${n(line.abilityDamage, 4)}    ${n(line.lightDamage, 4)}    ${n(line.blockedDamage, 4)}`;
    root.add(
      scene.add
        .text(width / 2, originY + 22 + index * 22, row, {
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

  return 22 + ordered.length * 22;
};

const n = (value: number, width = 2): string => Math.round(value).toString().padStart(width, ' ');
const pad = (value: string, width: number): string => value.slice(0, width).padEnd(width, ' ');
