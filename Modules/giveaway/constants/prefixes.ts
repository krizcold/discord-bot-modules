/**
 * Button and Modal Custom ID Prefixes for Giveaway System
 */

// =============================================================================
// MAIN PANEL (List View with Pagination)
// =============================================================================
export const MAIN_PANEL_ID = 'giveaway';
export const MAIN_CREATE_BTN = 'create';
export const MAIN_PREV_BTN = 'prev';
export const MAIN_NEXT_BTN = 'next';
export const MAIN_DROPDOWN = 'select';
export const MAIN_CLOSE_BTN = 'close';

// Page selector (direct handler for modal support)
export const GW_PAGE_BTN = 'gw_page'; // Page selector button (opens modal)
export const GW_PAGE_MODAL = 'gw_page_modal'; // Page selector modal

// List item view button (panel system handles navigation)
export const GW_VIEW_BTN_PREFIX = 'gw_view';

// =============================================================================
// CREATE PANEL (Sub-panel, uses pendingId in customId)
// =============================================================================
export const CREATE_PANEL_PREFIX = 'create';

// Create panel button actions
export const CREATE_BTN_TITLE = 'title';
export const CREATE_BTN_PRIZE = 'prize';
export const CREATE_BTN_DURATION = 'duration';
export const CREATE_BTN_WINNERS = 'winners';
export const CREATE_BTN_MODE = 'mode';
export const CREATE_BTN_SAVE = 'save';
export const CREATE_BTN_READY = 'ready';
export const CREATE_BTN_START = 'start';
export const CREATE_BTN_DELETE = 'delete';
export const CREATE_BTN_BACK = 'back';

// Mode selection dropdown
export const CREATE_MODE_DROPDOWN_PREFIX = 'gw_create_mode';

// Mode-specific buttons
export const CREATE_BTN_REACTION = 'reaction';
export const CREATE_BTN_TRIVIA_QA = 'trivia_qa';
export const CREATE_BTN_TRIVIA_ATTEMPTS = 'trivia_attempts';
export const CREATE_BTN_COMPETITION_LEADERBOARD = 'competition_leaderboard';

// =============================================================================
// CREATE PANEL MODALS (Direct handlers - bypass panel system for modal support)
// =============================================================================
export const GW_EDIT_BTN_PREFIX = 'gw_edit';
export const GW_MODAL_PREFIX = 'gw_modal';
export const GW_CHECK_PRIZE_BTN_PREFIX = 'gw_check_prize';

// Modal type identifiers
export const MODAL_TITLE = 'title';
export const MODAL_PRIZE = 'prize';
export const MODAL_DURATION = 'duration';
export const MODAL_WINNERS = 'winners';
export const MODAL_REACTION = 'reaction';
export const MODAL_TRIVIA_QA = 'trivia_qa';
export const MODAL_TRIVIA_ATTEMPTS = 'trivia_attempts';

// =============================================================================
// DETAIL PANEL (Viewing existing giveaway)
// =============================================================================
export const DETAIL_PANEL_PREFIX = 'detail';
export const DETAIL_BTN_BACK = 'back';
export const DETAIL_BTN_CANCEL = 'cancel';
export const DETAIL_BTN_FINISH = 'finish';
export const DETAIL_BTN_REMOVE = 'remove';
export const DETAIL_BTN_EDIT = 'edit';
export const DETAIL_BTN_VIEW_PRIZES = 'viewprizes';

// =============================================================================
// LIVE GIVEAWAY INTERACTIONS
// =============================================================================
// Button entry
export const GW_ENTER_BTN_PREFIX = 'gw_enter_btn';

// Trivia entry
export const GW_TRIVIA_ANSWER_BTN_PREFIX = 'gw_trivia_answer_btn';
export const GW_TRIVIA_ANSWER_MODAL_PREFIX = 'gw_trivia_answer_modal';

// Competition entry
export const GW_COMPETITION_ANSWER_BTN_PREFIX = 'gw_competition_answer_btn';
export const GW_COMPETITION_ANSWER_MODAL_PREFIX = 'gw_competition_answer_modal';

// Prize claim
export const GW_CLAIM_PRIZE_BTN_PREFIX = 'gw_claim_prize_btn';

// =============================================================================
// PRIZE MANAGER PANEL (Multi-prize system)
// =============================================================================
export const PRIZE_PANEL_PREFIX = 'prizes';
export const GW_PRIZE_EDIT_BTN_PREFIX = 'gw_prize_edit';
export const GW_PRIZE_NAV_PREFIX = 'gw_prize_nav';

// =============================================================================
// PRIZE RESULTS PANEL (View mode for active/ended giveaways)
// =============================================================================
export const GW_PRIZE_RESULTS_NAV_PREFIX = 'gw_prize_results_nav';
export const GW_PRIZE_RESULTS_BACK_PREFIX = 'gw_prize_results_back';
