import Phaser from 'phaser';
import type { MatchFormat } from '../config/arena';
import type { TeamId } from '../config/hero';
import { presentHero } from '../heroes/heroPortrait';
import { HERO_IDS, type HeroId } from '../heroes/roster';
import { heroSelectCopy } from '../heroes/selectCopy';
import {
  applySimulatorPick,
  cloneRoster,
  defaultSimulatorRoster,
  randomizeSimulatorRoster,
  rosterFitsFormat,
  simulatorSlotLabel,
  swapSimulatorTeams,
  type MatchRoster,
} from '../match/rosterSetup';
import { HeroPickerMenu } from '../ui/HeroPickerMenu';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { ScrollPanel } from '../ui/layout/ScrollPanel';
import { fittedMenuSubtitle, layoutMenuFooter, menuFooterReserve } from '../ui/layout/menuFooter';
import { measureViewport, resetUiCamera } from '../ui/layout/viewport';
import { audio, playHeroSelect } from '../audio';
import { fadeToScene } from './fadeToScene';

export type SimulatorSetupData = {
  roster?: MatchRoster;
  format?: MatchFormat;
};

/** Pick both rosters, then watch CPUs play. */
export class SimulatorSetupScene extends Phaser.Scene {
  private leaving = false;
  private format: MatchFormat = '3v3';
  private roster: MatchRoster = defaultSimulatorRoster('3v3');
  private picker?: HeroPickerMenu;

  constructor() {
    super('SimulatorSetup');
  }

  init(data: SimulatorSetupData = {}): void {
    this.format = data.format ?? '3v3';
    const roster = data.roster ?? defaultSimulatorRoster(this.format);
    this.roster = cloneRoster(rosterFitsFormat(roster, this.format) ? roster : defaultSimulatorRoster(this.format));
  }

