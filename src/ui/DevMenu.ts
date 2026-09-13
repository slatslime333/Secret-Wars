import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';
import { adoptHud, hudPointer } from './layout/hudCamera';
import { isTouchPrimary } from '../device';
import { measureViewport } from './layout/viewport';
import { DEV_CHEATS } from '../debug/devCheats';
import type { HeroId } from '../heroes/roster';
import type { MinionKind } from '../config/minion';
import type { TeamId } from '../config/hero';

export type DevMenuHandlers = {
  onToggleCpu: () => void;
  onToggleDummy: () => void;
  cpuPresent: () => boolean;
  cpuDummy?: () => boolean;
  cpuHeroId?: () => HeroId;
  onSetCpuHero?: (id: HeroId) => void;
  onSwapHero: (id: HeroId) => void;
  onHeal: () => void;
  onResetPos: () => void;
  onResetCooldowns: () => void;
  onSpawnMinion: (kind: MinionKind, team: TeamId, count: number) => void;
  onSpawnMixed: (team: TeamId) => void;
  onClearMinions: () => void;
  onClearBattlefield: () => void;
  onCheatsChanged: () => void;
  minionTeam?: () => TeamId;
  onCycleMinionTeam?: () => void;
  minionCount?: () => number;
  onCycleMinionCount?: () => void;
  onResetMatch?: () => void;
  onForceWave?: () => void;
  onTogglePause?: () => void;
  paused?: () => boolean;
  onGiveXp?: () => void;
  onGiveLevel?: () => void;
  mapSeed?: () => number;
  onMapRandomSeed?: () => void;
  onMapReroll?: () => void;
  onMapNextSeed?: () => void;
  onMapPrevSeed?: () => void;
  onToggleMapDebug?: () => void;
  mapDebug?: () => boolean;
};

type Row = {
  kind: 'head' | 'item';
  label: () => string;
  onPress?: () => void;
  text?: Phaser.GameObjects.Text;
};

/** Developer overlay. Stays off the battlefield unless opened. */
export class DevMenu {
  private readonly scene: Phaser.Scene;
  private readonly toggle: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly rows: Row[] = [];
  private readonly maskShape: Phaser.GameObjects.Rectangle;
  private readonly scrollTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollThumb: Phaser.GameObjects.Rectangle;
  private open = false;
  private scroll = 0;
  private panelX = 0;
  private panelY = 0;
  private panelW = 280;
  private panelH = 420;
  private rowH = 22;
  private headH = 22;
  private dragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragged = false;

