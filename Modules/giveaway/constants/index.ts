/**
 * Giveaway Constants Module
 * Re-exports all constants for backward compatibility
 */

// Prefixes (button IDs, modal IDs, panel prefixes)
export {
  // Main Panel
  MAIN_PANEL_ID,
  MAIN_CREATE_BTN,
  MAIN_PREV_BTN,
  MAIN_NEXT_BTN,
  MAIN_DROPDOWN,
  MAIN_CLOSE_BTN,
  GW_PAGE_BTN,
  GW_PAGE_MODAL,
  GW_VIEW_BTN_PREFIX,

  // Create Panel
  CREATE_PANEL_PREFIX,
  CREATE_BTN_TITLE,
  CREATE_BTN_PRIZE,
  CREATE_BTN_DURATION,
  CREATE_BTN_WINNERS,
  CREATE_BTN_MODE,
  CREATE_BTN_SAVE,
  CREATE_BTN_READY,
  CREATE_BTN_START,
  CREATE_BTN_DELETE,
  CREATE_BTN_BACK,
  CREATE_MODE_DROPDOWN_PREFIX,
  CREATE_BTN_REACTION,
  CREATE_BTN_TRIVIA_QA,
  CREATE_BTN_TRIVIA_ATTEMPTS,
  CREATE_BTN_COMPETITION_LEADERBOARD,

  // Create Panel Modals
  GW_EDIT_BTN_PREFIX,
  GW_MODAL_PREFIX,
  GW_CHECK_PRIZE_BTN_PREFIX,
  MODAL_TITLE,
  MODAL_PRIZE,
  MODAL_DURATION,
  MODAL_WINNERS,
  MODAL_REACTION,
  MODAL_TRIVIA_QA,
  MODAL_TRIVIA_ATTEMPTS,

  // Detail Panel
  DETAIL_PANEL_PREFIX,
  DETAIL_BTN_BACK,
  DETAIL_BTN_CANCEL,
  DETAIL_BTN_FINISH,
  DETAIL_BTN_REMOVE,
  DETAIL_BTN_EDIT,
  DETAIL_BTN_VIEW_PRIZES,

  // Live Giveaway
  GW_ENTER_BTN_PREFIX,
  GW_TRIVIA_ANSWER_BTN_PREFIX,
  GW_TRIVIA_ANSWER_MODAL_PREFIX,
  GW_COMPETITION_ANSWER_BTN_PREFIX,
  GW_COMPETITION_ANSWER_MODAL_PREFIX,
  GW_CLAIM_PRIZE_BTN_PREFIX,

  // Prize Manager
  PRIZE_PANEL_PREFIX,
  GW_PRIZE_EDIT_BTN_PREFIX,
  GW_PRIZE_NAV_PREFIX,

  // Prize Results
  GW_PRIZE_RESULTS_NAV_PREFIX,
  GW_PRIZE_RESULTS_BACK_PREFIX,
} from './prefixes';

// Builder functions
export {
  buildEditButtonId,
  buildCheckPrizeButtonId,
  buildGwModalId,
  buildPrizeEditButtonId,
  buildPrizeNavButtonId,
  buildPrizeResultsNavButtonId,
  buildPrizeResultsBackButtonId,
  buildCreateButtonId,
  buildCreateModalId,
  buildDetailButtonId,
  buildPaginationButtonId,
  buildMainDropdownId,
} from './builders';

// Parser functions
export {
  parseCheckPrizeButtonId,
  parseEditButtonId,
  parseGwModalId,
  parsePrizeEditButtonId,
  parsePrizeNavButtonId,
  parsePrizeResultsNavButtonId,
  parsePrizeResultsBackButtonId,
  parseCreateButtonId,
  parseCreateModalId,
  parseDetailButtonId,
  parsePaginationButtonId,
} from './parsers';

// Configuration
export {
  ITEMS_PER_PAGE,
  MAX_ITEMS_PER_PAGE,
  PRIZES_PER_PAGE,
  STATUS_EMOJI,
} from './config';

export type { GiveawayStatus } from './config';
