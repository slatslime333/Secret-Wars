import { generateBattlefield } from './generate';

/** Headless sample used while tuning generation rules. */
export const sampleMaps = (count = 40): void => {
  let fallbacks = 0;
  let qualitySum = 0;
  let min = 100;
  let max = 0;
  for (let i = 0; i < count; i += 1) {
    const seed = (1000 + i * 97) >>> 0;
    const result = generateBattlefield({ seed, log: false });
    qualitySum += result.layout.quality.total;
    min = Math.min(min, result.layout.quality.total);
    max = Math.max(max, result.layout.quality.total);
    if (result.usedFallback) {
      fallbacks += 1;
    }
    console.info(
      `seed ${result.seed} q=${result.layout.quality.total} attempt=${result.attempt} obstacles=${result.layout.obstacles.length}${result.usedFallback ? ' FALLBACK' : ''}`,
    );
  }
  console.info(`sampled ${count} maps  avg=${Math.round(qualitySum / count)} min=${min} max=${max} fallbacks=${fallbacks}`);
};

