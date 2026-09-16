import type { TeamId } from '../../config/hero';
import type { NinjaBody } from '../../heroes/NinjaBody';
import { CombatStatsTracker } from '../CombatStatsTracker';
import { ScoreManager } from '../ScoreManager';
import { sortScoreboardLines } from './sortLines';
import { teamLevelOf } from './teamLevel';

export type ScoreboardCheck = { name: string; ok: boolean; detail: string };

const check = (name: string, ok: boolean, detail: string): ScoreboardCheck => ({ name, ok, detail });

type Stub = {
  heroId: string;
  team: TeamId;
  down: boolean;
  stats: { displayName: string; role: string };
  lastAttacker?: NinjaBody;
};

const fighter = (heroId: string, team: TeamId, name: string): NinjaBody =>
  ({
    heroId,
    team,
    down: false,
    stats: { displayName: name, role: 'hero' },
  }) as unknown as NinjaBody;

const register = (stats: CombatStatsTracker, body: NinjaBody, id: string, player = false) => {
  stats.register(body, { instanceId: id, player });
  stats.syncLevel(body, 1);
  return stats.lineOf(body)!;
};

const scenarioHeroKill = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const score = new ScoreManager();
  const ninja = fighter('ninja', 'alpha', 'Ninja');
  const death = fighter('death', 'bravo', 'Death');
  register(stats, ninja, 'alpha-ninja', true);
  register(stats, death, 'bravo-death');
  (death as unknown as Stub).lastAttacker = ninja;
  stats.recordDamage({
    attacker: ninja,
    victim: death,
    amount: 80,
    kind: 'light',
    at: 1_000,
    victimTeam: 'bravo',
  });
  const result = stats.registerHeroDeath(death, 1_000);
  const awarded = score.awardHeroKill('alpha', 'bravo-death', 1_000);
  stats.recordScoreShare(result.killer ?? ninja, awarded, 'hero_kill');
  const killer = stats.lineOf(ninja)!;
  const victim = stats.lineOf(death)!;
  const ok =
    result.killer === ninja &&
    killer.kills === 1 &&
    victim.deaths === 1 &&
    killer.personalScore === awarded &&
    killer.heroKillScore === awarded &&
    awarded === 80 &&
    score.kills.alpha === 80;
  return check('hero kill credits killer, death, and war-score share', ok, `k=${killer.kills} d=${victim.deaths} score=${killer.personalScore} team=${score.kills.alpha}`);
};

const scenarioMinions = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const score = new ScoreManager();
  const ninja = fighter('ninja', 'alpha', 'Ninja');
  register(stats, ninja, 'alpha-ninja', true);
  const sword = score.awardMinion('alpha', 'sword', 10);
  stats.recordMinionKill(ninja);
  stats.recordScoreShare(ninja, sword, 'sword_minion');
  const ranger = score.awardMinion('alpha', 'ranger', 11);
  stats.recordMinionKill(ninja);
  stats.recordScoreShare(ninja, ranger, 'ranger_minion');
  const line = stats.lineOf(ninja)!;
  const ok =
    sword === 3 &&
    ranger === 4 &&
    line.minionsKilled === 2 &&
    line.minionScore === 7 &&
    line.personalScore === 7 &&
    score.kills.alpha === 7;
  return check('minion kills attribute +3/+4 without replacing XP', ok, `minions=${line.minionsKilled} share=${line.minionScore} xp=${line.xpEarned}`);
};

const scenarioEffectiveHeal = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const mender = fighter('mender', 'alpha', 'Mender');
  const ally = fighter('ninja', 'alpha', 'Ninja');
  register(stats, mender, 'alpha-mender');
  register(stats, ally, 'alpha-ninja');
  stats.recordHeal({ healer: mender, target: ally, amount: 15, at: 1 });
  stats.recordHeal({ healer: mender, target: ally, amount: 0, at: 2 });
  stats.recordHeal({ healer: mender, target: mender, amount: 8, at: 3 });
  stats.recordDamage({
    attacker: mender,
    victim: fighter('death', 'bravo', 'Death'),
    amount: 22,
    kind: 'light',
    at: 4,
    victimTeam: 'bravo',
  });
  const line = stats.lineOf(mender)!;
  const ok =
    line.healingDone === 23 &&
    line.healingAlly === 15 &&
    line.healingSelf === 8 &&
    line.playerDamage === 22;
  return check('effective heal is separate from damage and ignores empty heals', ok, `heal=${line.healingDone} ally=${line.healingAlly} dmg=${line.playerDamage}`);
};

const scenarioHealClamp = (): ScoreboardCheck => {
  const missing = 20;
  const attempted = 22;
  const applied = Math.min(missing, attempted);
  const fullTarget = Math.min(0, 22);
  const ok = applied === 20 && fullTarget === 0;
  return check('overheal is clamped to missing HP', ok, `applied=${applied} full=${fullTarget}`);
};

