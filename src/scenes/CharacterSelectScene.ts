import Phaser from 'phaser';
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

let carouselTouched = false;

/** Functional draft picker. Confirm starts the real match. */
export class CharacterSelectScene extends Phaser.Scene {
  private leaving = false;
  private selected: HeroId = 'ninja';
  private cardScroll?: ScrollPanel;
  private detailScroll?: ScrollPanel;
  private swipeHint?: Phaser.GameObjects.Container;

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
    const stack = frame.isPortrait || width < 640;

    this.add
      .text(width / 2, inset.top, 'CHOOSE YOUR FIGHTER', {
        fontFamily: FONTS.display,
        fontSize: frame.isPortrait ? '16px' : '24px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, inset.top + (frame.isPortrait ? 22 : 28), 'DRAFT MATCH  //  3:00  //  THREE LANES', {
        fontFamily: FONTS.body,
        fontSize: frame.isPortrait ? '10px' : '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    const headerH = frame.isPortrait ? 44 : 52;
    const footerH = Math.max(frame.minTouch + 10, frame.isPortrait ? 56 : 52);
    const bodyTop = inset.top + headerH;
    const bodyBottom = height - inset.bottom - footerH;
    const bodyH = Math.max(120, bodyBottom - bodyTop);
    const hintH = stack ? 22 : 0;
    const tight = bodyH < 340;
    const cardH = tight
      ? Math.round(clamp(bodyH * 0.3, 88, 118))
      : stack
        ? Math.round(clamp(bodyH * 0.28, 120, 156))
        : 168;
    const cardsBottom = this.drawCards(inset.left, bodyTop, width - inset.left - inset.right, cardH, stack);
    const detailTop = cardsBottom + (this.cardScroll && stack ? hintH : 6);
    this.drawDetail(
      inset.left,
      detailTop,
      width - inset.left - inset.right,
      Math.max(80, bodyBottom - detailTop - 6),
      stack,
    );
    if (this.cardScroll && stack) {
      this.drawSwipeHint(width / 2, cardsBottom + 2);
    }

    const footerInner = width - inset.left - inset.right;
    const btnH = Math.max(40, Math.min(48, frame.minTouch));
    const backW = Math.round(clamp(footerInner * 0.36, 110, 140));
    const confirmW = Math.round(clamp(footerInner * 0.5, 140, 200));
    const btnY = height - inset.bottom - btnH / 2;
    new ActionButton(this, inset.left + backW / 2, btnY, {
      label: 'BACK',
      width: backW,
      height: btnH,
      compact: true,
      onPress: () => this.leaveTo('MainMenu'),
    });
    new ActionButton(this, width - inset.right - confirmW / 2, btnY, {
      label: 'CONFIRM',
      width: confirmW,
      height: Math.max(btnH, 48),
      primary: true,
      compact: true,
      onPress: () => this.confirm(),
    });

    this.input.keyboard?.on('keydown-ESC', () => this.leaveTo('MainMenu'));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.cardScroll?.wasDragged) {
        this.dismissSwipeHint();
      }
    });

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

  private drawCards(x: number, y: number, viewW: number, cardH: number, stack: boolean): number {
    const n = HERO_ORDER.length;
    const gap = 12;
    const peek = stack ? 28 : 0;
    const cardW = Math.round(clamp(viewW * (stack ? 0.4 : 0.36), 140, stack ? 168 : 188));
    const total = cardW * n + gap * (n - 1);
    const host = total <= viewW ? this.add.container(x, y) : null;
    if (total > viewW) {
      this.cardScroll = new ScrollPanel(this, x, y, viewW, cardH + 8, { axis: 'x' });
      this.cardScroll.setContentSize(total + peek, cardH + 8);
    }
    const artY = Math.round(cardH * 0.28);
    const nameY = Math.round(cardH * 0.51);
    const roleY = Math.round(cardH * 0.62);
    const ovrY = Math.round(cardH * 0.73);
    const pwrY = Math.round(cardH * 0.85);
    const artScale = cardH >= 140 ? 1.25 : cardH >= 110 ? 1.05 : 0.9;

    HERO_ORDER.forEach((id, index) => {
      const copy = heroSelectCopy(id);
      const cx = (total <= viewW ? (viewW - total) / 2 : 0) + cardW / 2 + index * (cardW + gap);
      const selected = this.selected === id;
      const panel = this.add.rectangle(cx, 0, cardW, cardH, COLORS.panel, 0.96).setOrigin(0.5, 0);
      panel.setStrokeStyle(3, selected ? COLORS.yellow : COLORS.cyan);
      const art = this.add.graphics();
      art.setPosition(cx, artY);
      art.setScale(artScale);
      PLAYABLE_HEROES[id].draw(art, { facing: 'east', team: 'alpha' });
      const name = this.add
        .text(cx, nameY, copy.name.toUpperCase(), {
          fontFamily: FONTS.display,
          fontSize: '13px',
          color: hex(COLORS.paper),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      const role = this.add
        .text(cx, roleY, copy.role.toUpperCase(), {
          fontFamily: FONTS.body,
          fontSize: copy.role.length > 12 ? '8px' : '10px',
          fontStyle: 'bold',
          color: hex(COLORS.cyan),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      const ovr = this.add
        .text(cx, ovrY, `OVR  ${copy.overall}`, {
          fontFamily: FONTS.display,
          fontSize: '14px',
          color: hex(COLORS.yellow),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      const pwr = this.add
        .text(cx, pwrY, `PWR  ${copy.power}`, {
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

    if (this.cardScroll) {
      const selectedIndex = Math.max(0, HERO_ORDER.indexOf(this.selected));
      const selectedX = cardW / 2 + selectedIndex * (cardW + gap);
      this.cardScroll.revealX(selectedX, cardW + gap, peek);
      this.drawCarouselFades(x, y, viewW, cardH + 8);
    }

    return y + cardH + 8;
  }

  private drawCarouselFades(x: number, y: number, viewW: number, viewH: number): void {
    const fadeW = 22;
    const left = this.add.graphics().setDepth(8);
    left.fillGradientStyle(COLORS.ink, COLORS.ink, COLORS.ink, COLORS.ink, 0.72, 0, 0.72, 0);
    left.fillRect(x, y, fadeW, viewH);
    const right = this.add.graphics().setDepth(8);
    right.fillGradientStyle(COLORS.ink, COLORS.ink, COLORS.ink, COLORS.ink, 0, 0.72, 0, 0.72);
    right.fillRect(x + viewW - fadeW, y, fadeW, viewH);
  }

  private drawSwipeHint(cx: number, y: number): void {
    if (carouselTouched) {
      return;
    }
    const root = this.add.container(cx, y).setDepth(12);
    const left = this.add
      .text(-108, 0, '←', {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: hex(COLORS.yellow),
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    const label = this.add
      .text(0, 1, 'SWIPE  FOR  MORE  FIGHTERS', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.yellow),
        letterSpacing: 1,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    const right = this.add
      .text(108, 0, '→', {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: hex(COLORS.yellow),
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    root.add([left, label, right]);
    this.tweens.add({
      targets: [left, right],
      alpha: { from: 0.45, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.InOut',
    });
    this.tweens.add({
      targets: left,
      x: '-=4',
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.InOut',
    });
    this.tweens.add({
      targets: right,
      x: '+=4',
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.InOut',
    });
    this.swipeHint = root;
  }

  private dismissSwipeHint(): void {
    carouselTouched = true;
    if (!this.swipeHint) {
      return;
    }
    this.tweens.add({
      targets: this.swipeHint,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        this.swipeHint?.destroy();
        this.swipeHint = undefined;
      },
    });
  }

  private drawDetail(x: number, y: number, boxW: number, boxH: number, stack: boolean): void {
    const copy = heroSelectCopy(this.selected);
    const box = this.add.rectangle(x, y, boxW, Math.max(48, boxH), COLORS.ink, 0.82).setOrigin(0, 0);
    box.setStrokeStyle(2, COLORS.cyan);
    this.detailScroll = new ScrollPanel(this, x + 8, y + 8, boxW - 16, Math.max(48, boxH - 16));
    const inner = this.detailScroll.content;
    const innerW = boxW - 32;
    const statsW = stack ? innerW : Math.min(320, Math.max(220, innerW * 0.38));
    const textW = stack ? innerW : innerW - statsW - 18;

    const title = this.add.text(0, 0, `${copy.name.toUpperCase()}  //  ${copy.role.toUpperCase()}`, {
      fontFamily: FONTS.display,
      fontSize: stack ? '14px' : '16px',
      color: hex(COLORS.paper),
      letterSpacing: 2,
      wordWrap: { width: innerW },
    });
    inner.add(title);

    const statsY = 26;
    const statsX = stack ? 0 : textW + 18;
    const statsH = this.drawStatBlock(inner, statsX, statsY, statsW, copy, stack);

    const sections: { heading: string; body: string; accent: number }[] = [
      { heading: 'OVERVIEW', body: copy.description, accent: COLORS.paper },
      { heading: 'LIGHT ATTACK', body: copy.light, accent: COLORS.orange },
      { heading: copy.ability1.name.toUpperCase(), body: copy.ability1.text, accent: COLORS.cyan },
      { heading: copy.ability2.name.toUpperCase(), body: copy.ability2.text, accent: COLORS.cyan },
      { heading: `ULTIMATE  //  ${copy.ultimate.name.toUpperCase()}`, body: copy.ultimate.text, accent: COLORS.yellow },
    ];
    let textBottom = stack ? statsY + statsH + 10 : 26;
    const textX = 0;
    sections.forEach((section) => {
      const heading = this.add.text(textX, textBottom, section.heading, {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      });
      inner.add(heading);
      textBottom += heading.height + 3;
      const body = this.add.text(textX, textBottom, section.body, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: hex(section.accent),
        wordWrap: { width: textW },
      });
      inner.add(body);
      textBottom += body.height + 12;
    });

    const contentH = Math.max(textBottom, stack ? textBottom : statsY + statsH);
    this.detailScroll.setContentSize(innerW, contentH + 12);
  }

  private drawStatBlock(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    copy: { ratings: Record<CoreStatId, number>; overall: number; power: number },
    compact: boolean,
  ): number {
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
        .text(compact ? x + 86 : x + width, y, formatRating(copy.overall), {
          fontFamily: FONTS.display,
          fontSize: compact ? '14px' : '16px',
          color: hex(COLORS.yellow),
        })
        .setOrigin(compact ? 0 : 1, 0),
    );
    const powerX = compact ? x + Math.round(width * 0.52) : x;
    const powerY = compact ? y : y + 20;
    add(
      this.add.text(powerX, powerY, 'POWER', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      }),
    );
    add(
      this.add
        .text(compact ? powerX + 78 : x + width, powerY, `${copy.power}`, {
          fontFamily: FONTS.display,
          fontSize: compact ? '14px' : '16px',
          color: hex(COLORS.orange),
        })
        .setOrigin(compact ? 0 : 1, 0),
    );

    const rowH = compact ? 14 : 16;
    const barsY = y + (compact ? 26 : 44);
    CORE_STAT_ORDER.forEach((stat, index) => {
      const rowY = barsY + index * rowH;
      const value = copy.ratings[stat];
      add(
        this.add.text(x, rowY, CORE_STAT_LABEL[stat].toUpperCase(), {
          fontFamily: FONTS.body,
          fontSize: compact ? '9px' : '11px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          letterSpacing: compact ? 0.4 : 1,
        }),
      );
      const barX = x + (compact ? 118 : 128);
      const barW = Math.max(52, width - (compact ? 158 : 178));
      const barY = rowY + 5;
      add(this.add.rectangle(barX, barY, barW, compact ? 7 : 8, COLORS.panel, 1).setOrigin(0, 0.5));
      const fill = Math.max(2, (value / RATING_CAP) * barW);
      const fillColor = value >= 70 ? COLORS.orange : value >= 50 ? COLORS.cyan : COLORS.muted;
      add(this.add.rectangle(barX, barY, fill, compact ? 7 : 8, fillColor, 1).setOrigin(0, 0.5));
      add(
        this.add
          .text(barX + barW + 6, rowY, formatRating(value), {
            fontFamily: FONTS.body,
            fontSize: '11px',
            fontStyle: 'bold',
            color: hex(COLORS.paper),
          })
          .setOrigin(0, 0),
      );
    });
    return barsY - y + CORE_STAT_ORDER.length * rowH + 4;
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
