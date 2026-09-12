const KEY = 'secretWars.mapSeed';

const randomSeed = (): number => {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return buf[0] || 1;
  }
  return (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
};

export const peekPlayTestSeed = (): number | undefined => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return undefined;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value >>> 0 : undefined;
  } catch {
    return undefined;
  }
};

export const rememberPlayTestSeed = (seed: number): number => {
  const value = seed >>> 0 || 1;
  try {
    sessionStorage.setItem(KEY, String(value));
  } catch {
    /* ignore quota / private mode */
  }
  return value;
};

export const nextPlayTestSeed = (): number => rememberPlayTestSeed((peekPlayTestSeed() ?? randomSeed()) + 1);

export const prevPlayTestSeed = (): number =>
  rememberPlayTestSeed(Math.max(1, (peekPlayTestSeed() ?? randomSeed()) - 1));

export const randomPlayTestSeed = (): number => rememberPlayTestSeed(randomSeed());

export const resolvePlayTestSeed = (explicit?: number): number => {
  if (explicit !== undefined) {
    return rememberPlayTestSeed(explicit);
  }
  return peekPlayTestSeed() ?? rememberPlayTestSeed(randomSeed());
};

export const freshMatchSeed = (): number => randomSeed();