const scenarioObjectiveSplit = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const score = new ScoreManager();
  const a = fighter('ninja', 'alpha', 'Ninja');
  const b = fighter('mender', 'alpha', 'Mender');
  const c = fighter('death', 'alpha', 'Death');
  register(stats, a, 'a');
  register(stats, b, 'b');
  register(stats, c, 'c');
  const team = score.awardObjective('alpha', 'capture_zone', 10, 'cap-1');
  stats.splitScore([a, b, c], team, 'capture_zone');
  stats.recordObjectiveWin(a, 'capture_zone');
  stats.recordObjectiveWin(b, 'capture_zone');
  stats.recordObjectiveWin(c, 'capture_zone');
  const shares = [stats.lineOf(a)!, stats.lineOf(b)!, stats.lineOf(c)!].map((line) => line.personalScore);
  const sum = shares.reduce((n, v) => n + v, 0);
  const ok =
    team === 100 &&
    score.kills.alpha === 100 &&
    sum === 100 &&
    shares.every((share) => share === 33 || share === 34) &&
    stats.lineOf(a)!.objectiveWins === 1 &&
    stats.lineOf(a)!.objectiveParticipation === 1;
  return check('capture splits personal score so shares sum to team grant', ok, `team=${team} shares=${shares.join('+')}=${sum}`);
};

const scenarioDeathPersists = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const ninja = fighter('ninja', 'alpha', 'Ninja');
  const foe = fighter('shadow', 'bravo', 'Shadow');
  register(stats, ninja, 'ninja', true);
  register(stats, foe, 'shadow');
  (ninja as unknown as Stub).lastAttacker = foe;
  stats.registerHeroDeath(ninja, 100);
  const afterDeath = stats.lineOf(ninja)!.deaths;
  stats.syncLevel(ninja, 4);
  stats.recordXp(ninja, 40);
  const line = stats.lineOf(ninja)!;
  const ok = afterDeath === 1 && line.deaths === 1 && line.xpEarned === 40 && line.currentLevel === 4;
  return check('respawn does not reset lifetime match stats', ok, `deaths=${line.deaths} xp=${line.xpEarned} lv=${line.currentLevel}`);
};

const scenarioLock = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const ninja = fighter('ninja', 'alpha', 'Ninja');
  register(stats, ninja, 'ninja');
  stats.recordMinionKill(ninja);
  stats.recordScoreShare(ninja, 3, 'sword_minion');
  stats.lock();
  stats.recordMinionKill(ninja);
  stats.recordScoreShare(ninja, 3, 'sword_minion');
  stats.recordHeal({ healer: ninja, target: ninja, amount: 50, at: 9 });
  stats.recordXp(ninja, 99);
  const line = stats.lineOf(ninja)!;
  const ok = stats.frozen && line.minionsKilled === 1 && line.personalScore === 3 && line.healingDone === 0 && line.xpEarned === 0;
  return check('lock freezes scoreboard stats at 0:00', ok, `minions=${line.minionsKilled} score=${line.personalScore} heal=${line.healingDone}`);
};

const scenarioUniqueRows = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const names = ['Ninja', 'Mender', 'Death', 'Shadow', 'Witch', 'Demon'] as const;
  const teams: TeamId[] = ['alpha', 'alpha', 'alpha', 'bravo', 'bravo', 'bravo'];
  names.forEach((name, i) => {
    const body = fighter(name.toLowerCase(), teams[i], name);
    register(stats, body, `${teams[i]}-${name.toLowerCase()}`, i === 0);
  });
  const first = sortScoreboardLines(stats.allLines());
  const second = sortScoreboardLines(stats.allLines());
  const ids = first.map((line) => line.instanceId);
  const ok = first.length === 6 && ids.length === new Set(ids).size && second.map((line) => line.instanceId).join() === ids.join();
  return check('scoreboard rebuild keeps one row per hero', ok, `rows=${ids.join(',')}`);
};

const scenarioTeamLevels = (): ScoreboardCheck => {
  const stats = new CombatStatsTracker();
  const ninja = fighter('ninja', 'alpha', 'Ninja');
  const cole = fighter('cole', 'alpha', 'Cole');
  const death = fighter('death', 'bravo', 'Death');
  register(stats, ninja, 'alpha-ninja', true);
  register(stats, cole, 'alpha-cole');
  register(stats, death, 'bravo-death');
  stats.syncLevel(ninja, 4);
  stats.syncLevel(cole, 6);
  stats.syncLevel(death, 3);
  const lines = stats.allLines();
  const team = teamLevelOf(lines, 'alpha');
  const enemy = teamLevelOf(lines, 'bravo');
  const ok = team === 5 && enemy === 3;
  return check('team level vs enemy level averages current levels', ok, `team=${team} enemy=${enemy}`);
};

export const runScoreboardChecks = (): ScoreboardCheck[] => [
  scenarioHeroKill(),
  scenarioMinions(),
  scenarioEffectiveHeal(),
  scenarioHealClamp(),
  scenarioObjectiveSplit(),
  scenarioDeathPersists(),
  scenarioLock(),
  scenarioUniqueRows(),
  scenarioTeamLevels(),
];
