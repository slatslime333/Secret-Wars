import { ARENA } from '../config/arena';
import { CRATE } from '../config/crate';
import { HERO_VISUAL, PROP } from './scale';
import { generateBattlefield } from './generate';
import { pickObjectiveLocation } from '../match/objectives/pickLocation';
import { OBJECTIVE } from '../config/objective';
import { MapQuery } from './query';

export type CheckResult = { name: string; ok: boolean; detail: string };

const seeds = [1001, 1098, 2048, 3333, 7777, 9001, 4242, 1812];

export const runMapChecks = (): CheckResult[] => {
  const results: CheckResult[] = [];
  const growthW = ARENA.width / 2200;
  const growthH = ARENA.height / 1280;
  results.push({
    name: 'map size modestly larger',
    ok: growthW >= 1.14 && growthW <= 1.22 && growthH >= 1.14 && growthH <= 1.22,
    detail: `${ARENA.width}x${ARENA.height} (${growthW.toFixed(3)}x ${growthH.toFixed(3)}y)`,
  });

  results.push({
    name: 'crate scale vs hero',
    ok: PROP.crate.w > HERO_VISUAL.width && PROP.crate.w < HERO_VISUAL.width * 2.2 && PROP.truck.w > HERO_VISUAL.width * 4,
    detail: `crate ${PROP.crate.w} truck ${PROP.truck.w} hero ${HERO_VISUAL.width}`,
  });

  results.push({
    name: 'crate durability modest',
    ok: CRATE.maxHealth >= 30 && CRATE.maxHealth <= 70 && CRATE.xp < 18,
    detail: `hp=${CRATE.maxHealth} xp=${CRATE.xp}`,
  });

  let fallbacks = 0;
  let crateMin = 99;
  let crateMax = 0;
  let roadsOk = true;
  let objectivesOk = true;
  let compact = true;
  let blocked = false;
  for (const seed of seeds) {
    const result = generateBattlefield({ seed, log: false });
    if (result.usedFallback) {
      fallbacks += 1;
    }
    const crates = result.layout.obstacles.filter((obs) => obs.kind === 'crate');
    crateMin = Math.min(crateMin, crates.length);
    crateMax = Math.max(crateMax, crates.length);
    if (result.layout.roads.patches.length < 8) {
      roadsOk = false;
    }
    if (result.layout.obstacles.length > 64) {
      compact = false;
    }
    const query = new MapQuery(result.layout);
    const loc = pickObjectiveLocation(query, OBJECTIVE.piggy.radius, () => 0.4);
    if (!query.clearForObjective(loc.x, loc.y, OBJECTIVE.piggy.radius * 0.5)) {
      objectivesOk = false;
    }
    for (const zone of result.layout.reserved.filter((item) => item.kind === 'objective')) {
      const hit = result.layout.obstacles.some((obs) => {
        if (!obs.blocksMovement) {
          return false;
        }
        const cx = obs.collision.x + obs.collision.w / 2;
        const cy = obs.collision.y + obs.collision.h / 2;
        return (
          cx > zone.rect.x + 24 &&
          cy > zone.rect.y + 24 &&
          cx < zone.rect.x + zone.rect.w - 24 &&
          cy < zone.rect.y + zone.rect.h - 24
        );
      });
      if (hit) {
        blocked = true;
      }
    }
  }

  results.push({
    name: 'generation reliability',
    ok: fallbacks <= 2,
    detail: `fallbacks=${fallbacks}/${seeds.length}`,
  });
  results.push({
    name: 'roads generated',
    ok: roadsOk,
    detail: roadsOk ? 'street grid present' : 'missing pavement',
  });
  results.push({
    name: 'crates placed with structures',
    ok: crateMin >= 2 && crateMax <= 20,
    detail: `crates ${crateMin}-${crateMax}`,
  });
  results.push({
    name: 'objectives stay clear',
    ok: objectivesOk && !blocked,
    detail: `pickOk=${objectivesOk} reservedBlocked=${blocked}`,
  });
  results.push({
    name: 'still a compact 3v3 field',
    ok: compact && ARENA.width < 3200,
    detail: `maxObstaclesOk=${compact} width=${ARENA.width}`,
  });

  return results;
};
