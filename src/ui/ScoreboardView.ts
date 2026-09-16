import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import type { TeamScore } from '../match/ScoreManager';
import { formatWarScore } from '../config/score';
import { OBJECTIVE_LABEL, type ObjectiveKind } from '../config/objective';
import { formatMatchClock } from '../match/MatchManager';
import { sortScoreboardLines } from '../match/scoreboard/sortLines';
import { teamLevelOf } from '../match/scoreboard/teamLevel';
import { ScrollPanel } from './layout/ScrollPanel';
import { measureViewport } from './layout/viewport';
import { adoptHud, hudPointer } from './layout/hudCamera';
import { capturePress, isTapRelease, syncHitArea, type PointerPress } from './layout/tapGesture';
import { COLORS, FONTS, hex } from './theme';

export type ScoreboardHeader = {
  score: TeamScore;
  remainingMs: number;
  finished?: boolean;
  playerTeam?: TeamId;
  teamLevel?: number;
  enemyLevel?: number;
};

export { teamLevelOf } from '../match/scoreboard/teamLevel';

export { sortScoreboardLines } from '../match/scoreboard/sortLines';

export type ScoreboardSize = {
  height: number;
  width: number;
};

const fmt = (n: number): string => formatWarScore(Math.round(n));

export const scoreboardPanelWidth = (available: number): number => Math.min(640, Math.max(280, available));

const kindLabel = (kind: string): string => {
  const label = OBJECTIVE_LABEL[kind as ObjectiveKind];
  return label ? label.replace(/!$/, '') : kind.replace(/_/g, ' ').toUpperCase();
};

/**
 * Compact expandable War Score board. One open row at a time.
 * Callers own refresh cadence — this view never ticks itself.
 */
