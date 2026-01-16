/**
 * Custom ID Parser Functions for Giveaway System
 * These functions extract data from customIds
 */

import {
  MAIN_PANEL_ID,
  CREATE_PANEL_PREFIX,
  DETAIL_PANEL_PREFIX,
  GW_EDIT_BTN_PREFIX,
  GW_MODAL_PREFIX,
  GW_CHECK_PRIZE_BTN_PREFIX,
  GW_PRIZE_EDIT_BTN_PREFIX,
  GW_PRIZE_NAV_PREFIX,
  GW_PRIZE_RESULTS_NAV_PREFIX,
  GW_PRIZE_RESULTS_BACK_PREFIX,
} from './prefixes';

/**
 * Parse check prize button ID
 * Returns pendingId or null if invalid
 */
export function parseCheckPrizeButtonId(customId: string): string | null {
  if (!customId.startsWith(`${GW_CHECK_PRIZE_BTN_PREFIX}_`)) return null;
  return customId.slice(GW_CHECK_PRIZE_BTN_PREFIX.length + 1);
}

/**
 * Parse edit button ID
 * Format: gw_edit_{modalType}_{pendingId}
 * Returns { pendingId, modalType } or null if invalid
 */
export function parseEditButtonId(customId: string): { pendingId: string; modalType: string } | null {
  if (!customId.startsWith(`${GW_EDIT_BTN_PREFIX}_`)) return null;
  const rest = customId.slice(GW_EDIT_BTN_PREFIX.length + 1);
  // Format: {modalType}_{pendingId} where modalType can have underscores, UUID is 36 chars
  if (rest.length < 38) return null;
  const pendingId = rest.slice(-36);
  const modalType = rest.slice(0, rest.length - 37);
  if (!modalType) return null;
  return { pendingId, modalType };
}

/**
 * Parse modal customId
 * Format: gw_modal_{modalType}_{pendingId}
 * Returns { pendingId, modalType } or null if invalid
 */
export function parseGwModalId(customId: string): { pendingId: string; modalType: string } | null {
  if (!customId.startsWith(`${GW_MODAL_PREFIX}_`)) return null;
  const rest = customId.slice(GW_MODAL_PREFIX.length + 1);
  if (rest.length < 38) return null;
  const pendingId = rest.slice(-36);
  const modalType = rest.slice(0, rest.length - 37);
  if (!modalType) return null;
  return { pendingId, modalType };
}

/**
 * Parse a prize edit button customId
 * Format: gw_prize_edit_{pendingId}_{prizeIndex}
 * Returns { pendingId, prizeIndex } or null if invalid
 */
export function parsePrizeEditButtonId(customId: string): { pendingId: string; prizeIndex: number } | null {
  if (!customId.startsWith(`${GW_PRIZE_EDIT_BTN_PREFIX}_`)) return null;
  const rest = customId.slice(GW_PRIZE_EDIT_BTN_PREFIX.length + 1);
  // Format: {pendingId}_{prizeIndex} where pendingId is UUID (36 chars)
  if (rest.length < 38) return null;
  const pendingId = rest.slice(0, 36);
  const prizeIndex = parseInt(rest.slice(37), 10);
  if (isNaN(prizeIndex)) return null;
  return { pendingId, prizeIndex };
}

/**
 * Parse prize panel navigation button customId
 * Format: gw_prize_nav_{pendingId}_{direction}_{page}
 * Returns { pendingId, direction, page } or null if invalid
 */
export function parsePrizeNavButtonId(customId: string): { pendingId: string; direction: 'prev' | 'next'; page: number } | null {
  if (!customId.startsWith(`${GW_PRIZE_NAV_PREFIX}_`)) return null;
  const rest = customId.slice(GW_PRIZE_NAV_PREFIX.length + 1);
  // Format: {pendingId}_{direction}_{page}
  if (rest.length < 43) return null; // 36 (UUID) + 1 (_) + 4 (prev/next) + 1 (_) + 1 (page digit)
  const pendingId = rest.slice(0, 36);
  const remaining = rest.slice(37);
  const parts = remaining.split('_');
  if (parts.length < 2) return null;
  const direction = parts[0] as 'prev' | 'next';
  if (direction !== 'prev' && direction !== 'next') return null;
  const page = parseInt(parts[1], 10);
  if (isNaN(page)) return null;
  return { pendingId, direction, page };
}

/**
 * Parse Prize Results navigation button customId
 * Format: gw_prize_results_nav_{giveawayId}_{direction}_{page}
 * Returns { giveawayId, direction, page } or null if invalid
 */
