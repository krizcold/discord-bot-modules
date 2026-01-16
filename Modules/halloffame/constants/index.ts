/**
 * Hall of Fame Constants
 * Button IDs, modal IDs, and prefixes for the module
 */

// Panel and module identifiers
export const HOF_PANEL_ID = 'halloffame';
export const HOF_MODULE_NAME = 'halloffame';

// Pagination
export const HOF_PAGE_BTN = 'hof_page';
export const HOF_PAGE_MODAL = 'hof_page_modal';

// Board management buttons
export const HOF_CREATE_BTN = 'hof_create';
export const HOF_VIEW_BTN = 'hof_view';           // hof_view_{boardId}
export const HOF_EDIT_BTN = 'hof_edit';           // hof_edit_{boardId}_{field}
export const HOF_DELETE_BTN = 'hof_delete';       // hof_delete_{boardId}
export const HOF_TOGGLE_BTN = 'hof_toggle';       // hof_toggle_{boardId}
export const HOF_BACK_BTN = 'hof_back';

// Edit field identifiers
export const FIELD_NAME = 'name';
export const FIELD_EMOJI = 'emoji';
export const FIELD_DEST_CHANNEL = 'dest_channel';
export const FIELD_SRC_CHANNELS = 'src_channels';
export const FIELD_MIN_REACTIONS = 'min_reactions';
export const FIELD_REMOVAL_THRESHOLD = 'removal_threshold';
export const FIELD_UNFEATURED_ACTION = 'unfeatured_action';
export const FIELD_SELF_REACT = 'self_react';
export const FIELD_SYNC_EDITS = 'sync_edits';
export const FIELD_SYNC_DELETES = 'sync_deletes';
export const FIELD_AUTO_REACT = 'auto_react';
export const FIELD_EMBED_COLOR = 'embed_color';

// Modal IDs
export const HOF_NAME_MODAL = 'hof_modal_name';
export const HOF_EMOJI_MODAL = 'hof_modal_emoji';
export const HOF_THRESHOLD_MODAL = 'hof_modal_threshold';
export const HOF_COLOR_MODAL = 'hof_modal_color';

// Dropdown IDs
export const HOF_CHANNEL_DROPDOWN = 'hof_dropdown_channel';
export const HOF_SRC_CHANNELS_DROPDOWN = 'hof_dropdown_src_channels';
export const HOF_ACTION_DROPDOWN = 'hof_dropdown_action';

// Pagination defaults
export const ITEMS_PER_PAGE = 8;
export const MAX_ITEMS_PER_PAGE = 10;

// ============================================================================
// ID BUILDERS AND PARSERS
// ============================================================================

/**
 * Build a view button ID
 */
export function buildViewButtonId(boardId: string): string {
  return `${HOF_VIEW_BTN}_${boardId}`;
}

/**
 * Parse a view button ID
 */
export function parseViewButtonId(buttonId: string): string | null {
  if (!buttonId.startsWith(`${HOF_VIEW_BTN}_`)) return null;
  return buttonId.slice(HOF_VIEW_BTN.length + 1);
}

/**
 * Build an edit button ID
 */
export function buildEditButtonId(boardId: string, field: string): string {
  return `${HOF_EDIT_BTN}_${boardId}_${field}`;
}

/**
 * Parse an edit button ID
 */
export function parseEditButtonId(buttonId: string): { boardId: string; field: string } | null {
  if (!buttonId.startsWith(`${HOF_EDIT_BTN}_`)) return null;
  const parts = buttonId.slice(HOF_EDIT_BTN.length + 1).split('_');
  if (parts.length < 2) return null;
  return {
    boardId: parts[0],
    field: parts.slice(1).join('_'),
  };
}

/**
 * Build a delete button ID
 */
export function buildDeleteButtonId(boardId: string): string {
  return `${HOF_DELETE_BTN}_${boardId}`;
}

/**
 * Parse a delete button ID
 */
export function parseDeleteButtonId(buttonId: string): string | null {
  if (!buttonId.startsWith(`${HOF_DELETE_BTN}_`)) return null;
  return buttonId.slice(HOF_DELETE_BTN.length + 1);
}

/**
 * Build a toggle button ID
 */
export function buildToggleButtonId(boardId: string): string {
  return `${HOF_TOGGLE_BTN}_${boardId}`;
}

/**
 * Parse a toggle button ID
 */
export function parseToggleButtonId(buttonId: string): string | null {
  if (!buttonId.startsWith(`${HOF_TOGGLE_BTN}_`)) return null;
  return buttonId.slice(HOF_TOGGLE_BTN.length + 1);
}

/**
 * Build a pagination button ID
 */
export function buildPaginationButtonId(direction: 'prev' | 'next', currentPage: number): string {
  return `panel_${HOF_PANEL_ID}_btn_${direction}_${currentPage}`;
}

/**
 * Parse a pagination button ID
 */
export function parsePaginationButtonId(buttonId: string): { direction: 'prev' | 'next'; page: number } | null {
  const prevMatch = buttonId.match(/btn_prev_(\d+)$/);
  if (prevMatch) {
    return { direction: 'prev', page: parseInt(prevMatch[1], 10) };
  }

  const nextMatch = buttonId.match(/btn_next_(\d+)$/);
  if (nextMatch) {
    return { direction: 'next', page: parseInt(nextMatch[1], 10) };
  }

  return null;
}

/**
 * Build a back button ID with return page
 */
export function buildBackButtonId(returnPage: number = 0): string {
  return `${HOF_BACK_BTN}_${returnPage}`;
}

/**
 * Parse a back button ID
 */
export function parseBackButtonId(buttonId: string): number {
  if (!buttonId.startsWith(`${HOF_BACK_BTN}_`)) return 0;
  const page = parseInt(buttonId.slice(HOF_BACK_BTN.length + 1), 10);
  return isNaN(page) ? 0 : page;
}