export class ScoreboardPanel {
  readonly root: Phaser.GameObjects.Container;
  private expandedId: string | null = null;
  private width: number;
  private height = 0;
  private lines: HeroStatLine[] = [];
  private header?: ScoreboardHeader;
  private onHeight?: (height: number) => void;
  private ignoreToggle?: () => boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    width: number,
    originY = 0,
    ignoreToggle?: () => boolean,
  ) {
    this.width = width;
    this.ignoreToggle = ignoreToggle;
    this.root = scene.add.container(0, originY);
    parent.add(this.root);
  }

  get size(): ScoreboardSize {
    return { height: this.height, width: this.width };
  }

  onResizeContent(handler: (height: number) => void): void {
    this.onHeight = handler;
  }

  render(lines: HeroStatLine[], header?: ScoreboardHeader): void {
    this.lines = lines;
    this.header = header;
    this.root.removeAll(true);
    const compact = this.width < 520;
    let y = 0;
    if (header) {
      y = this.drawHeader(header, compact);
    }
    const ordered = sortScoreboardLines(lines);
    const alpha = ordered.filter((line) => line.team === 'alpha');
    const bravo = ordered.filter((line) => line.team === 'bravo');
    y = this.drawTeam(alpha, 'BLUE', COLORS.cyan, y, compact);
    y += 8;
    y = this.drawTeam(bravo, 'RED', COLORS.redBright, y, compact);
    this.height = y + 8;
    this.onHeight?.(this.height);
    adoptHud(this.scene, this.root);
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private drawHeader(header: ScoreboardHeader, compact: boolean): number {
    const title = this.scene.add
      .text(this.width / 2, 0, `${fmt(header.score.alpha)}    —    ${fmt(header.score.bravo)}`, {
        fontFamily: FONTS.display,
        fontSize: compact ? '22px' : '26px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    const left = this.scene.add
      .text(this.width / 2 - title.width / 2 - 8, 6, 'BLUE', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.cyan),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(1, 0);
    const right = this.scene.add
      .text(this.width / 2 + title.width / 2 + 8, 6, 'RED', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.redBright),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0, 0);
    const clock = this.scene.add
      .text(this.width / 2, 30, header.finished ? 'FINAL' : formatMatchClock(header.remainingMs, 'PLAYING'), {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    const playerTeam = header.playerTeam ?? 'alpha';
    const enemyTeam = playerTeam === 'alpha' ? 'bravo' : 'alpha';
    const teamLv = header.teamLevel ?? teamLevelOf(this.lines, playerTeam);
    const enemyLv = header.enemyLevel ?? teamLevelOf(this.lines, enemyTeam);
    const levels = this.scene.add
      .text(this.width / 2, 46, `TEAM LV ${teamLv}    VS    ENEMY LV ${enemyLv}`, {
        fontFamily: FONTS.body,
        fontSize: compact ? '10px' : '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: compact ? 1 : 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    this.root.add([title, left, right, clock, levels]);
    return 64;
  }

  private drawTeam(lines: HeroStatLine[], label: string, accent: number, startY: number, compact: boolean): number {
    const bar = this.scene.add.rectangle(this.width / 2, startY + 8, this.width, 20, accent, 0.18);
    bar.setStrokeStyle(1.6, accent, 0.85);
    const title = this.scene.add
      .text(12, startY + 8, label, {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(accent),
        letterSpacing: 3,
      })
      .setOrigin(0, 0.5);
    this.root.add([bar, title]);
    let y = startY + 22;
    for (const line of lines) {
      y = this.drawRow(line, accent, y, compact);
    }
    return y;
  }

  private drawRow(line: HeroStatLine, accent: number, y: number, compact: boolean): number {
    const open = this.expandedId === line.instanceId;
    const rowH = 34;
    const hit = this.scene.add.rectangle(this.width / 2, y + rowH / 2, this.width, rowH, COLORS.panel, open ? 0.94 : 0.74);
    hit.setStrokeStyle(1.4, accent, open ? 0.95 : 0.45);
    hit.setInteractive({ useHandCursor: true });
    let press: PointerPress | undefined;
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      press = capturePress(pointer);
    });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!isTapRelease(press, pointer)) {
        return;
      }
      this.toggle(line.instanceId);
    });
    const caret = this.scene.add
      .text(10, y + rowH / 2, open ? '▾' : '▸', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        color: hex(COLORS.paper),
      })
      .setOrigin(0, 0.5);
    const mark = this.scene.add.rectangle(30, y + rowH / 2, 10, 10, accent, 1).setStrokeStyle(1.4, COLORS.ink, 1);
    const name = this.scene.add
      .text(42, y + rowH / 2, line.displayName.toUpperCase() + (line.player ? '  YOU' : ''), {
        fontFamily: FONTS.body,
        fontSize: compact ? '12px' : '13px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    const meta = compact
      ? `LV${line.currentLevel}   ${fmt(line.personalScore)}   ${line.kills}/${line.deaths}`
      : `LV ${line.currentLevel}      ${fmt(line.personalScore)}      ${line.kills} / ${line.deaths}`;
    const stats = this.scene.add
      .text(this.width - 10, y + rowH / 2, meta, {
        fontFamily: FONTS.body,
        fontSize: compact ? '11px' : '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
      })
      .setOrigin(1, 0.5);
    this.root.add([hit, caret, mark, name, stats]);
    let used = rowH;
    if (open) {
      const detailH = this.drawDetails(line, y + rowH, compact);
      hit.setSize(this.width, rowH + detailH);
      hit.setPosition(this.width / 2, y + (rowH + detailH) / 2);
      syncHitArea(hit, this.width, rowH + detailH);
      used += detailH;
    }
    return y + used + 5;
  }

  private toggle(id: string): void {
    if (this.ignoreToggle?.()) {
      return;
    }
    this.expandedId = this.expandedId === id ? null : id;
    this.render(this.lines, this.header);
  }

  private drawDetails(line: HeroStatLine, y: number, compact: boolean): number {
    const panel = this.scene.add.rectangle(this.width / 2, y, this.width - 2, 8, COLORS.ink, 0.55);
    panel.setOrigin(0.5, 0);
    this.root.add(panel);
    let cursor = y + 6;
    cursor = this.drawSection(cursor, 'COMBAT', [
      ['KILLS', String(line.kills)],
      ['DEATHS', String(line.deaths)],
      ['ASSISTS', String(line.assists)],
      ['DAMAGE', fmt(line.playerDamage)],
      ['TAKEN', fmt(line.playerDamageReceived)],
      ['HEALING', fmt(line.healingDone)],
    ], compact);
    cursor = this.drawSection(cursor, 'OBJECTIVES', [
      ['OBJ SCORE', `+${fmt(line.objectiveScore)}`],
      ['WINS', String(line.objectiveWins)],
      ['PLAYED', String(line.objectiveParticipation)],
    ], compact);
    if (line.participatedKinds.length > 0) {
      const kinds = line.participatedKinds.map(kindLabel).join('  ·  ');
      this.root.add(
        this.scene.add
          .text(16, cursor, kinds, {
            fontFamily: FONTS.body,
            fontSize: '10px',
            color: hex(COLORS.yellow),
          })
          .setOrigin(0, 0),
      );
      cursor += 14;
    }
    cursor = this.drawSection(cursor, 'FARM / XP', [
      ['MINIONS', String(line.minionsKilled)],
      ['XP', fmt(line.xpEarned)],
      ['LEVEL', `${line.currentLevel}  (PEAK ${line.highestLevel})`],
    ], compact);
    cursor = this.drawSection(cursor, 'WAR SCORE', [
      ['HERO KILLS', `+${fmt(line.heroKillScore)}`],
      ['MINIONS', `+${fmt(line.minionScore)}`],
      ['OBJECTIVES', `+${fmt(line.objectiveScore)}`],
      ['OTHER', `+${fmt(line.otherScore)}`],
      ['PERSONAL', fmt(line.personalScore)],
    ], compact);
    const height = cursor - y + 6;
    panel.setSize(this.width - 2, height);
    return height;
  }

  private drawSection(
    y: number,
    title: string,
    rows: [string, string][],
    _compact: boolean,
  ): number {
    const heading = this.scene.add
      .text(14, y, title, {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
      })
      .setOrigin(0, 0);
    this.root.add(heading);
    const cols = 2;
    const colW = Math.min(260, (this.width - 40) / 2);
    const rowH = 15;
    rows.forEach((pair, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = 16 + col * (colW + 10);
      const yy = y + 14 + row * rowH;
      const label = this.scene.add
        .text(x, yy, pair[0], {
          fontFamily: FONTS.body,
          fontSize: '10px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          letterSpacing: 1,
        })
        .setOrigin(0, 0);
      const value = this.scene.add
        .text(x + colW - 6, yy, pair[1], {
          fontFamily: FONTS.body,
          fontSize: '10px',
          fontStyle: 'bold',
          color: hex(COLORS.paper),
        })
        .setOrigin(1, 0);
      this.root.add([label, value]);
    });
    return y + 16 + Math.ceil(rows.length / cols) * rowH + 4;
  }
}

/** Keep the old helper for any leftover callers that only need height. */
export const addScoreboardSized = (
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  lines: HeroStatLine[],
  originY: number,
  width: number,
): ScoreboardSize => {
  const panel = new ScoreboardPanel(scene, root, width, originY);
  panel.render(lines);
  return panel.size;
};

export const addScoreboard = (
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  lines: HeroStatLine[],
  originY: number,
  width: number,
): number => addScoreboardSized(scene, root, lines, originY, width).height;

/** Live overlay. Does not pause the match. */
export class ScoreboardOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private scroller?: ScrollPanel;
  private panel?: ScoreboardPanel;
  private visible = false;
  private lastRefresh = 0;
  private bounds = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(225).setScrollFactor(0).setVisible(false);
    adoptHud(scene, this.root);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  toggle(lines: HeroStatLine[], header: ScoreboardHeader): void {
    if (this.visible) {
      this.hide();
      return;
    }
    this.show(lines, header);
  }

  show(lines: HeroStatLine[], header: ScoreboardHeader): void {
    this.build(lines, header);
    this.root.setVisible(true);
    this.visible = true;
  }

  refresh(lines: HeroStatLine[], header: ScoreboardHeader, now: number): void {
    if (!this.visible || now - this.lastRefresh < 500) {
      return;
    }
    if (this.scene.input.activePointer?.primaryDown) {
      return;
    }
    this.lastRefresh = now;
    this.panel?.render(lines, header);
    if (this.scroller && this.panel) {
      this.scroller.setContentSize(this.panel.size.width, this.panel.size.height + 8);
    }
  }

  hide(): void {
    this.scroller?.destroy();
    this.scroller = undefined;
    this.panel = undefined;
    this.root.removeAll(true);
    this.root.setVisible(false);
    this.visible = false;
  }

  destroy(): void {
    this.hide();
    this.root.destroy();
  }

  private build(lines: HeroStatLine[], header: ScoreboardHeader): void {
    this.scroller?.destroy();
    this.root.removeAll(true);
    const frame = measureViewport(this.scene.scale.width, this.scene.scale.height);
    const width = frame.width;
    const height = frame.height;
    const inset = frame.contentInset;
    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.55);
    veil.setInteractive();
    let veilPress: PointerPress | undefined;
    veil.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      veilPress = capturePress(pointer);
    });
    veil.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!isTapRelease(veilPress, pointer) || this.scroller?.wasDragged) {
        return;
      }
      const point = hudPointer(this.scene, pointer);
      if (this.insideBoard(point.x, point.y)) {
        return;
      }
      this.hide();
    });
    const close = this.scene.add
      .text(width - inset.right - 8, inset.top, 'CLOSE', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.hide());
    const live = this.scene.add
      .text(inset.left + 8, inset.top, header.finished ? 'FINAL' : 'LIVE', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0, 0);
    this.root.add([veil, close, live]);
    const scrollY = inset.top + 28;
    const scrollH = Math.max(80, height - scrollY - inset.bottom - 12);
    const innerW = scoreboardPanelWidth(width - inset.left - inset.right);
    const boardX = Math.round((width - innerW) / 2);
    this.bounds = { x: boardX, y: scrollY, w: innerW, h: scrollH };
    this.scroller = new ScrollPanel(this.scene, boardX, scrollY, innerW, scrollH, {
      depth: 227,
      scrollFactor: 0,
    });
    this.panel = new ScoreboardPanel(this.scene, this.scroller.content, innerW, 0, () =>
      Boolean(this.scroller?.wasDragged),
    );
    this.panel.onResizeContent((h) => this.scroller?.setContentSize(innerW, h + 8));
    this.panel.render(lines, header);
    this.scroller.setContentSize(innerW, this.panel.size.height + 8);
    adoptHud(this.scene, this.root, this.scroller.root);
    this.lastRefresh = this.scene.time.now;
  }

  private insideBoard(x: number, y: number): boolean {
    return x >= this.bounds.x && x <= this.bounds.x + this.bounds.w && y >= this.bounds.y && y <= this.bounds.y + this.bounds.h;
  }
}