export function parsePrizeResultsNavButtonId(customId: string): { giveawayId: string; direction: 'prev' | 'next'; page: number } | null {
  if (!customId.startsWith(`${GW_PRIZE_RESULTS_NAV_PREFIX}_`)) return null;
  const rest = customId.slice(GW_PRIZE_RESULTS_NAV_PREFIX.length + 1);
  // Format: {giveawayId}_{direction}_{page}
  if (rest.length < 43) return null;
  const giveawayId = rest.slice(0, 36);
  const remaining = rest.slice(37);
  const parts = remaining.split('_');
  if (parts.length < 2) return null;
  const direction = parts[0] as 'prev' | 'next';
  if (direction !== 'prev' && direction !== 'next') return null;
  const page = parseInt(parts[1], 10);
  if (isNaN(page)) return null;
  return { giveawayId, direction, page };
}

/**
 * Parse Prize Results back button customId
 * Format: gw_prize_results_back_{giveawayId}_{returnPage}
 * Returns { giveawayId, returnPage } or null if invalid
 */
export function parsePrizeResultsBackButtonId(customId: string): { giveawayId: string; returnPage: number } | null {
  if (!customId.startsWith(`${GW_PRIZE_RESULTS_BACK_PREFIX}_`)) return null;
  const rest = customId.slice(GW_PRIZE_RESULTS_BACK_PREFIX.length + 1);
  if (rest.length < 38) return null;
  const giveawayId = rest.slice(0, 36);
  const returnPage = parseInt(rest.slice(37), 10);
  if (isNaN(returnPage)) return null;
  return { giveawayId, returnPage };
}

/**
 * Parse a create panel button customId
 * Format: panel_giveaway_btn_create_{pendingId}_{action}
 * Returns { pendingId, action } or null if invalid
 */
export function parseCreateButtonId(customId: string): { pendingId: string; action: string } | null {
  const prefix = `panel_${MAIN_PANEL_ID}_btn_${CREATE_PANEL_PREFIX}_`;
  if (!customId.startsWith(prefix)) return null;

  const rest = customId.slice(prefix.length);
  // UUID is always 36 characters (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  // Format is: {uuid}_{action} where action can contain underscores (e.g., trivia_qa)
  if (rest.length < 38) return null; // 36 (UUID) + 1 (underscore) + at least 1 char

  const pendingId = rest.slice(0, 36);
  const action = rest.slice(37); // Skip the underscore after UUID

  if (!action) return null;
  return { pendingId, action };
}

/**
 * Parse a create panel modal customId
 * Format: panel_giveaway_modal_{modalType}_{pendingId}
 * Returns { pendingId, modalType } or null if invalid
 */
export function parseCreateModalId(customId: string): { pendingId: string; modalType: string } | null {
  const prefix = `panel_${MAIN_PANEL_ID}_modal_`;
  if (!customId.startsWith(prefix)) return null;

  const rest = customId.slice(prefix.length);
  // Format: {modalType}_{pendingId} where modalType can contain underscores (e.g., trivia_qa)
  // UUID is always 36 characters at the end
  if (rest.length < 38) return null; // at least 1 char + underscore + 36 (UUID)

  const pendingId = rest.slice(-36); // Last 36 characters is the UUID
  const modalType = rest.slice(0, rest.length - 37); // Everything before underscore and UUID

  if (!modalType) return null;
  return { pendingId, modalType };
}

/**
 * Parse a detail panel button customId
 * Format: panel_giveaway_btn_detail_{giveawayId}_{action}_{page?}
 * Returns { giveawayId, action, page? } or null if invalid
 */
export function parseDetailButtonId(customId: string): { giveawayId: string; action: string; page?: number } | null {
  const prefix = `panel_${MAIN_PANEL_ID}_btn_${DETAIL_PANEL_PREFIX}_`;
  if (!customId.startsWith(prefix)) return null;

  const rest = customId.slice(prefix.length);
  const parts = rest.split('_');

  if (parts.length < 2) return null;

  // giveawayId is UUID (contains hyphens), action is after it
  // Format: {uuid}_{action} or {uuid}_{action}_{page}
  const giveawayId = parts[0];
  const action = parts[1];
  const page = parts.length > 2 ? parseInt(parts[2], 10) : undefined;

  return { giveawayId, action, page: isNaN(page as number) ? undefined : page };
}

/**
 * Parse main panel pagination button customId
 * Format: panel_giveaway_btn_{prev|next}_{page}
 * Returns { direction, page } or null if invalid
 */
export function parsePaginationButtonId(customId: string): { direction: 'prev' | 'next'; page: number } | null {
  const prevPrefix = `panel_${MAIN_PANEL_ID}_btn_prev_`;
  const nextPrefix = `panel_${MAIN_PANEL_ID}_btn_next_`;

  if (customId.startsWith(prevPrefix)) {
    const page = parseInt(customId.slice(prevPrefix.length), 10);
    return isNaN(page) ? null : { direction: 'prev', page };
  }

  if (customId.startsWith(nextPrefix)) {
    const page = parseInt(customId.slice(nextPrefix.length), 10);
    return isNaN(page) ? null : { direction: 'next', page };
  }

  return null;
}

