import Phaser from 'phaser';
import type { MatchFormat } from '../config/arena';
import type { TeamId } from '../config/hero';
import type { HeroId } from '../heroes/roster';
import { presentHero } from '../heroes/heroPortrait';
import { heroSelectCopy } from '../heroes/selectCopy';
import { DRAFT_CLASSES, DRAFT_CLASS_LABEL, draftClassOf, type DraftClass } from '../draft/classes';
import {
  cycleEnemyPick,
  defaultEnemyPicks,
  draftFromEnemyPicks,
  pickPlayerSpawn,
  placeDraft,
  randomizeDraft,
  rememberPlayerSpawn,
  type PlayDraft,
} from '../draft/rosterBuild';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { ScrollPanel } from '../ui/layout/ScrollPanel';
import { measureViewport, resetUiCamera } from '../ui/layout/viewport';
import { audio, playHeroSelect } from '../audio';
import { fadeToScene } from './fadeToScene';

export type RosterDraftData = {
  heroId?: HeroId;
  picks?: Record<DraftClass, HeroId>;
  format?: MatchFormat;
  sixDraft?: PlayDraft;
};

/** After fighter select: pick the other team or randomize a legal war. */
export class RosterDraftScene extends Phaser.Scene {
  private leaving = false;
  private playerId: HeroId = 'ninja';
  private picks: Record<DraftClass, HeroId> = defaultEnemyPicks('ninja', Math.random);
  private format: MatchFormat = '3v3';
  private sixDraft?: PlayDraft;

  constructor() {
    super('RosterDraft');
  }

  init(data: RosterDraftData = {}): void {
    this.playerId = data.heroId ?? 'ninja';
    this.format = data.format ?? '3v3';
    this.sixDraft = this.format === '6v6' ? data.sixDraft ?? randomizeDraft(this.playerId, Math.random, '6v6') : undefined;
    this.picks = data.picks ?? defaultEnemyPicks(this.playerId, Math.random);
    if (draftClassOf(this.playerId) && this.picks[draftClassOf(this.playerId)] === this.playerId) {
      this.picks = defaultEnemyPicks(this.playerId, Math.random);
    }
  }

