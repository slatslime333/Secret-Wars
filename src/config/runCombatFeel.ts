import { ComboTracker } from '../combat/ComboTracker';
import { attackCycleMs, attackStartupMs, hitStopFor } from './combat';
import { COLE } from './cole';
import { DEATH } from './death';
import { DEMON, DEMON_BIG } from './demon';
import { MENDER } from './mender';
import { NINJA } from './ninja';
import { ROPE } from './rope';
import { SHADOW } from './shadow';
import { WITCH } from './witch';
import type { HeroCombatConfig } from './hero';

const cycle = (hero: HeroCombatConfig, step: 1 | 2 | 3, hold: boolean, big = false): number =>
  attackCycleMs(hero.attackCooldownMs, {
    heroId: hero.id,
    bigDemon: big,
    step,
    holdRepeat: hold,
  });

const expectRange = (name: string, value: number, min: number, max: number): void => {
  if (value < min || value > max) {
    throw new Error(`${name} ${value}ms is outside ${min}–${max}`);
  }
};

const ninjaTap = cycle(NINJA, 1, false);
const ninjaHold = cycle(NINJA, 1, true);
const ninjaFinish = cycle(NINJA, 3, false);
const coleTap = cycle(COLE, 1, false);
const deathTap = cycle(DEATH, 1, false);
const menderTap = cycle(MENDER, 1, false);
const witchTap = cycle(WITCH, 1, false);
const shadowTap = cycle(SHADOW, 1, false);
const ropeTap = cycle(ROPE, 1, false);
const littleTap = cycle(DEMON, 1, false);
const bigTap = cycle(DEMON_BIG, 1, false, true);

expectRange('ninja hold', ninjaHold, 250, 320);
expectRange('ninja tap', ninjaTap, 270, 340);
expectRange('ninja finisher', ninjaFinish, 340, 460);
expectRange('cole tap', coleTap, 400, 500);
expectRange('death tap', deathTap, 270, 340);
expectRange('mender tap', menderTap, 190, 260);
expectRange('witch tap', witchTap, 400, 520);
expectRange('shadow tap', shadowTap, 400, 520);
expectRange('rope tap', ropeTap, 300, 390);
expectRange('little demon', littleTap, 340, 440);
expectRange('big demon', bigTap, 300, 420);

if (!(ninjaHold < ninjaTap && ninjaTap < ninjaFinish)) {
  throw new Error('ninja combo should get slower as it finishes');
}
if (!(ninjaTap < coleTap && deathTap < coleTap && menderTap < coleTap)) {
  throw new Error('fast kits should swing sooner than Cole');
}
if (!(bigTap < littleTap)) {
  throw new Error('big demon should swing faster than little demon');
}
if (!(attackStartupMs(1, 'ninja') < attackStartupMs(1, 'cole'))) {
  throw new Error('Cole should wind up longer than Ninja');
}
if (!(hitStopFor(1, 'death') > hitStopFor(1, 'ninja') && hitStopFor(3, 'ninja') > hitStopFor(1, 'ninja'))) {
  throw new Error('hit-stop should follow the weight hierarchy');
}

const chain = new ComboTracker();
const first = chain.tap(0, 860);
const second = chain.tap(300, 860);
const finisher = chain.tap(600, 860);
if (first !== 1 || second !== 2 || finisher !== 3) {
  throw new Error(`tap chain should reach finisher, got ${first}/${second}/${finisher}`);
}
const restarted = chain.tap(900, 860);
if (restarted !== 1) {
  throw new Error(`fourth tap should restart, got ${restarted}`);
}
chain.drop();
const afterHold = chain.step;
if (afterHold !== 0) {
  throw new Error('hold repeat should clear the combo indicator');
}

console.log(
  [
    `ninja hold ${ninjaHold} tap ${ninjaTap} fin ${ninjaFinish}`,
    `cole ${coleTap} death ${deathTap} shadow ${shadowTap} witch ${witchTap}`,
    `rope ${ropeTap} mender ${menderTap} demon ${littleTap}/${bigTap}`,
  ].join('\n'),
);
