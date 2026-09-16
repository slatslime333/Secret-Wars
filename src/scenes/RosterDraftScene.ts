import Phaser from 'phaser';
import type { MatchFormat } from '../config/arena';
import type { TeamId } from '../config/hero';
import { HERO_IDS, type HeroId } from '../heroes/roster';
import { presentHero } from '../heroes/heroPortrait';
import { heroSelectCopy } from '../heroes/selectCopy';
import { DRAFT_CLASS_LABEL, draftClassOf } from '../draft/classes';
import {
  applyHeroPick,
  defaultEnemyPicks,
  draftFromEnemyPicks,
  draftFromSides,
  pickPlayerSpawn,
  placeDraft,
  randomizeDraft,
  rememberPlayerSpawn,
  sidesFromDraft,
  swapWarTeams,
  type WarSides,
} from '../draft/rosterBuild';
import { HeroPickerMenu } from '../ui/HeroPickerMenu';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { ScrollPanel } from '../ui/layout/ScrollPanel';
import { fittedMenuSubtitle, layoutMenuFooter, menuFooterReserve } from '../ui/layout/menuFooter';
import { measureViewport, resetUiCamera } from '../ui/layout/viewport';
import { audio, playHeroSelect } from '../audio';
import { fadeToScene } from './fadeToScene';

export type RosterDraftData = {
  heroId?: HeroId;
  format?: MatchFormat;
  sides?: WarSides;
};

/** After fighter select: pick the other team or randomize a legal war. */
export class RosterDraftScene extends Phaser.Scene {
  private leaving = false;
  private sides: WarSides = sidesFromDraft(draftFromEnemyPicks('ninja', defaultEnemyPicks('ninja', Math.random)));
  private picker?: HeroPickerMenu;

  constructor() {
    super('RosterDraft');
  }