  create(): void {
    this.leaving = false;
    resetUiCamera(this);
    createBackdrop(this, { accent: COLORS.yellow, embers: true });
    this.cameras.main.fadeIn(220, 7, 10, 18);
    this.picker = new HeroPickerMenu(this);

    const frame = measureViewport(this.scale.width, this.scale.height);
    const width = frame.width;
    const height = frame.height;
    const isPortrait = frame.isPortrait;
    const inset = frame.contentInset;
    const innerW = width - inset.left - inset.right;
    const footerH = menuFooterReserve(frame);
    const six = this.format === '6v6';

    this.add
      .text(width / 2, inset.top, 'SIMULATOR', {
        fontFamily: FONTS.display,
        fontSize: isPortrait ? '20px' : '24px',
        color: hex(COLORS.paper),
        letterSpacing: isPortrait ? 2 : 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    const subtitle = fittedMenuSubtitle(
      this,
      width / 2,
      inset.top + (isPortrait ? 24 : 30),
      six ? 'PICK BOTH TEAMS  //  TWO OF EACH CLASS' : 'PICK BOTH TEAMS  //  1 TANK  1 FRONTLINER  1 SUPPORT',
      innerW,
      isPortrait,
    );
    const swap = this.add
      .text(width / 2, inset.top + (isPortrait ? 24 : 30) + subtitle.height + 4, 'SWAP TEAMS', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    swap.on(Phaser.Input.Events.POINTER_UP, () => this.swapTeams());

    const bodyTop = inset.top + (isPortrait ? 24 : 30) + subtitle.height + 22;
    const bodyBot = height - inset.bottom - footerH;
    this.drawTeams(width, height, isPortrait, bodyTop, Math.max(140, bodyBot - bodyTop));

    layoutMenuFooter(this, frame, [
      { label: 'BACK', onPress: () => this.leaveTo('MatchFormat', { mode: 'simulator' }) },
      { label: 'RANDOMIZE', shortLabel: 'RAND', onPress: () => this.randomize() },
      { label: 'WATCH', primary: true, onPress: () => this.startMatch() },
    ]);

    this.input.keyboard?.on('keydown-ESC', () => this.leaveTo('MatchFormat', { mode: 'simulator' }));
    this.input.keyboard?.on('keydown-ENTER', () => this.startMatch());
    this.input.keyboard?.on('keydown-R', () => this.randomize());

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart({ roster: this.roster, format: this.format });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.picker?.destroy();
    });
  }

  private drawTeams(width: number, _height: number, isPortrait: boolean, top: number, bodyH: number): void {
    const six = this.format === '6v6';
    const panelH = six ? 328 : 250;
    if (isPortrait) {
      const colW = Math.min(420, width - 36);
      const totalH = panelH * 2 + 18;
      const scroll = new ScrollPanel(this, (width - colW) / 2, top, colW, bodyH);
      this.drawTeam('alpha', colW / 2, 0, colW, scroll.content);
      this.drawTeam('bravo', colW / 2, panelH + 18, colW, scroll.content);
      scroll.setContentSize(colW, totalH);
      return;
    }
    const colW = Math.min(400, width * 0.42);
    this.drawTeam('alpha', width / 2 - colW / 2 - 12, top, colW);
    this.drawTeam('bravo', width / 2 + colW / 2 + 12, top, colW);
  }

  private drawTeam(
    team: TeamId,
    x: number,
    y: number,
    width: number,
    parent?: Phaser.GameObjects.Container,
  ): void {
    const six = this.format === '6v6';
    const count = this.roster[team].length;
    const rowH = six ? 44 : 66;
    const panelH = 42 + count * rowH + 8;
    const accent = team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const panel = this.add.rectangle(x, y, width, panelH, COLORS.ink, 0.82).setOrigin(0.5, 0);
    panel.setStrokeStyle(2, accent);
    const title = this.add
      .text(x, y + 10, team === 'alpha' ? 'ALPHA' : 'BRAVO', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(accent),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);
    parent?.add([panel, title]);

    this.roster[team].forEach((_hero, index) => {
      this.drawSlot(team, index, x, y + 36 + index * rowH, width - 24, parent);
    });
  }

  private drawSlot(
    team: TeamId,
    index: number,
    x: number,
    y: number,
    width: number,
    parent?: Phaser.GameObjects.Container,
  ): void {
    const six = this.format === '6v6';
    const heroId = this.roster[team][index] ?? 'ninja';
    const copy = heroSelectCopy(heroId);
    const accent = team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const rowH = six ? 40 : 58;
    const row = this.add.rectangle(x, y, width, rowH, COLORS.panel, 0.96).setOrigin(0.5, 0);
    row.setStrokeStyle(2, accent);
    row.setInteractive({ useHandCursor: true });
    row.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => this.openPick(team, index, pointer.x, pointer.y));

    const art = presentHero(this, x - width / 2 + 36, y + (six ? 6 : 12), heroId, {
      facing: team === 'alpha' ? 'east' : 'west',
      team,
      scale: six ? 0.64 : 0.82,
    });

    const laneLabel = this.add
      .text(x - width / 2 + 64, y + (six ? 4 : 8), simulatorSlotLabel(index), {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0, 0);
    const name = this.add
      .text(x - width / 2 + 64, y + (six ? 18 : 24), copy.name.toUpperCase(), {
        fontFamily: FONTS.display,
        fontSize: six ? '13px' : '16px',
        color: hex(COLORS.paper),
        letterSpacing: 1,
      })
      .setOrigin(0, 0);
    const hint = this.add
      .text(x + width / 2 - 12, y + (six ? 12 : 20), 'TAP', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      })
      .setOrigin(1, 0);
    parent?.add([row, art, laneLabel, name, hint]);
  }

  private openPick(team: TeamId, index: number, x: number, y: number): void {
    if (this.leaving) {
      return;
    }
    const current = this.roster[team][index];
    this.picker?.open(
      x,
      y,
      HERO_IDS.map((id) => ({ id, current: id === current })),
      team,
      (heroId) => this.pickHero(team, index, heroId),
    );
  }

  private pickHero(team: TeamId, index: number, heroId: HeroId): void {
    if (this.leaving) {
      return;
    }
    this.roster = applySimulatorPick(this.roster, team, index, heroId);
    audio.unlock();
    playHeroSelect(heroId);
    this.scene.restart({ roster: this.roster, format: this.format });
  }

  private swapTeams(): void {
    if (this.leaving) {
      return;
    }
    this.roster = swapSimulatorTeams(this.roster);
    this.scene.restart({ roster: this.roster, format: this.format });
  }

  private randomize(): void {
    if (this.leaving) {
      return;
    }
    this.roster = randomizeSimulatorRoster(Math.random, this.format);
    this.scene.restart({ roster: this.roster, format: this.format });
  }

  private startMatch(): void {
    this.leaveTo('Match', { simulator: true, roster: cloneRoster(this.roster), format: this.format });
  }

  private leaveTo(sceneName: string, data?: object): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.picker?.close();
    fadeToScene(this, sceneName, 220, data);
  }
}
