import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';
import { DEV_CHEATS } from '../debug/devCheats';
import type { HeroId } from '../heroes/roster';
import type { MinionKind } from '../config/minion';
import type { TeamId } from '../config/hero';

export type DevMenuHandlers = {
  onToggleCpu: () => void;
  cpuPresent: () => boolean;
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
  private readonly toggle: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly rows: Row[] = [];
  private readonly maskShape: Phaser.GameObjects.Rectangle;
  private open = false;
  private scroll = 0;
  private panelHeight = 420;

  constructor(scene: Phaser.Scene, options: DevMenuHandlers) {
    const width = scene.scale.width;

    this.toggle = scene.add
      .text(width - 12, 64, 'DEV', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        backgroundColor: hex(COLORS.ink),
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(220)
      .setInteractive({ useHandCursor: true });

    this.panel = scene.add
      .rectangle(width - 12, 92, 268, 420, COLORS.ink, 0.94)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(221)
      .setStrokeStyle(2, COLORS.yellow)
      .setVisible(false);

    this.title = scene.add
      .text(width - 24, 96, 'PLAY TEST', {
        fontFamily: FONTS.display,
        fontSize: '11px',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(222)
      .setVisible(false);

    this.maskShape = scene.add
      .rectangle(width - 12, 118, 268, 388, 0xffffff, 0)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(222)
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

    addHead('CPU');
    add(() => (options.cpuPresent() ? 'REMOVE CPU' : 'SPAWN CPU'), () => options.onToggleCpu());
    add(() => `CPU HERO  ${(options.cpuHeroId?.() ?? 'ninja').toUpperCase()}`, () => {
      const order: HeroId[] = ['ninja', 'cole', 'death'];
      const current = options.cpuHeroId?.() ?? 'ninja';
      const next = order[(order.indexOf(current) + 1) % order.length];
      options.onSetCpuHero?.(next);
    });
    add(() => (options.cpuPresent() ? 'CPU ON' : 'CPU OFF'), () => options.onToggleCpu());

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

    addHead('MATCH TESTING');
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

    const geometry = new Phaser.Geom.Rectangle(0, 0, 268, 388);
    const mask = this.maskShape.createGeometryMask();

    for (const row of this.rows) {
      const head = row.kind === 'head';
      const text = scene.add
        .text(width - 24, 0, row.label(), {
          fontFamily: FONTS.body,
          fontSize: head ? '10px' : '11px',
          fontStyle: 'bold',
          color: head ? hex(COLORS.yellow) : hex(COLORS.ink),
          backgroundColor: head ? undefined : hex(COLORS.paper),
          padding: head ? { x: 0, y: 4 } : { x: 8, y: 3 },
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(223)
        .setVisible(false)
        .setMask(mask);
      if (!head && row.onPress) {
        text.setInteractive({ useHandCursor: true, hitArea: geometry, hitAreaCallback: Phaser.Geom.Rectangle.Contains });
        text.on(Phaser.Input.Events.POINTER_UP, () => {
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
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _g: unknown, _dx: number, dy: number) => {
      if (!this.open) {
        return;
      }
      this.scroll = Phaser.Math.Clamp(this.scroll + dy * 0.4, 0, this.maxScroll());
      this.layout(scene.scale.width, scene.scale.height);
    });
    this.layout(width, scene.scale.height);
  }

  layout(width: number, height = 540): void {
    this.panelHeight = Math.min(520, Math.max(280, height - 110));
    this.toggle.setPosition(width - 12, 64);
    this.panel.setPosition(width - 12, 92).setSize(268, this.panelHeight);
    this.title.setPosition(width - 24, 96);
    this.maskShape.setPosition(width - 12, 118).setSize(268, this.panelHeight - 32);
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, this.maxScroll());
    let y = 118 - this.scroll;
    for (const row of this.rows) {
      row.text?.setPosition(width - 24, y);
      y += row.kind === 'head' ? 20 : 19;
    }
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

  private maxScroll(): number {
    const content = this.rows.reduce((sum, row) => sum + (row.kind === 'head' ? 20 : 19), 0);
    return Math.max(0, content - (this.panelHeight - 36));
  }

  private setOpen(open: boolean): void {
    this.panel.setVisible(open);
    this.title.setVisible(open);
    this.maskShape.setVisible(open);
    for (const row of this.rows) {
      row.text?.setVisible(open);
    }
    if (open) {
      this.sync();
    }
  }
}

const onOff = (value: boolean): string => (value ? 'ON' : 'OFF');
