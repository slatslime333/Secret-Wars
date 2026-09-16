import { ARENA } from '../config/arena';
import { CRATE } from '../config/crate';
import { MAP } from './config';
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
    name: 'trees taller than heroes',
    ok: PROP.treeSmall.vh >= 140 && PROP.treeSmall.vh > HERO_VISUAL.height,
    detail: `tree ${PROP.treeSmall.vh} heroArt ${HERO_VISUAL.height}`,
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
  let barrelMax = 0;
  let enterableMin = 99;
  let enterableMax = 0;
  let wallsLive = false;
  let treesLive = false;
  let roadsOk = true;
  let objectivesOk = true;
  let compact = true;
  let blocked = false;
  let landmarksNearMid = 0;
  let interiorsOk = true;
  let lampsOk = true;
  let dualDoors = true;
  let roadsClean = true;
  let treesPlenty = true;
  for (const seed of seeds) {
    const result = generateBattlefield({ seed, log: false });
    if (result.usedFallback) {
      fallbacks += 1;
    }
    const crates = result.layout.obstacles.filter((obs) => obs.kind === 'crate');
    crateMin = Math.min(crateMin, crates.length);
    crateMax = Math.max(crateMax, crates.length);
    const barrels = result.layout.obstacles.filter((obs) => obs.kind === 'barrel');
    barrelMax = Math.max(barrelMax, barrels.length);
    const enterable = result.layout.obstacles.filter((obs) => obs.enterable);
    enterableMin = Math.min(enterableMin, enterable.length);
    enterableMax = Math.max(enterableMax, enterable.length);
    if (enterable.some((obs) => !obs.interior || obs.visual.w < 240 || obs.visual.h < 200)) {
      interiorsOk = false;
    }
    if (
      enterable.some((home) => {
        const walls = result.layout.obstacles.filter(
          (obs) => obs.kind === 'wall' && obs.id.startsWith(`${home.id}-`),
        );
        return walls.length < 6;
      })
    ) {
      dualDoors = false;
    }
    wallsLive = wallsLive || result.layout.obstacles.some((obs) => obs.kind === 'wall' && obs.destructible);
    treesLive = treesLive || result.layout.obstacles.some((obs) => obs.kind === 'tree' && obs.physicsClass === 'lightweight');
    const lamps = result.layout.obstacles.filter((obs) => obs.kind === 'lamp');
    if (lamps.length < 4) {
      lampsOk = false;
    }
    const trees = result.layout.obstacles.filter((obs) => obs.kind === 'tree');
    if (trees.length < 6) {
      treesPlenty = false;
    }
    if (result.layout.roads.patches.length < 8) {
      roadsOk = false;
    }
    if (result.layout.roads.marks.length > 0 || result.layout.roads.patches.some((patch) => patch.damage !== 'worn')) {
      roadsClean = false;
    }
    if (result.layout.obstacles.length > MAP.maxObstacles) {
      compact = false;
    }
    const midLandmarks = result.layout.obstacles.filter((obs) => {
      if (obs.hierarchy !== 'landmark' && obs.kind !== 'vehicle' && obs.kind !== 'building') {
        return false;
      }
      return Math.abs(obs.x - ARENA.width / 2) < 520 && Math.abs(obs.y - ARENA.height / 2) < 320;
    }).length;
    landmarksNearMid = Math.max(landmarksNearMid, midLandmarks);
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
    ok: crateMin >= 2 && crateMax <= 24,
    detail: `crates ${crateMin}-${crateMax}`,
  });
  results.push({
    name: 'sparse explosive barrels',
    ok: barrelMax >= 1 && barrelMax <= 4,
    detail: `barrels<=${barrelMax}`,
  });
  results.push({
    name: 'few enterable edge buildings',
    ok: enterableMax >= 1 && enterableMax <= 3 && enterableMin >= 0,
    detail: `enterable ${enterableMin}-${enterableMax}`,
  });
  results.push({
    name: 'enterable buildings have interiors',
    ok: interiorsOk,
    detail: interiorsOk ? 'front+back doors + interior' : 'missing interior',
  });
  results.push({
    name: 'enterable homes have two doors',
    ok: dualDoors,
    detail: dualDoors ? 'front and back wall gaps' : 'missing door walls',
  });
  results.push({
    name: 'light posts throughout',
    ok: lampsOk,
    detail: lampsOk ? 'street lamps planted' : 'too few lamps',
  });
  results.push({
    name: 'trees and fences fill the streets',
    ok: treesPlenty,
    detail: treesPlenty ? 'tree coverage' : 'too few trees',
  });
  results.push({
    name: 'roads start clean',
    ok: roadsClean,
    detail: roadsClean ? 'worn pavement, no baked scars' : 'pre-damaged roads',
  });
  results.push({
    name: 'walls and trees can break',
    ok: wallsLive && treesLive,
    detail: `walls=${wallsLive} trees=${treesLive}`,
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
  results.push({
    name: 'landmarks visible from midfield',
    ok: landmarksNearMid >= 2,
    detail: `nearMidLandmarks=${landmarksNearMid}`,
  });

  return results;
};
