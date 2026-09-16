import type { CrateHooks } from './EnvironmentWorld';
import { EnvironmentWorld } from './EnvironmentWorld';

/** @deprecated Use EnvironmentWorld. Kept so crate wiring stays one call site. */
export type { CrateHooks };
export { EnvironmentWorld as CrateWorld };
