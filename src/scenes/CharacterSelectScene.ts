import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { PLAYABLE_HEROES, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { ALL_HERO_SELECT_COPY, heroSelectCopy } from '../heroes/selectCopy';
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
      .text(width / 2, 22, 'CHOOSE YOUR FIGHTER', {
        fontFamily: FONTS.display,
        fontSize: '26px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 52, 'DRAFT MATCH  //  3:00  //  THREE LANES', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    this.drawCards(width, height);
    this.drawDetail(width, height);

    new ActionButton(this, 90, height - 36, {
      label: 'BACK',
      width: 140,
      height: 44,
      compact: true,
      onPress: () => this.leaveTo('MainMenu'),
    });
    new ActionButton(this, width - 120, height - 36, {
      label: 'CONFIRM',
      width: 200,
      height: 52,
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
        this.scene.restart();
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private drawCards(width: number, height: number): void {
    const cardW = Math.min(200, width * 0.28);
    const startX = width / 2 - cardW - 18;
    HERO_ORDER.forEach((id, index) => {
      const copy = heroSelectCopy(id);
      const x = startX + index * (cardW + 18);
      const y = height < 520 ? 118 : 132;
      const panel = this.add.rectangle(x, y, cardW, 118, COLORS.panel, 0.94).setOrigin(0.5, 0);
      panel.setStrokeStyle(3, this.selected === id ? COLORS.yellow : COLORS.cyan);
      const art = this.add.graphics();
      art.setPosition(x, y + 52);
      PLAYABLE_HEROES[id].draw(art, { facing: 'east', team: 'alpha' });
      this.add
        .text(x, y + 96, copy.name.toUpperCase(), {
          fontFamily: FONTS.display,
          fontSize: '14px',
          color: hex(COLORS.paper),
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0);
      const hit = this.add.rectangle(x, y + 59, cardW, 118, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => this.select(id));
      new ActionButton(this, x, y + 148, {
        label: this.selected === id ? 'SELECTED' : 'SELECT',
        width: cardW - 16,
        height: 36,
        compact: true,
        primary: this.selected === id,
        onPress: () => this.select(id),
      });
    });
  }

  private drawDetail(width: number, height: number): void {
    const copy = ALL_HERO_SELECT_COPY.find((item) => item.id === this.selected) ?? heroSelectCopy(this.selected);
    const y = height < 520 ? 300 : 318;
    const box = this.add.rectangle(width / 2, y, Math.min(760, width - 40), height - y - 70, COLORS.ink, 0.78);
    box.setStrokeStyle(2, COLORS.cyan);
    const left = box.x - box.width / 2 + 20;
    this.add.text(left, y - box.height / 2 + 12, `${copy.name.toUpperCase()}  //  ${copy.role.toUpperCase()}`, {
      fontFamily: FONTS.display,
      fontSize: '18px',
      color: hex(COLORS.paper),
      letterSpacing: 2,
    });
    this.add.text(left, y - box.height / 2 + 38, copy.description, {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: hex(COLORS.paper),
    });
    const lines = [
      `LIGHT  ${copy.light}`,
      `A1  ${copy.ability1.name} — ${copy.ability1.text}`,
      `A2  ${copy.ability2.name} — ${copy.ability2.text}`,
      `ULT  ${copy.ultimate.name} — ${copy.ultimate.text}`,
    ];
    lines.forEach((line, index) => {
      this.add.text(left, y - box.height / 2 + 66 + index * 22, line, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        fontStyle: 'bold',
        color: hex(index === 0 ? COLORS.orange : COLORS.cyan),
        wordWrap: { width: box.width - 36 },
      });
    });
    this.add
      .text(width / 2, height - 78, isTouchPrimary() ? 'TAP A FIGHTER, THEN CONFIRM' : '← → SELECT    ENTER CONFIRM', {
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
