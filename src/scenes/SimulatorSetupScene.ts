import Phaser from 'phaser';
import { LANES, type LaneId } from '../config/arena';
import type { TeamId } from '../config/hero';
import { PLAYABLE_HEROES } from '../heroes/roster';
import { heroSelectCopy } from '../heroes/selectCopy';
import {
  DEFAULT_SIMULATOR_ROSTER,
  cloneRoster,
  cycleRosterLane,
  type MatchRoster,
} from '../match/rosterSetup';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { ScrollPanel } from '../ui/layout/ScrollPanel';
import { measureViewport, resetUiCamera } from '../ui/layout/viewport';
import { audio, playHeroSelect } from '../audio';
import { fadeToScene } from './fadeToScene';

/** Pick both 3v3 rosters, then watch CPUs play. */
export class SimulatorSetupScene extends Phaser.Scene {
  private leaving = false;
  private roster: MatchRoster = cloneRoster(DEFAULT_SIMULATOR_ROSTER);

  constructor() {
    super('SimulatorSetup');
  }

  init(data: { roster?: MatchRoster } = {}): void {
    this.roster = cloneRoster(data.roster ?? DEFAULT_SIMULATOR_ROSTER);
  }

  create(): void {
    this.leaving = false;
    resetUiCamera(this);
    createBackdrop(this, { accent: COLORS.yellow, embers: true });
    this.cameras.main.fadeIn(220, 7, 10, 18);

    const frame = measureViewport(this.scale.width, this.scale.height);
    const width = frame.width;
    const height = frame.height;
    const isPortrait = frame.isPortrait;
    const inset = frame.contentInset;

    this.add
      .text(width / 2, inset.top, 'SIMULATOR', {
        fontFamily: FONTS.display,
        fontSize: '24px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(width / 2, inset.top + 30, 'PICK BOTH TEAMS  //  THEN WATCH', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    this.drawTeams(width, height, isPortrait, inset.top + 58, height - inset.bottom - 70);

    new ActionButton(this, inset.left + 70, height - inset.bottom - 28, {
      label: 'BACK',
      width: 140,
      height: 40,
      compact: true,
      onPress: () => this.leaveTo('MainMenu'),
    });
    new ActionButton(this, width - inset.right - 100, height - inset.bottom - 28, {
      label: 'WATCH',
      width: 200,
      height: 48,
      primary: true,
      compact: true,
      onPress: () => this.startMatch(),
    });

    this.input.keyboard?.on('keydown-ESC', () => this.leaveTo('MainMenu'));
    this.input.keyboard?.on('keydown-ENTER', () => this.startMatch());

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart({ roster: this.roster });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private drawTeams(width: number, height: number, isPortrait: boolean, top: number, bodyH: number): void {
    if (isPortrait) {
      const colW = Math.min(420, width - 36);
      const totalH = 520;
      if (totalH > bodyH) {
        const scroll = new ScrollPanel(this, (width - colW) / 2, top, colW, bodyH);
        const holder = scroll.content;
        this.drawTeam('alpha', colW / 2, 0, colW, holder);
        this.drawTeam('bravo', colW / 2, 268, colW, holder);
        scroll.setContentSize(colW, totalH);
        return;
      }
      this.drawTeam('alpha', width / 2, top, colW);
      this.drawTeam('bravo', width / 2, top + 268, colW);
      return;
    }
    const colW = Math.min(400, width * 0.42);
    this.drawTeam('alpha', width / 2 - colW / 2 - 12, top, colW);
    this.drawTeam('bravo', width / 2 + colW / 2 + 12, top, colW);
    void height;
  }

  private drawTeam(
    team: TeamId,
    x: number,
    y: number,
    width: number,
    parent?: Phaser.GameObjects.Container,
  ): void {
    const accent = team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const panel = this.add.rectangle(x, y, width, 250, COLORS.ink, 0.82).setOrigin(0.5, 0);
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

    LANES.forEach((lane, index) => {
      this.drawSlot(team, lane, x, y + 42 + index * 66, width - 24, parent);
    });
  }

  private drawSlot(
    team: TeamId,
    lane: LaneId,
    x: number,
    y: number,
    width: number,
    parent?: Phaser.GameObjects.Container,
  ): void {
    const heroId = this.roster[team][LANES.indexOf(lane)];
    const copy = heroSelectCopy(heroId);
    const accent = team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const row = this.add.rectangle(x, y, width, 58, COLORS.panel, 0.96).setOrigin(0.5, 0);
    row.setStrokeStyle(2, accent);
    row.setInteractive({ useHandCursor: true });
    row.on(Phaser.Input.Events.POINTER_UP, () => this.cycle(team, lane));

    const art = this.add.graphics();
    art.setPosition(x - width / 2 + 36, y + 30);
    art.setScale(1.15);
    PLAYABLE_HEROES[heroId].draw(art, { facing: team === 'alpha' ? 'east' : 'west', team });

    const laneLabel = this.add
      .text(x - width / 2 + 64, y + 8, lane.toUpperCase(), {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0, 0);
    const name = this.add
      .text(x - width / 2 + 64, y + 24, copy.name.toUpperCase(), {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(COLORS.paper),
        letterSpacing: 1,
      })
      .setOrigin(0, 0);
    const hint = this.add
      .text(x + width / 2 - 12, y + 20, 'TAP TO CYCLE', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      })
      .setOrigin(1, 0);
    parent?.add([row, art, laneLabel, name, hint]);
  }

  private cycle(team: TeamId, lane: LaneId): void {
    if (this.leaving) {
      return;
    }
    this.roster = cycleRosterLane(this.roster, team, lane);
    const heroId = this.roster[team][LANES.indexOf(lane)];
    audio.unlock();
    playHeroSelect(heroId);
    this.scene.restart({ roster: this.roster });
  }

  private startMatch(): void {
    this.leaveTo('Match', { simulator: true, roster: cloneRoster(this.roster) });
  }

  private leaveTo(sceneName: string, data?: object): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    fadeToScene(this, sceneName, 220, data);
  }
}
