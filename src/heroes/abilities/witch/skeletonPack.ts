import type { NinjaBody } from '../../NinjaBody';
import { WITCH_TOMBSTONE } from './tunables';

const packs = new WeakMap<NinjaBody, Set<NinjaBody>>();
const owners = new WeakMap<NinjaBody, NinjaBody>();

const packOf = (owner: NinjaBody): Set<NinjaBody> => {
  let pack = packs.get(owner);
  if (!pack) {
    pack = new Set();
    packs.set(owner, pack);
  }
  return pack;
};

const skeletonGone = (unit: NinjaBody): boolean =>
  unit.down || !unit.isPresent || !unit.sprite?.active;

export const livingWitchSkeletons = (owner: NinjaBody): NinjaBody[] => {
  const pack = packs.get(owner);
  if (!pack) {
    return [];
  }
  const living: NinjaBody[] = [];
  for (const unit of pack) {
    if (skeletonGone(unit)) {
      pack.delete(unit);
      continue;
    }
    living.push(unit);
  }
  return living;
};

export const witchSkeletonCount = (owner: NinjaBody): number => livingWitchSkeletons(owner).length;

export const witchSummonSlots = (owner: NinjaBody, want: number): number =>
  Math.max(0, Math.min(want, WITCH_TOMBSTONE.cap - witchSkeletonCount(owner)));

export const canSummonWitchSkeletons = (owner: NinjaBody, want = 1): boolean => witchSummonSlots(owner, want) > 0;

export const registerWitchSkeleton = (owner: NinjaBody, skeleton: NinjaBody): void => {
  packOf(owner).add(skeleton);
  owners.set(skeleton, owner);
};

export const unregisterWitchSkeleton = (skeleton: NinjaBody): void => {
  const owner = owners.get(skeleton);
  if (owner) {
    packs.get(owner)?.delete(skeleton);
    owners.delete(skeleton);
  }
};

export const ownerOfWitchSkeleton = (skeleton: NinjaBody): NinjaBody | undefined => owners.get(skeleton);

export const dismissWitchSkeletons = (owner: NinjaBody): void => {
  const pack = packs.get(owner);
  if (!pack) {
    return;
  }
  for (const unit of [...pack]) {
    if (!unit.down) {
      unit.health = 0;
    }
    owners.delete(unit);
  }
  pack.clear();
};
