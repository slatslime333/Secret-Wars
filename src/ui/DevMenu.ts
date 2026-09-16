import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';
import { adoptHud } from './layout/hudCamera';
import { ScrollPanel } from './layout/ScrollPanel';
import { capturePress, isTapRelease, syncHitArea, type PointerPress } from './layout/tapGesture';
import { isTouchPrimary } from '../device';
import { measureViewport } from './layout/viewport';
import { layoutHudChrome } from './layout/hudChrome';
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
  private readonly scrollTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollThumb: Phaser.GameObjects.Rectangle;
  private readonly scroller: ScrollPanel;
  private open = false;
  private panelX = 0;
  private panelY = 0;
  private panelW = 280;
  private panelH = 420;
  private rowH = 22;
  private headH = 22;

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
      .setOrigin(0, 0)
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
      .setOrigin(0, 0)
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

    this.scroller = new ScrollPanel(scene, 0, 140, 240, 360, { depth: 223, scrollFactor: 0 });
    this.scroller.root.setVisible(false);
    this.scroller.onScrollChange(() => this.syncScrollThumb());

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
    add(() => 'HERO MENDER', () => options.onSwapHero('mender'));
    add(() => 'HERO DEMON', () => options.onSwapHero('demon'));

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
      const order: HeroId[] = ['ninja', 'cole', 'death', 'rope', 'witch', 'shadow', 'mender', 'demon'];
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

    const innerPad = 12;
    for (const row of this.rows) {
      const head = row.kind === 'head';
      const text = scene.add
        .text(innerPad, 0, row.label(), {
          fontFamily: FONTS.body,
          fontSize: head ? '10px' : mobile ? '13px' : '12px',
          fontStyle: 'bold',
          color: head ? hex(COLORS.yellow) : hex(COLORS.ink),
          backgroundColor: head ? undefined : hex(COLORS.paper),
          padding: head ? { x: 2, y: 4 } : { x: 10, y: mobile ? 6 : 4 },
          align: 'left',
        })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(223)
        .setVisible(true);
      if (!head && row.onPress) {
        text.setInteractive({ useHandCursor: true });
        let press: PointerPress | undefined;
        text.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
          press = capturePress(pointer);
        });
        text.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
          if (this.scroller.wasDragged || !isTapRelease(press, pointer)) {
            return;
          }
          row.onPress?.();
          this.sync();
        });
      }
      row.text = text;
      this.scroller.add(text);
    }

    this.toggle.on(Phaser.Input.Events.POINTER_UP, () => {
      this.open = !this.open;
      this.setOpen(this.open);
    });
    this.layout(width, scene.scale.height);
    adoptHud(
      scene,
      this.toggle,
      this.panel,
      this.title,
      this.hint,
      this.scrollTrack,
      this.scrollThumb,
      this.scroller.root,
    );
  }

  layout(width: number, height = 540): void {
    const frame = measureViewport(width, height);
    const chrome = layoutHudChrome(frame);
    const mobile = frame.isMobile;
    this.rowH = mobile ? (frame.isPortrait ? 38 : 34) : 28;
    this.headH = mobile ? 26 : 22;
    this.panelW = Math.round(
      mobile ? clamp(frame.isPortrait ? width * 0.78 : Math.min(300, width * 0.4), 230, 340) : 268,
    );
    this.panelX = width - Math.max(frame.contentInset.right, 10);
    const toggleY = chrome.minimap.y + chrome.minimap.height + (mobile ? 8 : 6);
    this.toggle.setPosition(this.panelX, toggleY);
    this.panelY = toggleY + (mobile ? 36 : 28);
    this.panelH = Math.max(200, height - this.panelY - Math.max(frame.safe.bottom, frame.controlInset.bottom * 0.15, 12) - 8);
    this.panel.setPosition(this.panelX, this.panelY).setSize(this.panelW, this.panelH);
    const innerX = this.panelX - this.panelW + 12;
    const innerW = this.panelW - 28;
    this.title.setPosition(innerX, this.panelY + 8);
    this.hint.setPosition(innerX, this.panelY + 24);
    const listTop = this.panelY + 42;
    const listH = this.panelH - 50;
    this.scroller.resize(innerX, listTop, innerW, listH);
    let y = 0;
    for (const row of this.rows) {
      const h = row.kind === 'head' ? this.headH : this.rowH;
      const gap = row.kind === 'head' ? 2 : 4;
      row.text?.setPosition(0, y);
      if (row.kind === 'item') {
        row.text?.setFixedSize(innerW, h - 2);
        if (row.text) {
          syncHitArea(row.text, innerW, h - 2);
        }
      }
      row.text?.setVisible(this.open);
      y += h + gap;
    }
    this.scroller.setContentSize(innerW, y);
    this.scroller.root.setVisible(this.open);
    this.syncScrollThumb();
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

  private syncScrollThumb(): void {
    const listTop = this.panelY + 42;
    const listH = this.panelH - 50;
    const trackX = this.panelX - 8;
    this.scrollTrack.setPosition(trackX, listTop).setSize(3, listH);
    const range = this.scroller.getMaxScroll();
    const thumbH = range <= 0 ? listH : Math.max(28, listH * (listH / (listH + range)));
    const thumbY = range <= 0 ? listTop : listTop + (this.scroller.getScroll() / range) * (listH - thumbH);
    this.scrollThumb.setPosition(trackX, thumbY).setSize(3, thumbH);
    const showBar = this.open && range > 0;
    this.scrollTrack.setVisible(showBar);
    this.scrollThumb.setVisible(showBar);
  }

  private setOpen(open: boolean): void {
    this.panel.setVisible(open);
    this.title.setVisible(open);
    this.hint.setVisible(open);
    this.scrollTrack.setVisible(open);
    this.scrollThumb.setVisible(open);
    this.layout(this.scene.scale.width, this.scene.scale.height);
    if (open) {
      this.sync();
    }
  }
}

const onOff = (value: boolean): string => (value ? 'ON' : 'OFF');

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
