/**
 * Configuration Constants for Giveaway System
 * Pagination limits, status indicators, and other configuration values
 */

// =============================================================================
// PAGINATION CONFIG
// =============================================================================
// Component budget: 40 max - ~11 overhead (container, title, separators, action row with 5 buttons)
// Each section = 3 components (Section + TextDisplay + Button accessory)
// 8 items = 24 + 11 = 35, plus return button (2) = 37 (safe)
export const ITEMS_PER_PAGE = 8;
export const MAX_ITEMS_PER_PAGE = 8;
export const PRIZES_PER_PAGE = 5;

// =============================================================================
// STATUS INDICATORS
// =============================================================================
export const STATUS_EMOJI = {
  active: '🟢',
  pending: '🟡',  // Ready to start
  ended: '⚫',
  cancelled: '🔴',
  draft: '⚠️'    // Missing required fields
} as const;

export type GiveawayStatus = keyof typeof STATUS_EMOJI;
