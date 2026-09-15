export { ObjectiveManager } from './ObjectiveManager';
export { objectiveHintFor, objectiveWorld, setObjectiveWorld } from './board';
export { tickCapture, emptyCapture } from './captureLogic';
export {
  canStartObjective,
  nextObjectiveKind,
  pickFairObjectiveKind,
  pickObjectiveKind,
  pickObjectiveStartAt,
  OBJECTIVE,
} from '../../config/objective';
export type { MatchObjective, ObjectiveHint, ObjectiveUiState } from './types';
