import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';
import { DEV_CHEATS } from '../debug/devCheats';
import type { HeroId } from '../heroes/roster';
import type { MinionKind } from '../config/minion';
import type { TeamId } from '../config/hero';

export type DevMenuHandlers = {
  onToggleCpu: () => void;
  cpuPresent: () => boolean;
  onSwapHero: (id: HeroId) => void;
  onHeal: () => void;
  onRefillAmmo: () => void;
  onResetPos: () => void;
  onResetCooldowns: () => void;
  onSpawnMinion: (kind: MinionKind, team: TeamId, count: number) => void;
  onSpawnMixed: (team: TeamId) => void;
  onClearMinions: () => void;
  onClearBattlefield: () => void;
  onCheatsChanged: () => void;
};

type Row = {
  label: () => string;
  onPress: () => void;
  text?: Phaser.GameObjects.Text;
};

/** Scrollable-feeling playlist for heroes, minions, and combat cheats. */
export class DevMenu {
  private readonly toggle: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly rows: Row[] = [];
  private open = false;

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
      .rectangle(width - 12, 92, 252, 568, COLORS.ink, 0.94)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(221)
      .setStrokeStyle(2, COLORS.yellow)
      .setVisible(false);

    this.title = scene.add
      .text(width - 24, 96, 'PLAYLIST', {
        fontFamily: FONTS.display,
        fontSize: '11px',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(222)
      .setVisible(false);

    const add = (label: () => string, onPress: () => void) => {
      const text = scene.add
        .text(width - 24, 0, label(), {
          fontFamily: FONTS.body,
          fontSize: '11px',
          fontStyle: 'bold',
          color: hex(COLORS.ink),
          backgroundColor: hex(COLORS.paper),
          padding: { x: 8, y: 4 },
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(223)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });
      text.on(Phaser.Input.Events.POINTER_UP, () => {
        onPress();
        this.sync();
      });
      this.rows.push({ label, onPress, text });
    };

    add(() => (options.cpuPresent() ? 'REMOVE CPU HERO' : 'SPAWN CPU HERO'), () => options.onToggleCpu());
    add(() => 'HERO NINJA', () => options.onSwapHero('ninja'));
    add(() => 'HERO COLE', () => options.onSwapHero('cole'));
    add(() => 'HERO DEATH', () => options.onSwapHero('death'));
    add(() => 'FULL HEALTH', () => options.onHeal());
    add(() => 'REFILL AMMO', () => options.onRefillAmmo());
    add(() => 'RESET POSITION', () => options.onResetPos());
    add(() => 'RESET COOLDOWNS', () => options.onResetCooldowns());
    add(() => 'SWORD x1  ALPHA', () => options.onSpawnMinion('sword', 'alpha', 1));
    add(() => 'SWORD x1  BRAVO', () => options.onSpawnMinion('sword', 'bravo', 1));
    add(() => 'SWORD x4  ALPHA', () => options.onSpawnMinion('sword', 'alpha', 4));
    add(() => 'SWORD x4  BRAVO', () => options.onSpawnMinion('sword', 'bravo', 4));
    add(() => 'RANGER x1 ALPHA', () => options.onSpawnMinion('ranger', 'alpha', 1));
    add(() => 'RANGER x1 BRAVO', () => options.onSpawnMinion('ranger', 'bravo', 1));
    add(() => 'RANGER x4 ALPHA', () => options.onSpawnMinion('ranger', 'alpha', 4));
    add(() => 'RANGER x4 BRAVO', () => options.onSpawnMinion('ranger', 'bravo', 4));
    add(() => 'MIXED ALPHA', () => options.onSpawnMixed('alpha'));
    add(() => 'MIXED BRAVO', () => options.onSpawnMixed('bravo'));
    add(() => 'CLEAR MINIONS', () => options.onClearMinions());
    add(() => 'CLEAR FIELD', () => options.onClearBattlefield());
    add(() => `NO CD  ${onOff(DEV_CHEATS.noCooldowns)}`, () => {
      DEV_CHEATS.noCooldowns = !DEV_CHEATS.noCooldowns;
      options.onCheatsChanged();
    });
    add(() => `GOD  ${onOff(DEV_CHEATS.godMode)}`, () => {
      DEV_CHEATS.godMode = !DEV_CHEATS.godMode;
      options.onCheatsChanged();
    });
    add(() => `INF AMMO  ${onOff(DEV_CHEATS.infiniteAmmo)}`, () => {
      DEV_CHEATS.infiniteAmmo = !DEV_CHEATS.infiniteAmmo;
      options.onCheatsChanged();
    });
    add(() => `RANGES  ${onOff(DEV_CHEATS.showRanges)}`, () => {
      DEV_CHEATS.showRanges = !DEV_CHEATS.showRanges;
    });
    add(() => `AI  ${onOff(DEV_CHEATS.showAi)}`, () => {
      DEV_CHEATS.showAi = !DEV_CHEATS.showAi;
    });
    add(() => `HITBOX  ${onOff(DEV_CHEATS.showHitboxes)}`, () => {
      DEV_CHEATS.showHitboxes = !DEV_CHEATS.showHitboxes;
    });

    this.toggle.on(Phaser.Input.Events.POINTER_UP, () => {
      this.open = !this.open;
      this.setOpen(this.open);
    });
    this.layout(width);
  }

  layout(width: number, height = 0): void {
    void height;
    this.toggle.setPosition(width - 12, 64);
    this.panel.setPosition(width - 12, 92);
    this.title.setPosition(width - 24, 96);
    this.rows.forEach((row, index) => {
      row.text?.setPosition(width - 24, 114 + index * 20);
    });
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

  private setOpen(open: boolean): void {
    this.panel.setVisible(open);
    this.title.setVisible(open);
    for (const row of this.rows) {
      row.text?.setVisible(open);
    }
    if (open) {
      this.sync();
    }
  }
}

const onOff = (value: boolean): string => (value ? 'ON' : 'OFF');
