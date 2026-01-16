// Main export file for giveawayManager
// Re-exports all public functions

// Data CRUD
export {
  addGiveaway,
  getGiveaway,
  updateGiveaway,
  removeGiveaway,
  getAllGiveaways,
  addParticipant
} from './data/crud';

// User data
export {
  getUserTriviaAttempts,
  incrementUserTriviaAttempts
} from './data/userData';

// Scheduling
export {
  scheduleGiveawayEnd,
  scheduleExistingGiveaways
} from './scheduling/scheduler';

// Ending
export {
  cancelGiveaway,
  processEndedGiveaway
} from './scheduling/ending';

// Helpers
export {
  formatDuration,
  parseDuration,
  getSessionIdFromCustomId
} from './utils/helpers';
