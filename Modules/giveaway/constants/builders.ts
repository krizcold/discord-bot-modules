/**
 * Custom ID Builder Functions for Giveaway System
 * These functions construct customIds for buttons, modals, and dropdowns
 */

import {
  MAIN_PANEL_ID,
  MAIN_DROPDOWN,
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
 * Build a direct edit button ID (bypasses panel system to allow modals)
 * Format: gw_edit_{modalType}_{pendingId}
 */
export function buildEditButtonId(pendingId: string, modalType: string): string {
  return `${GW_EDIT_BTN_PREFIX}_${modalType}_${pendingId}`;
}

/**
 * Build check prize button ID
 * Format: gw_check_prize_{pendingId}
 */
export function buildCheckPrizeButtonId(pendingId: string): string {
  return `${GW_CHECK_PRIZE_BTN_PREFIX}_${pendingId}`;
}

/**
 * Build a modal customId for giveaway editing
 * Format: gw_modal_{modalType}_{pendingId}
 */
export function buildGwModalId(pendingId: string, modalType: string): string {
  return `${GW_MODAL_PREFIX}_${modalType}_${pendingId}`;
}

/**
 * Build a prize edit button customId
 * Format: gw_prize_edit_{pendingId}_{prizeIndex}
 */
export function buildPrizeEditButtonId(pendingId: string, prizeIndex: number): string {
  return `${GW_PRIZE_EDIT_BTN_PREFIX}_${pendingId}_${prizeIndex}`;
}

/**
 * Build prize panel navigation button customId
 * Format: gw_prize_nav_{pendingId}_{prev|next}_{page}
 */
export function buildPrizeNavButtonId(pendingId: string, direction: 'prev' | 'next', page: number): string {
  return `${GW_PRIZE_NAV_PREFIX}_${pendingId}_${direction}_${page}`;
}

/**
 * Build Prize Results navigation button customId
 * Format: gw_prize_results_nav_{giveawayId}_{prev|next}_{page}
 */
export function buildPrizeResultsNavButtonId(giveawayId: string, direction: 'prev' | 'next', page: number): string {
  return `${GW_PRIZE_RESULTS_NAV_PREFIX}_${giveawayId}_${direction}_${page}`;
}

/**
 * Build Prize Results back button customId
 * Format: gw_prize_results_back_{giveawayId}_{returnPage}
 */
export function buildPrizeResultsBackButtonId(giveawayId: string, returnPage: number): string {
  return `${GW_PRIZE_RESULTS_BACK_PREFIX}_${giveawayId}_${returnPage}`;
}

/**
 * Build a create panel button customId
 * Format: panel_giveaway_btn_create_{pendingId}_{action}
 */
export function buildCreateButtonId(pendingId: string, action: string): string {
  return `panel_${MAIN_PANEL_ID}_btn_${CREATE_PANEL_PREFIX}_${pendingId}_${action}`;
}

/**
 * Build a create panel modal customId
 * Format: panel_giveaway_modal_{modalType}_{pendingId}
 */
export function buildCreateModalId(pendingId: string, modalType: string): string {
  return `panel_${MAIN_PANEL_ID}_modal_${modalType}_${pendingId}`;
}

/**
 * Build a detail panel button customId
 * Format: panel_giveaway_btn_detail_{giveawayId}_{action}_{page?}
 */
export function buildDetailButtonId(giveawayId: string, action: string, page?: number): string {
  const base = `panel_${MAIN_PANEL_ID}_btn_${DETAIL_PANEL_PREFIX}_${giveawayId}_${action}`;
  return page !== undefined ? `${base}_${page}` : base;
}

/**
 * Build main panel pagination button customId
 * Format: panel_giveaway_btn_{prev|next}_{page}
 */
export function buildPaginationButtonId(direction: 'prev' | 'next', page: number): string {
  return `panel_${MAIN_PANEL_ID}_btn_${direction}_${page}`;
}

/**
 * Build main panel dropdown customId
 * Format: panel_giveaway_dropdown_select_{page}
 */
export function buildMainDropdownId(page: number): string {
  return `panel_${MAIN_PANEL_ID}_dropdown_${MAIN_DROPDOWN}_${page}`;
}