  init(data: RosterDraftData = {}): void {
    if (data.sides) {
      this.sides = data.sides;
      return;
    }
    const playerId = data.heroId ?? 'ninja';
    const format = data.format ?? '3v3';
    this.sides = sidesFromDraft(
      format === '6v6'
        ? randomizeDraft(playerId, Math.random, '6v6')
        : draftFromEnemyPicks(playerId, defaultEnemyPicks(playerId, Math.random)),
    );
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
    const inset = frame.contentInset;
    const innerW = width - inset.left - inset.right;
    const stack = frame.isPortrait || width < 700;
    const six = this.sides.format === '6v6';
    const footerH = menuFooterReserve(frame);

    this.add
      .text(width / 2, inset.top, 'BUILD THE WAR', {
        fontFamily: FONTS.display,
        fontSize: frame.isPortrait ? '16px' : '24px',
        color: hex(COLORS.paper),
        letterSpacing: frame.isPortrait ? 1 : 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    const subtitle = fittedMenuSubtitle(
      this,
      width / 2,
      inset.top + (frame.isPortrait ? 20 : 30),
      six ? 'TWO SUPPORT  //  TWO FRONTLINER  //  TWO TANK' : 'ONE SUPPORT  //  ONE FRONTLINER  //  ONE TANK',
      innerW,
      frame.isPortrait,
    );
    const swap = this.add
      .text(width / 2, inset.top + (frame.isPortrait ? 20 : 30) + subtitle.height + 4, 'SWAP TEAMS', {
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

    const bodyTop = inset.top + (frame.isPortrait ? 20 : 30) + subtitle.height + 22;
    const bodyBottom = height - inset.bottom - footerH;
    const bodyH = Math.max(140, bodyBottom - bodyTop);

    const panelH = six ? 328 : 250;
    if (stack) {
      const colW = Math.min(420, width - inset.left - inset.right);
      const scroll = new ScrollPanel(this, (width - colW) / 2, bodyTop, colW, bodyH);
      this.drawTeam('yours', colW / 2, 0, colW, scroll.content);
      this.drawTeam('theirs', colW / 2, panelH + 18, colW, scroll.content);
      scroll.setContentSize(colW, panelH * 2 + 18);
    } else {
      const colW = Math.min(400, width * 0.42);
      this.drawTeam('yours', width / 2 - colW / 2 - 14, bodyTop, colW);
      this.drawTeam('theirs', width / 2 + colW / 2 + 14, bodyTop, colW);
    }

    layoutMenuFooter(this, frame, [
      { label: 'BACK', onPress: () => this.leaveTo('MatchFormat', { heroId: this.sides.playerId }) },
      { label: 'RANDOMIZE', shortLabel: 'RAND', onPress: () => this.reshuffle() },
      { label: 'FIGHT', primary: true, onPress: () => this.startMatch() },
    ]);

    this.input.keyboard?.on('keydown-ESC', () => this.leaveTo('MatchFormat', { heroId: this.sides.playerId }));
    this.input.keyboard?.on('keydown-ENTER', () => this.startMatch());
    this.input.keyboard?.on('keydown-R', () => this.reshuffle());

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart({ heroId: this.sides.playerId, format: this.sides.format, sides: this.sides });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.picker?.destroy();
    });
  }

  private drawTeam(
    side: 'yours' | 'theirs',
    x: number,
    y: number,
    width: number,
    parent?: Phaser.GameObjects.Container,
  ): void {
    const theirs = side === 'theirs';
    const accent = theirs ? COLORS.redBright : COLORS.cyan;
    const six = this.sides.format === '6v6';
    const heroes = theirs ? this.sides.theirs : this.sides.yours;
    const rowH = six ? 44 : 66;
    const panelH = 46 + heroes.length * rowH + 10;
    const panel = this.add.rectangle(x, y, width, panelH, COLORS.ink, 0.82).setOrigin(0.5, 0);
    panel.setStrokeStyle(2, accent);
    const title = this.add
      .text(x, y + 10, theirs ? 'OTHER TEAM' : 'YOUR TEAM', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(accent),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);
    const hint = this.add
      .text(x, y + 28, theirs ? 'TAP TO REPLACE' : 'YOU  +  TAP TO REPLACE', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0);
    parent?.add([panel, title, hint]);

    heroes.forEach((heroId, index) => {
      this.drawSlot(side, heroId, index, x, y + 46 + index * rowH, width - 24, parent);
    });
  }

  private drawSlot(
    side: 'yours' | 'theirs',
    heroId: HeroId,
    index: number,
    x: number,
    y: number,
    width: number,
    parent?: Phaser.GameObjects.Container,
  ): void {
    const theirs = side === 'theirs';
    const six = this.sides.format === '6v6';
    const cls = draftClassOf(heroId);
    const copy = heroSelectCopy(heroId);
    const accent = theirs ? COLORS.redBright : COLORS.cyan;
    const rowH = six ? 40 : 58;
    const you = !theirs && this.sides.yours.indexOf(this.sides.playerId) === index;
    const row = this.add.rectangle(x, y, width, rowH, COLORS.panel, 0.96).setOrigin(0.5, 0);
    row.setStrokeStyle(2, you ? COLORS.yellow : accent);
    row.setInteractive({ useHandCursor: true });
    row.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => this.openPick(side, index, you, pointer.x, pointer.y));

    const art = presentHero(this, x - width / 2 + 36, y + (six ? 6 : 12), heroId, {
      facing: 'south',
      team: (theirs ? 'bravo' : 'alpha') as TeamId,
      rival: theirs,
      scale: six ? 0.64 : 0.78,
    });

    const name = this.add
      .text(x - width / 2 + 68, y + (six ? 4 : 10), copy.name.toUpperCase(), {
        fontFamily: FONTS.display,
        fontSize: six ? '12px' : '14px',
        color: hex(COLORS.paper),
        letterSpacing: 1,
      })
      .setOrigin(0, 0);
    const role = this.add
      .text(
        x - width / 2 + 68,
        y + (six ? 20 : 30),
        DRAFT_CLASS_LABEL[cls] + (you ? '  //  YOU' : '  //  TAP'),
        {
          fontFamily: FONTS.body,
          fontSize: six ? '10px' : '11px',
          fontStyle: 'bold',
          color: hex(you ? COLORS.yellow : COLORS.muted),
          letterSpacing: 1,
        },
      )
      .setOrigin(0, 0);
    parent?.add([row, art, name, role]);
  }

  private openPick(side: 'yours' | 'theirs', index: number, playerSlot: boolean, x: number, y: number): void {
    if (this.leaving) {
      return;
    }
    const current = (side === 'yours' ? this.sides.yours : this.sides.theirs)[index];
    this.picker?.open(
      x,
      y,
      HERO_IDS.map((id) => ({ id, current: id === current })),
      side === 'yours' ? 'alpha' : 'bravo',
      (heroId) => this.pickHero(side, index, heroId, playerSlot),
    );
  }

  private pickHero(side: 'yours' | 'theirs', index: number, heroId: HeroId, playerSlot: boolean): void {
    if (this.leaving) {
      return;
    }
    this.sides = applyHeroPick(this.sides, side, index, heroId, playerSlot);
    audio.unlock();
    playHeroSelect(heroId);
    this.scene.restart({ heroId: this.sides.playerId, format: this.sides.format, sides: this.sides });
  }

  private swapTeams(): void {
    if (this.leaving) {
      return;
    }
    this.sides = swapWarTeams(this.sides);
    this.scene.restart({ heroId: this.sides.playerId, format: this.sides.format, sides: this.sides });
  }

  private reshuffle(): void {
    if (this.leaving) {
      return;
    }
    this.sides = sidesFromDraft(randomizeDraft(this.sides.playerId, Math.random, this.sides.format));
    audio.unlock();
    playHeroSelect(this.sides.playerId);
    this.scene.restart({ heroId: this.sides.playerId, format: this.sides.format, sides: this.sides });
  }

  private startMatch(): void {
    const draft = draftFromSides(this.sides);
    const spawn = pickPlayerSpawn();
    rememberPlayerSpawn(spawn);
    const placed = placeDraft(draft, spawn);
    this.leaveTo('Match', {
      heroId: this.sides.playerId,
      draft,
      roster: placed.roster,
      playerTeam: placed.playerTeam,
      playerLane: placed.playerLane,
      format: this.sides.format,
    });
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