  constructor(scene: Phaser.Scene, options: DevMenuHandlers) {
    this.scene = scene;
    const width = scene.scale.width;
    const mobile = isTouchPrimary();

    this.toggle = scene.add
      .text(width - 12, 64, 'DEV', {
        fontFamily: FONTS.body,
        fontSize: mobile ? '14px' : '12px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        backgroundColor: hex(COLORS.ink),
        padding: { x: mobile ? 14 : 10, y: mobile ? 8 : 6 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(220)
      .setInteractive({ useHandCursor: true });

    this.panel = scene.add
      .rectangle(width - 12, 92, 280, 420, COLORS.ink, 0.96)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(221)
      .setStrokeStyle(2, COLORS.yellow)
      .setVisible(false)
      .setInteractive();

    this.title = scene.add
      .text(width - 24, 98, 'PLAY TEST', {
        fontFamily: FONTS.display,
        fontSize: mobile ? '13px' : '11px',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(222)
      .setVisible(false);

    this.hint = scene.add
      .text(width - 24, 116, mobile ? 'DRAG TO SCROLL' : 'SCROLL', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(222)
      .setVisible(false);

    this.maskShape = scene.add
      .rectangle(width - 12, 134, 280, 370, 0xffffff, 0)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(222)
      .setVisible(false);

    this.scrollTrack = scene.add
      .rectangle(width - 18, 140, 3, 360, COLORS.paper, 0.18)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(224)
      .setVisible(false);

    this.scrollThumb = scene.add
      .rectangle(width - 18, 140, 3, 48, COLORS.yellow, 0.9)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(225)
      .setVisible(false);

    const addHead = (title: string) => {
      this.rows.push({ kind: 'head', label: () => title });
    };
    const add = (label: () => string, onPress: () => void) => {
      this.rows.push({ kind: 'item', label, onPress });
    };

    addHead('PLAYER');
    add(() => 'HEAL FULL', () => options.onHeal());
    add(() => 'RESET POSITION', () => options.onResetPos());
    add(() => 'RESET COOLDOWNS', () => options.onResetCooldowns());
    add(() => 'HERO NINJA', () => options.onSwapHero('ninja'));
    add(() => 'HERO COLE', () => options.onSwapHero('cole'));
    add(() => 'HERO DEATH', () => options.onSwapHero('death'));
    add(() => 'HERO ROPE', () => options.onSwapHero('rope'));
    add(() => 'HERO WITCH', () => options.onSwapHero('witch'));
    add(() => 'HERO SHADOW', () => options.onSwapHero('shadow'));

    addHead('CPU');
    add(
      () => (options.cpuPresent() && !options.cpuDummy?.() ? 'REMOVE CPU' : 'SPAWN CPU'),
      () => options.onToggleCpu(),
    );
    add(
      () => (options.cpuPresent() && options.cpuDummy?.() ? 'REMOVE DUMMY' : 'SPAWN DUMMY'),
      () => options.onToggleDummy(),
    );
    add(() => `CPU HERO  ${(options.cpuHeroId?.() ?? 'ninja').toUpperCase()}`, () => {
      const order: HeroId[] = ['ninja', 'cole', 'death', 'rope', 'witch', 'shadow'];
      const current = options.cpuHeroId?.() ?? 'ninja';
      const next = order[(order.indexOf(current) + 1) % order.length];
      options.onSetCpuHero?.(next);
    });

    addHead('MINIONS');
    add(() => `TEAM  ${(options.minionTeam?.() ?? 'alpha').toUpperCase()}`, () => options.onCycleMinionTeam?.());
    add(() => `QTY  ${options.minionCount?.() ?? 1}`, () => options.onCycleMinionCount?.());
    add(() => 'SPAWN SWORD', () =>
      options.onSpawnMinion('sword', options.minionTeam?.() ?? 'alpha', options.minionCount?.() ?? 1),
    );
    add(() => 'SPAWN ARCHER', () =>
      options.onSpawnMinion('ranger', options.minionTeam?.() ?? 'alpha', options.minionCount?.() ?? 1),
    );
    add(() => 'SPAWN MIXED WAVE', () => options.onSpawnMixed(options.minionTeam?.() ?? 'alpha'));
    add(() => 'CLEAR MINIONS', () => options.onClearMinions());

    if (options.onMapReroll) {
      addHead('MAP');
      add(() => `SEED  ${options.mapSeed?.() ?? 0}`, () => options.onMapReroll?.());
      add(() => 'RANDOM SEED', () => options.onMapRandomSeed?.());
      add(() => 'REROLL MAP', () => options.onMapReroll?.());
      add(() => 'NEXT SEED', () => options.onMapNextSeed?.());
      add(() => 'PREV SEED', () => options.onMapPrevSeed?.());
      add(() => `MAP DEBUG  ${onOff(options.mapDebug?.() ?? false)}`, () => options.onToggleMapDebug?.());
    }

    addHead('DEBUG');
    add(() => `HITBOX  ${onOff(DEV_CHEATS.showHitboxes)}`, () => {
      DEV_CHEATS.showHitboxes = !DEV_CHEATS.showHitboxes;
    });
    add(() => `RANGES  ${onOff(DEV_CHEATS.showRanges)}`, () => {
      DEV_CHEATS.showRanges = !DEV_CHEATS.showRanges;
    });
    add(() => `AI  ${onOff(DEV_CHEATS.showAi)}`, () => {
      DEV_CHEATS.showAi = !DEV_CHEATS.showAi;
    });
    add(() => `SPAWNS  ${onOff(DEV_CHEATS.showSpawns)}`, () => {
      DEV_CHEATS.showSpawns = !DEV_CHEATS.showSpawns;
    });
    add(() => `WAVE  ${onOff(DEV_CHEATS.showWaveInfo)}`, () => {
      DEV_CHEATS.showWaveInfo = !DEV_CHEATS.showWaveInfo;
    });
    add(() => `XP  ${onOff(DEV_CHEATS.showXpInfo)}`, () => {
      DEV_CHEATS.showXpInfo = !DEV_CHEATS.showXpInfo;
    });
    add(() => `SCORE  ${onOff(DEV_CHEATS.showScore)}`, () => {
      DEV_CHEATS.showScore = !DEV_CHEATS.showScore;
    });
    add(() => `STATS  ${onOff(DEV_CHEATS.showDamageStats)}`, () => {
      DEV_CHEATS.showDamageStats = !DEV_CHEATS.showDamageStats;
    });

    addHead('MATCH');
    add(() => 'RESET MATCH', () => options.onResetMatch?.());
    add(() => 'FORCE WAVE', () => options.onForceWave?.());
    add(() => `PAUSE  ${onOff(options.paused?.() ?? false)}`, () => options.onTogglePause?.());
    add(() => 'GIVE XP', () => options.onGiveXp?.());
    add(() => 'GIVE LEVEL', () => options.onGiveLevel?.());
    add(() => `INF HP  ${onOff(DEV_CHEATS.godMode)}`, () => {
      DEV_CHEATS.godMode = !DEV_CHEATS.godMode;
      options.onCheatsChanged();
    });
    add(() => `NO CD  ${onOff(DEV_CHEATS.noCooldowns)}`, () => {
      DEV_CHEATS.noCooldowns = !DEV_CHEATS.noCooldowns;
      options.onCheatsChanged();
    });
    add(() => 'CLEAR FIELD', () => options.onClearBattlefield());

    const mask = this.maskShape.createGeometryMask();
    for (const row of this.rows) {
      const head = row.kind === 'head';
      const text = scene.add
        .text(width - 24, 0, row.label(), {
          fontFamily: FONTS.body,
          fontSize: head ? '10px' : mobile ? '13px' : '12px',
          fontStyle: 'bold',
          color: head ? hex(COLORS.yellow) : hex(COLORS.ink),
          backgroundColor: head ? undefined : hex(COLORS.paper),
          padding: head ? { x: 0, y: 4 } : { x: 10, y: mobile ? 6 : 4 },
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(223)
        .setVisible(false)
        .setMask(mask);
      if (!head && row.onPress) {
        text.setInteractive({ useHandCursor: true });
        text.on(Phaser.Input.Events.POINTER_DOWN, this.beginDrag, this);
        text.on(Phaser.Input.Events.POINTER_UP, () => {
          if (this.dragged) {
            return;
          }
          row.onPress?.();
          this.sync();
        });
      }
      row.text = text;
    }

    this.toggle.on(Phaser.Input.Events.POINTER_UP, () => {
      this.open = !this.open;
      this.setOpen(this.open);
    });
    this.panel.on(Phaser.Input.Events.POINTER_DOWN, this.beginDrag, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (!this.open) {
        return;
      }
      const point = hudPointer(this.scene, pointer);
      if (this.contains(point.x, point.y)) {
        this.beginDrag(pointer);
      }
    });
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onDrag, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.endDrag, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.endDrag, this);
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _g: unknown, _dx: number, dy: number) => {
      if (!this.open) {
        return;
      }
      this.scroll = Phaser.Math.Clamp(this.scroll + dy * 0.45, 0, this.maxScroll());
      this.layout(scene.scale.width, scene.scale.height);
    });
    this.layout(width, scene.scale.height);
    adoptHud(
      scene,
      this.toggle,
      this.panel,
      this.title,
      this.hint,
      this.maskShape,
      this.scrollTrack,
      this.scrollThumb,
      ...this.rows.flatMap((row) => (row.text ? [row.text] : [])),
    );
  }

  layout(width: number, height = 540): void {
    const frame = measureViewport(width, height);
    const mobile = frame.isMobile;
    this.rowH = mobile ? (frame.isPortrait ? 32 : 28) : 24;
    this.headH = mobile ? 24 : 20;
    this.panelW = Math.round(
      mobile ? clamp(frame.isPortrait ? width * 0.72 : Math.min(320, width * 0.42), 220, 340) : 280,
    );
    const top = Math.max(frame.safe.top + 8, mobile ? 52 : 64);
    this.panelY = top + (mobile ? 40 : 28);
    this.panelH = Math.max(220, height - this.panelY - Math.max(frame.safe.bottom, 12) - 8);
    this.panelX = width - Math.max(frame.contentInset.right, 12);
    this.toggle.setPosition(this.panelX, top);
    this.panel.setPosition(this.panelX, this.panelY).setSize(this.panelW, this.panelH);
    this.title.setPosition(this.panelX - 12, this.panelY + 6);
    this.hint.setPosition(this.panelX - 12, this.panelY + 24);
    const listTop = this.panelY + 44;
    const listH = this.panelH - 52;
    this.maskShape.setPosition(this.panelX, listTop).setSize(this.panelW - 8, listH);
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, this.maxScroll());
    let y = listTop - this.scroll;
    for (const row of this.rows) {
      row.text?.setPosition(this.panelX - 12, y);
      y += row.kind === 'head' ? this.headH : this.rowH;
    }
    const trackX = this.panelX - 7;
    this.scrollTrack.setPosition(trackX, listTop).setSize(3, listH);
    const range = this.maxScroll();
    const thumbH = range <= 0 ? listH : Math.max(28, listH * (listH / (listH + range)));
    const thumbY = range <= 0 ? listTop : listTop + (this.scroll / range) * (listH - thumbH);
    this.scrollThumb.setPosition(trackX, thumbY).setSize(3, thumbH);
    const showBar = this.open && range > 0;
    this.scrollTrack.setVisible(showBar);
    this.scrollThumb.setVisible(showBar);
  }

  sync(): void {
    for (const row of this.rows) {
      row.text?.setText(row.label());
    }
  }

  close(): void {
    this.open = false;
    this.setOpen(false);
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.open) {
      return;
    }
    const point = hudPointer(this.scene, pointer);
    if (!this.contains(point.x, point.y)) {
      return;
    }
    this.dragging = true;
    this.dragged = false;
    this.dragStartY = point.y;
    this.dragStartScroll = this.scroll;
  }

  private onDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) {
      return;
    }
    const point = hudPointer(this.scene, pointer);
    const dy = this.dragStartY - point.y;
    if (Math.abs(dy) > 8) {
      this.dragged = true;
    }
    this.scroll = Phaser.Math.Clamp(this.dragStartScroll + dy, 0, this.maxScroll());
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  private endDrag(): void {
    this.dragging = false;
    this.scene.time.delayedCall(40, () => {
      this.dragged = false;
    });
  }

  private contains(x: number, y: number): boolean {
    return x <= this.panelX && x >= this.panelX - this.panelW && y >= this.panelY && y <= this.panelY + this.panelH;
  }

  private maxScroll(): number {
    const content = this.rows.reduce((sum, row) => sum + (row.kind === 'head' ? this.headH : this.rowH), 0);
    return Math.max(0, content - (this.panelH - 56));
  }

  private setOpen(open: boolean): void {
    this.panel.setVisible(open);
    this.title.setVisible(open);
    this.hint.setVisible(open);
    this.maskShape.setVisible(open);
    this.scrollTrack.setVisible(open);
    this.scrollThumb.setVisible(open);
    for (const row of this.rows) {
      row.text?.setVisible(open);
    }
    this.layout(this.scene.scale.width, this.scene.scale.height);
    if (open) {
      this.sync();
    }
  }
}

const onOff = (value: boolean): string => (value ? 'ON' : 'OFF');

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
