import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { HERO_IDS, PLAYABLE_HEROES, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { heroSelectCopy } from '../heroes/selectCopy';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { audio, playHeroSelect } from '../audio';
import { fadeToScene } from './fadeToScene';
import {
  CORE_STAT_LABEL,
  CORE_STAT_ORDER,
  RATING_CAP,
  formatRating,
  type CoreStatId,
} from '../config/ratings';

const HERO_ORDER = HERO_IDS;

/** Functional draft picker. Confirm starts the real match. */
export class CharacterSelectScene extends Phaser.Scene {
  private leaving = false;
  private selected: HeroId = 'ninja';

  constructor() {
    super('CharacterSelect');
  }

  init(data: { selected?: HeroId } = {}): void {
    if (data.selected) {
      this.selected = data.selected;
    }
  }

  create(): void {
    this.leaving = false;
    createBackdrop(this, { accent: COLORS.cyan, embers: true });
    this.cameras.main.fadeIn(220, 7, 10, 18);

    const width = this.scale.width;
    const height = this.scale.height;

    this.add
      .text(width / 2, 12, 'CHOOSE YOUR FIGHTER', {
        fontFamily: FONTS.display,
        fontSize: '24px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 42, 'DRAFT MATCH  //  3:00  //  THREE LANES', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    this.drawCards(width);
    this.drawDetail(width, height);

    new ActionButton(this, 90, height - 32, {
      label: 'BACK',
      width: 140,
      height: 40,
      compact: true,
      onPress: () => this.leaveTo('MainMenu'),
    });
    new ActionButton(this, width - 120, height - 32, {
      label: 'CONFIRM',
      width: 200,
      height: 48,
      primary: true,
      compact: true,
      onPress: () => this.confirm(),
    });

    this.input.keyboard?.on('keydown-ESC', () => this.leaveTo('MainMenu'));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart({ selected: this.selected });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private drawCards(width: number): void {
    const n = HERO_ORDER.length;
    const gap = 10;
    const cardW = Math.min(168, (width - 40 - gap * (n - 1)) / n);
    const total = cardW * n + gap * (n - 1);
    const left = width / 2 - total / 2 + cardW / 2;
    HERO_ORDER.forEach((id, index) => {
      const copy = heroSelectCopy(id);
      const x = left + index * (cardW + gap);
      const y = 52;
      const selected = this.selected === id;
      const panel = this.add.rectangle(x, y, cardW, 156, COLORS.panel, 0.96).setOrigin(0.5, 0);
      panel.setStrokeStyle(3, selected ? COLORS.yellow : COLORS.cyan);
      const art = this.add.graphics();
      art.setPosition(x, y + 50);
      art.setScale(1.25);
      PLAYABLE_HEROES[id].draw(art, { facing: 'east', team: 'alpha' });
      this.add
        .text(x, y + 88, copy.name.toUpperCase(), {
          fontFamily: FONTS.display,
          fontSize: '13px',
          color: hex(COLORS.paper),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x, y + 104, copy.role.toUpperCase(), {
          fontFamily: FONTS.body,
          fontSize: '10px',
          fontStyle: 'bold',
          color: hex(COLORS.cyan),
          letterSpacing: 2,
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x, y + 120, `OVR  ${copy.overall}`, {
          fontFamily: FONTS.display,
          fontSize: '14px',
          color: hex(COLORS.yellow),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x, y + 136, `PWR  ${copy.power}`, {
          fontFamily: FONTS.body,
          fontSize: '10px',
          fontStyle: 'bold',
          color: hex(COLORS.orange),
          letterSpacing: 2,
        })
        .setOrigin(0.5, 0);
      const hit = this.add.rectangle(x, y + 78, cardW, 156, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => this.select(id));
      new ActionButton(this, x, y + 174, {
        label: selected ? 'SELECTED' : 'SELECT',
        width: cardW - 14,
        height: 30,
        compact: true,
        primary: selected,
        onPress: () => this.select(id),
      });
    });
  }

  private drawDetail(width: number, height: number): void {
    const copy = heroSelectCopy(this.selected);
    const top = 248;
    const boxH = Math.max(180, height - top - 70);
    const boxW = Math.min(860, width - 40);
    const box = this.add.rectangle(width / 2, top, boxW, boxH, COLORS.ink, 0.82).setOrigin(0.5, 0);
    box.setStrokeStyle(2, COLORS.cyan);
    const left = width / 2 - boxW / 2 + 16;
    const innerW = boxW - 32;
    const statsW = Math.min(320, Math.max(230, innerW * 0.4));
    const textW = innerW - statsW - 18;

    this.add.text(left, top + 8, `${copy.name.toUpperCase()}  //  ${copy.role.toUpperCase()}`, {
      fontFamily: FONTS.display,
      fontSize: '16px',
      color: hex(COLORS.paper),
      letterSpacing: 2,
    });
    this.add.text(left, top + 30, copy.description, {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: hex(COLORS.paper),
      wordWrap: { width: textW },
    });
    const lines = [
      `LIGHT  ${copy.light}`,
      `A1  ${copy.ability1.name} — ${copy.ability1.text}`,
      `A2  ${copy.ability2.name} — ${copy.ability2.text}`,
      `ULT  ${copy.ultimate.name} — ${copy.ultimate.text}`,
    ];
    lines.forEach((line, index) => {
      this.add.text(left, top + 54 + index * 32, line, {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(index === 0 ? COLORS.orange : COLORS.cyan),
        wordWrap: { width: textW },
      });
    });

    this.drawStatBlock(left + textW + 18, top + 10, statsW, copy);

    this.add
      .text(width / 2, height - 68, isTouchPrimary() ? 'TAP A FIGHTER, THEN CONFIRM' : '← → SELECT    ENTER CONFIRM', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);
  }

  private drawStatBlock(
    x: number,
    y: number,
    width: number,
    copy: { ratings: Record<CoreStatId, number>; overall: number; power: number },
  ): void {
    this.add.text(x, y, 'OVERALL', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex(COLORS.muted),
      letterSpacing: 1,
    });
    this.add
      .text(x + width, y, formatRating(copy.overall), {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(COLORS.yellow),
      })
      .setOrigin(1, 0);
    this.add.text(x, y + 20, 'POWER', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex(COLORS.muted),
      letterSpacing: 1,
    });
    this.add
      .text(x + width, y + 20, `${copy.power}`, {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(COLORS.orange),
      })
      .setOrigin(1, 0);

    const rowH = 18;
    const barsY = y + 46;
    CORE_STAT_ORDER.forEach((stat, index) => {
      const rowY = barsY + index * rowH;
      const value = copy.ratings[stat];
      this.add.text(x, rowY, CORE_STAT_LABEL[stat].toUpperCase(), {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      });
      const barX = x + 108;
      const barW = Math.max(70, width - 158);
      const barY = rowY + 5;
      this.add.rectangle(barX, barY, barW, 8, COLORS.panel, 1).setOrigin(0, 0.5);
      const fill = Math.max(2, (value / RATING_CAP) * barW);
      const fillColor = value >= 70 ? COLORS.orange : value >= 50 ? COLORS.cyan : COLORS.muted;
      this.add.rectangle(barX, barY, fill, 8, fillColor, 1).setOrigin(0, 0.5);
      this.add
        .text(barX + barW + 8, rowY, formatRating(value), {
          fontFamily: FONTS.body,
          fontSize: '11px',
          fontStyle: 'bold',
          color: hex(COLORS.paper),
        })
        .setOrigin(0, 0);
    });
  }

  private select(id: HeroId): void {
    if (this.leaving) {
      return;
    }
    this.selected = id;
    audio.unlock();
    playHeroSelect(id);
    this.scene.restart({ selected: id });
  }

  private move(dir: number): void {
    const index = HERO_ORDER.indexOf(this.selected);
    this.select(HERO_ORDER[(index + dir + HERO_ORDER.length) % HERO_ORDER.length]);
  }

  private confirm(): void {
    setSelectedHeroId(this.selected);
    this.leaveTo('Match', { heroId: this.selected });
  }

  private leaveTo(sceneName: string, data?: object): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    fadeToScene(this, sceneName, 220, data);
  }
}
