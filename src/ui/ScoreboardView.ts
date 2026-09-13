import Phaser from 'phaser';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import { COLORS, FONTS, hex } from './theme';

type Column = {
  label: string;
  x: number;
  origin: number;
  width: number;
  value: (line: HeroStatLine) => string;
};

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

export type ScoreboardSize = {
  height: number;
  width: number;
};

/**
 * Shared K/D/damage table. Headers and values share the same column x so
 * titles stay lined up with scores on every viewport width.
 */
export const addScoreboard = (
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  lines: HeroStatLine[],
  originY: number,
  width: number,
): number => addScoreboardSized(scene, root, lines, originY, width).height;

export const addScoreboardSized = (
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  lines: HeroStatLine[],
  originY: number,
  width: number,
): ScoreboardSize => {
  const extraNarrow = width < 420;
  const compact = width < 640;
  const tableW = compact ? width : Math.min(Math.max(width, 640), 860);
  const pad = extraNarrow ? 8 : 12;
  const inner = tableW - pad * 2;
  const nameW = extraNarrow ? 72 : compact ? 88 : Math.min(130, inner * 0.2);
  const tagW = extraNarrow ? 36 : compact ? 44 : 52;
  const rest = inner - nameW - tagW;
  const slots = extraNarrow
    ? ['K', 'A', 'D', 'H', 'T', 'Ab', 'L', 'B']
    : compact
      ? ['K', 'A', 'D', 'HERO', 'TKN', 'ABL', 'LIT', 'BLK']
      : ['K', 'A', 'D', 'HERO DMG', 'TAKEN', 'ABILITY', 'LIGHT', 'BLOCK'];
  const slotW = rest / slots.length;
  const nameX = pad;
  const tagX = pad + nameW;
  const slotX = (index: number) => tagX + tagW + slotW * index + slotW * 0.5;

  const columns: Column[] = [
    {
      label: 'FIGHTER',
      x: nameX,
      origin: 0,
      width: nameW,
      value: (line) => line.displayName.toUpperCase(),
    },
    {
      label: '',
      x: tagX,
      origin: 0,
      width: tagW,
      value: (line) => (line.player ? 'YOU' : line.team === 'alpha' ? 'ALLY' : 'ENEMY'),
    },
    ...slots.map((label, index) => ({
      label,
      x: slotX(index),
      origin: 0.5,
      width: slotW,
      value: (line: HeroStatLine) => numericFor(line, index),
    })),
  ];

  const headerSize = compact ? '10px' : '11px';
  const rowSize = compact ? '11px' : '12px';

  columns.forEach((col) => {
    if (!col.label) {
      return;
    }
    root.add(
      scene.add
        .text(col.x, originY, col.label, {
          fontFamily: FONTS.body,
          fontSize: headerSize,
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          letterSpacing: compact ? 0 : 1,
        })
        .setOrigin(col.origin, 0),
    );
  });

  const ordered = sortScoreboardLines(lines);
  ordered.forEach((line, index) => {
    const y = originY + 22 + index * 22;
    columns.forEach((col) => {
      root.add(
        scene.add
          .text(col.x, y, col.value(line), {
            fontFamily: FONTS.body,
            fontSize: rowSize,
            fontStyle: 'bold',
            color: hex(line.team === 'alpha' ? COLORS.cyan : COLORS.redBright),
            stroke: hex(COLORS.ink),
            strokeThickness: 3,
          })
          .setOrigin(col.origin, 0),
      );
    });
  });

  return {
    height: 22 + ordered.length * 22,
    width: tableW,
  };
};

const numericFor = (line: HeroStatLine, index: number): string => {
  const values = [
    line.kills,
    line.assists,
    line.deaths,
    line.playerDamage,
    line.playerDamageReceived,
    line.abilityDamage,
    line.lightDamage,
    line.blockedDamage,
  ];
  return String(Math.round(values[index] ?? 0));
};
