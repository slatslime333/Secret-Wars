import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { PLAYABLE_HEROES, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { heroSelectCopy } from '../heroes/selectCopy';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';

const HERO_ORDER: HeroId[] = ['ninja', 'cole', 'death'];

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
      .text(width / 2, 16, 'CHOOSE YOUR FIGHTER', {
        fontFamily: FONTS.display,
        fontSize: '24px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 46, 'DRAFT MATCH  //  3:00  //  THREE LANES', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    this.drawCards(width);
    this.drawDetail(width, height);

    new ActionButton(this, 90, height - 34, {
      label: 'BACK',
      width: 140,
      height: 42,
      compact: true,
      onPress: () => this.leaveTo('MainMenu'),
    });
    new ActionButton(this, width - 120, height - 34, {
      label: 'CONFIRM',
      width: 200,
      height: 50,
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
    const cardW = Math.min(210, width * 0.26);
    const gap = 16;
    const total = cardW * 3 + gap * 2;
    const left = width / 2 - total / 2 + cardW / 2;
    HERO_ORDER.forEach((id, index) => {
      const copy = heroSelectCopy(id);
      const x = left + index * (cardW + gap);
      const y = 70;
      const selected = this.selected === id;
      const panel = this.add.rectangle(x, y, cardW, 168, COLORS.panel, 0.96).setOrigin(0.5, 0);
      panel.setStrokeStyle(3, selected ? COLORS.yellow : COLORS.cyan);
      const art = this.add.graphics();
      art.setPosition(x, y + 70);
      art.setScale(1.55);
      PLAYABLE_HEROES[id].draw(art, { facing: 'east', team: 'alpha' });
      this.add
        .text(x, y + 118, copy.name.toUpperCase(), {
          fontFamily: FONTS.display,
          fontSize: '15px',
          color: hex(COLORS.paper),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x, y + 138, copy.role.toUpperCase(), {
          fontFamily: FONTS.body,
          fontSize: '11px',
          fontStyle: 'bold',
          color: hex(COLORS.cyan),
          letterSpacing: 2,
        })
        .setOrigin(0.5, 0);
      const hit = this.add.rectangle(x, y + 84, cardW, 168, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => this.select(id));
      new ActionButton(this, x, y + 186, {
        label: selected ? 'SELECTED' : 'SELECT',
        width: cardW - 18,
        height: 34,
        compact: true,
        primary: selected,
        onPress: () => this.select(id),
      });
    });
  }

  private drawDetail(width: number, height: number): void {
    const copy = heroSelectCopy(this.selected);
    const top = 276;
    const boxH = Math.max(160, height - top - 78);
    const boxW = Math.min(820, width - 40);
    const box = this.add.rectangle(width / 2, top, boxW, boxH, COLORS.ink, 0.82).setOrigin(0.5, 0);
    box.setStrokeStyle(2, COLORS.cyan);
    const left = width / 2 - boxW / 2 + 18;
    this.add.text(left, top + 10, `${copy.name.toUpperCase()}  //  ${copy.role.toUpperCase()}`, {
      fontFamily: FONTS.display,
      fontSize: '16px',
      color: hex(COLORS.paper),
      letterSpacing: 2,
    });
    this.add.text(left, top + 34, copy.description, {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: hex(COLORS.paper),
      wordWrap: { width: boxW - 36 },
    });
    const lines = [
      `LIGHT  ${copy.light}`,
      `A1  ${copy.ability1.name} — ${copy.ability1.text}`,
      `A2  ${copy.ability2.name} — ${copy.ability2.text}`,
      `ULT  ${copy.ultimate.name} — ${copy.ultimate.text}`,
    ];
    lines.forEach((line, index) => {
      this.add.text(left, top + 58 + index * 20, line, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        fontStyle: 'bold',
        color: hex(index === 0 ? COLORS.orange : COLORS.cyan),
        wordWrap: { width: boxW - 36 },
      });
    });
    this.add
      .text(width / 2, height - 72, isTouchPrimary() ? 'TAP A FIGHTER, THEN CONFIRM' : '← → SELECT    ENTER CONFIRM', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);
  }

  private select(id: HeroId): void {
    if (this.leaving) {
      return;
    }
    this.selected = id;
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
