import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { HERO_IDS, PLAYABLE_HEROES, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { heroSelectCopy } from '../heroes/selectCopy';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { clamp, measureViewport } from '../ui/layout/viewport';
import { ScrollPanel } from '../ui/layout/ScrollPanel';
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
  private cardScroll?: ScrollPanel;
  private detailScroll?: ScrollPanel;

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

    const frame = measureViewport(this.scale.width, this.scale.height);
    const width = frame.width;
    const height = frame.height;
    const inset = frame.contentInset;

    this.add
      .text(width / 2, inset.top, 'CHOOSE YOUR FIGHTER', {
        fontFamily: FONTS.display,
        fontSize: frame.isPortrait ? '18px' : '24px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, inset.top + 28, 'DRAFT MATCH  //  3:00  //  THREE LANES', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    const headerH = 52;
    const footerH = Math.max(frame.minTouch + 8, 52);
    const bodyTop = inset.top + headerH;
    const bodyBottom = height - inset.bottom - footerH;
    const bodyH = Math.max(120, bodyBottom - bodyTop);
    const tight = bodyH < 300;
    const cardH = tight ? Math.round(clamp(bodyH * 0.42, 100, 128)) : 168;
    const cardsBottom = this.drawCards(inset.left, bodyTop, width - inset.left - inset.right, cardH);
    this.drawDetail(
      inset.left,
      cardsBottom + 6,
      width - inset.left - inset.right,
      Math.max(80, bodyBottom - cardsBottom - 8),
      false,
    );

    const btnH = Math.max(40, Math.min(48, frame.minTouch));
    new ActionButton(this, inset.left + 70, height - inset.bottom - btnH / 2, {
      label: 'BACK',
      width: 140,
      height: btnH,
      compact: true,
      onPress: () => this.leaveTo('MainMenu'),
    });
    new ActionButton(this, width - inset.right - 100, height - inset.bottom - btnH / 2, {
      label: 'CONFIRM',
      width: 200,
      height: Math.max(btnH, 48),
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
      this.cardScroll?.destroy();
      this.detailScroll?.destroy();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private drawCards(x: number, y: number, viewW: number, cardH: number): number {
    const n = HERO_ORDER.length;
    const gap = 12;
    const cardW = Math.round(clamp(viewW * 0.36, 148, 188));
    const total = cardW * n + gap * (n - 1);
    const host = total <= viewW ? this.add.container(x, y) : null;
    if (total > viewW) {
      this.cardScroll = new ScrollPanel(this, x, y, viewW, cardH + 8, { axis: 'x' });
      this.cardScroll.setContentSize(total + 8, cardH + 8);
    }

    HERO_ORDER.forEach((id, index) => {
      const copy = heroSelectCopy(id);
      const cx = (total <= viewW ? (viewW - total) / 2 : 0) + cardW / 2 + index * (cardW + gap);
      const selected = this.selected === id;
      const panel = this.add.rectangle(cx, 0, cardW, cardH, COLORS.panel, 0.96).setOrigin(0.5, 0);
      panel.setStrokeStyle(3, selected ? COLORS.yellow : COLORS.cyan);
      const art = this.add.graphics();
      art.setPosition(cx, 48);
      art.setScale(1.25);
      PLAYABLE_HEROES[id].draw(art, { facing: 'east', team: 'alpha' });
      const name = this.add
        .text(cx, 86, copy.name.toUpperCase(), {
          fontFamily: FONTS.display,
          fontSize: '13px',
          color: hex(COLORS.paper),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      const role = this.add
        .text(cx, 104, copy.role.toUpperCase(), {
          fontFamily: FONTS.body,
          fontSize: copy.role.length > 12 ? '8px' : '10px',
          fontStyle: 'bold',
          color: hex(COLORS.cyan),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      const ovr = this.add
        .text(cx, 122, `OVR  ${copy.overall}`, {
          fontFamily: FONTS.display,
          fontSize: '14px',
          color: hex(COLORS.yellow),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      const pwr = this.add
        .text(cx, 140, `PWR  ${copy.power}`, {
          fontFamily: FONTS.body,
          fontSize: '10px',
          fontStyle: 'bold',
          color: hex(COLORS.orange),
          letterSpacing: 2,
        })
        .setOrigin(0.5, 0);
      const hit = this.add.rectangle(cx, cardH / 2, cardW, cardH, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => {
        if (this.cardScroll?.wasDragged) {
          return;
        }
        this.select(id);
      });
      const bits = [panel, art, name, role, ovr, pwr, hit];
      if (this.cardScroll) {
        bits.forEach((bit) => this.cardScroll!.add(bit));
      } else {
        host?.add(bits);
      }
    });

    return y + cardH + 8;
  }

  private drawDetail(x: number, y: number, boxW: number, boxH: number, showHint = true): void {
    const copy = heroSelectCopy(this.selected);
    const frame = measureViewport(this.scale.width, this.scale.height);
    const box = this.add.rectangle(x, y, boxW, Math.max(120, boxH), COLORS.ink, 0.82).setOrigin(0, 0);
    box.setStrokeStyle(2, COLORS.cyan);

    this.detailScroll = new ScrollPanel(this, x + 8, y + 8, boxW - 16, Math.max(100, boxH - 16));
    const inner = this.detailScroll.content;
    const innerW = boxW - 32;
    const stack = frame.isPortrait || boxW < 640;
    const statsW = stack ? innerW : Math.min(320, Math.max(220, innerW * 0.38));
    const textW = stack ? innerW : innerW - statsW - 18;

    const title = this.add.text(0, 0, `${copy.name.toUpperCase()}  //  ${copy.role.toUpperCase()}`, {
      fontFamily: FONTS.display,
      fontSize: '16px',
      color: hex(COLORS.paper),
      letterSpacing: 2,
    });
    inner.add(title);

    const sections: { heading: string; body: string; accent: number }[] = [
      { heading: 'OVERVIEW', body: copy.description, accent: COLORS.paper },
      { heading: 'LIGHT ATTACK', body: copy.light, accent: COLORS.orange },
      { heading: copy.ability1.name.toUpperCase(), body: copy.ability1.text, accent: COLORS.cyan },
      { heading: copy.ability2.name.toUpperCase(), body: copy.ability2.text, accent: COLORS.cyan },
      { heading: `ULTIMATE  //  ${copy.ultimate.name.toUpperCase()}`, body: copy.ultimate.text, accent: COLORS.yellow },
    ];
    let textBottom = 26;
    sections.forEach((section) => {
      const heading = this.add.text(0, textBottom, section.heading, {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      });
      inner.add(heading);
      textBottom += heading.height + 3;
      const body = this.add.text(0, textBottom, section.body, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: hex(section.accent),
        wordWrap: { width: textW },
      });
      inner.add(body);
      textBottom += body.height + 12;
    });

    const statsY = stack ? textBottom + 8 : 8;
    const statsX = stack ? 0 : textW + 18;
    this.drawStatBlock(inner, statsX, statsY, statsW, copy);
    const contentH = Math.max(textBottom, statsY + 46 + CORE_STAT_ORDER.length * 18 + 8);
    this.detailScroll.setContentSize(innerW, contentH + 12);

    if (showHint) {
      this.add
        .text(this.scale.width / 2, y + boxH + 4, isTouchPrimary() ? 'TAP A FIGHTER, THEN CONFIRM' : '← → SELECT    ENTER CONFIRM', {
          fontFamily: FONTS.body,
          fontSize: '11px',
          color: hex(COLORS.muted),
          letterSpacing: 2,
        })
        .setOrigin(0.5, 0);
    }
  }

  private drawStatBlock(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    copy: { ratings: Record<CoreStatId, number>; overall: number; power: number },
  ): void {
    const add = (obj: Phaser.GameObjects.GameObject) => parent.add(obj);
    add(
      this.add.text(x, y, 'OVERALL', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      }),
    );
    add(
      this.add
        .text(x + width, y, formatRating(copy.overall), {
          fontFamily: FONTS.display,
          fontSize: '16px',
          color: hex(COLORS.yellow),
        })
        .setOrigin(1, 0),
    );
    add(
      this.add.text(x, y + 20, 'POWER', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      }),
    );
    add(
      this.add
        .text(x + width, y + 20, `${copy.power}`, {
          fontFamily: FONTS.display,
          fontSize: '16px',
          color: hex(COLORS.orange),
        })
        .setOrigin(1, 0),
    );

    const rowH = 18;
    const barsY = y + 46;
    CORE_STAT_ORDER.forEach((stat, index) => {
      const rowY = barsY + index * rowH;
      const value = copy.ratings[stat];
      add(
        this.add.text(x, rowY, CORE_STAT_LABEL[stat].toUpperCase(), {
          fontFamily: FONTS.body,
          fontSize: '11px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          letterSpacing: 1,
        }),
      );
      const barX = x + 108;
      const barW = Math.max(70, width - 158);
      const barY = rowY + 5;
      add(this.add.rectangle(barX, barY, barW, 8, COLORS.panel, 1).setOrigin(0, 0.5));
      const fill = Math.max(2, (value / RATING_CAP) * barW);
      const fillColor = value >= 70 ? COLORS.orange : value >= 50 ? COLORS.cyan : COLORS.muted;
      add(this.add.rectangle(barX, barY, fill, 8, fillColor, 1).setOrigin(0, 0.5));
      add(
        this.add
          .text(barX + barW + 8, rowY, formatRating(value), {
            fontFamily: FONTS.body,
            fontSize: '11px',
            fontStyle: 'bold',
            color: hex(COLORS.paper),
          })
          .setOrigin(0, 0),
      );
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
