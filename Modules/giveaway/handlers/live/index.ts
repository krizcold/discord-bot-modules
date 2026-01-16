/**
 * Live Giveaway Handlers Module Exports
 *
 * Each entry mode has its own handler file for modularity.
 */

// Shared validation utilities
export {
  validateGiveawayEntry,
  replyWithError,
  getPlacementText,
  getPlacementEmoji,
} from './validation';

// Button Entry (entryMode: 'button')
export { handleGiveawayEnterButton } from './enter';

// Trivia Entry (entryMode: 'trivia')
export { handleTriviaAnswerButton, handleTriviaAnswerModalSubmit } from './trivia';

// Competition Entry (entryMode: 'competition')
export { handleCompetitionAnswerButton, handleCompetitionAnswerModalSubmit } from './competition';

// Prize Claim (all modes)
export { handleClaimPrizeButton } from './claim';