  create(): void {
    this.leaving = false;
    resetUiCamera(this);
    createBackdrop(this, { accent: COLORS.yellow, embers: true });
    this.cameras.main.fadeIn(220, 7, 10, 18);

    const frame = measureViewport(this.scale.width, this.scale.height);
    const width = frame.width;
    const height = frame.height;
    const inset = frame.contentInset;
    const stack = frame.isPortrait || width < 700;

    this.add
      .text(width / 2, inset.top, 'BUILD THE WAR', {
        fontFamily: FONTS.display,
        fontSize: frame.isPortrait ? '16px' : '24px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(width / 2, inset.top + (frame.isPortrait ? 22 : 30), this.format === '6v6' ? 'TWO SUPPORT  //  TWO FRONTLINER  //  TWO TANK' : 'ONE SUPPORT  //  ONE FRONTLINER  //  ONE TANK', {
        fontFamily: FONTS.body,
        fontSize: frame.isPortrait ? '10px' : '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    const headerH = frame.isPortrait ? 48 : 58;
    const footerH = Math.max(frame.minTouch + 12, 64);
    const bodyTop = inset.top + headerH;
    const bodyBottom = height - inset.bottom - footerH;
    const bodyH = Math.max(140, bodyBottom - bodyTop);

    const panelH = this.format === '6v6' ? 328 : 250;
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

    new ActionButton(this, inset.left + 70, height - inset.bottom - 28, {
      label: 'BACK',
      width: 140,
      height: 40,
      compact: true,
      onPress: () => this.leaveTo('MatchFormat', { heroId: this.playerId }),
    });
    new ActionButton(this, width / 2, height - inset.bottom - 28, {
      label: 'RANDOMIZE',
      width: 180,
      height: 44,
      compact: true,
      onPress: () => (this.format === '6v6' ? this.reshuffle() : this.startMatch(true)),
    });
    new ActionButton(this, width - inset.right - 100, height - inset.bottom - 28, {
      label: 'FIGHT',
      width: 200,
      height: 48,
      primary: true,
      compact: true,
      onPress: () => this.startMatch(false),
    });

    this.input.keyboard?.on('keydown-ESC', () => this.leaveTo('MatchFormat', { heroId: this.playerId }));
    this.input.keyboard?.on('keydown-ENTER', () => this.startMatch(false));
    this.input.keyboard?.on('keydown-R', () => (this.format === '6v6' ? this.reshuffle() : this.startMatch(true)));

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart({ heroId: this.playerId, picks: this.picks, format: this.format, sixDraft: this.sixDraft });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private draft() {
    if (this.format === '6v6') {
      return this.sixDraft ?? randomizeDraft(this.playerId, Math.random, '6v6');
    }
    return draftFromEnemyPicks(this.playerId, this.picks);
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
    const draft = this.draft();
    const six = this.format === '6v6';
    const heroes: HeroId[] = theirs
      ? six
        ? draft.enemies
        : DRAFT_CLASSES.map((cls) => this.picks[cls])
      : six
        ? [this.playerId, ...draft.allies]
        : DRAFT_CLASSES.map((cls) =>
            cls === draftClassOf(this.playerId)
              ? this.playerId
              : (draft.allies.find((id) => draftClassOf(id) === cls) ?? this.playerId),
          );
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
      .text(
        x,
        y + 28,
        six
          ? theirs
            ? 'RANDOMIZE TO RESHUFFLE'
            : 'YOU  +  FIVE ALLIES'
          : theirs
            ? 'TAP A CLASS TO SWAP'
            : 'YOU  +  TWO ALLIES',
        {
          fontFamily: FONTS.body,
          fontSize: '10px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          letterSpacing: 1,
        },
      )
      .setOrigin(0.5, 0);
    parent?.add([panel, title, hint]);

    heroes.forEach((heroId, index) => {
      this.drawSlot(side, draftClassOf(heroId), heroId, x, y + 46 + index * rowH, width - 24, parent, six);
    });
  }

  private drawSlot(
    side: 'yours' | 'theirs',
    cls: DraftClass,
    heroId: HeroId,
    x: number,
    y: number,
    width: number,
    parent?: Phaser.GameObjects.Container,
    compact = false,
  ): void {
    const theirs = side === 'theirs';
    const locked = compact || !theirs || cls === draftClassOf(this.playerId);
    const copy = heroSelectCopy(heroId);
    const accent = theirs ? COLORS.redBright : COLORS.cyan;
    const rowH = compact ? 40 : 58;
    const row = this.add.rectangle(x, y, width, rowH, COLORS.panel, 0.96).setOrigin(0.5, 0);
    row.setStrokeStyle(2, locked ? accent : COLORS.yellow);
    if (theirs && !locked) {
      row.setInteractive({ useHandCursor: true });
      row.on(Phaser.Input.Events.POINTER_UP, () => this.cycle(cls));
    }

    const art = presentHero(this, x - width / 2 + 36, y + (compact ? 6 : 12), heroId, {
      facing: 'south',
      team: (theirs ? 'bravo' : 'alpha') as TeamId,
      rival: theirs,
      scale: compact ? 0.64 : 0.78,
    });

    const you = !theirs && heroId === this.playerId;
    const name = this.add
      .text(x - width / 2 + 68, y + (compact ? 4 : 10), copy.name.toUpperCase(), {
        fontFamily: FONTS.display,
        fontSize: compact ? '12px' : '14px',
        color: hex(COLORS.paper),
        letterSpacing: 1,
      })
      .setOrigin(0, 0);
    const role = this.add
      .text(
        x - width / 2 + 68,
        y + (compact ? 20 : 30),
        DRAFT_CLASS_LABEL[cls] + (you ? '  //  YOU' : compact ? '' : locked ? '  //  LOCKED' : '  //  TAP'),
        {
          fontFamily: FONTS.body,
          fontSize: compact ? '10px' : '11px',
          fontStyle: 'bold',
          color: hex(you ? COLORS.cyan : locked ? COLORS.muted : COLORS.yellow),
          letterSpacing: 1,
        },
      )
      .setOrigin(0, 0);
    parent?.add([row, art, name, role]);
  }

  private cycle(cls: DraftClass): void {
    if (this.leaving || cls === draftClassOf(this.playerId)) {
      return;
    }
    this.picks = cycleEnemyPick(this.playerId, this.picks, cls);
    audio.unlock();
    playHeroSelect(this.picks[cls]);
    this.scene.restart({ heroId: this.playerId, picks: this.picks, format: this.format, sixDraft: this.sixDraft });
  }

  private reshuffle(): void {
    if (this.leaving) {
      return;
    }
    this.sixDraft = randomizeDraft(this.playerId, Math.random, '6v6');
    audio.unlock();
    playHeroSelect(this.playerId);
    this.scene.restart({ heroId: this.playerId, picks: this.picks, format: this.format, sixDraft: this.sixDraft });
  }

  private startMatch(randomize: boolean): void {
    const draft =
      this.format === '6v6'
        ? this.draft()
        : randomize
          ? randomizeDraft(this.playerId)
          : this.draft();
    const spawn = pickPlayerSpawn();
    rememberPlayerSpawn(spawn);
    const placed = placeDraft(draft, spawn);
    this.leaveTo('Match', {
      heroId: this.playerId,
      draft,
      roster: placed.roster,
      playerTeam: placed.playerTeam,
      playerLane: placed.playerLane,
      format: this.format,
    });
  }

  private leaveTo(sceneName: string, data?: object): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    fadeToScene(this, sceneName, 220, data);
  }
}
