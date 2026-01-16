export const MODULE_NAME = 'role-assign';
export const PANEL_ID = 'role-assign';
export const LIST_PANEL_ID = 'role-assign-list';
export const DATA_FILE = 'role-groups.json';

// List panel button actions
export const BTN_LIST_NEW = 'new';
export const BTN_LIST_EDIT = 'edit';
export const BTN_LIST_PREV = 'prev';
export const BTN_LIST_NEXT = 'next';
export const BTN_LIST_PAGE = 'page';

// Items per page in list view
export const GROUPS_PER_PAGE = 5;

// Live role button prefix (for published messages - NOT panel buttons)
export const RA_ROLE_BTN_PREFIX = 'ra_btn';

// Panel button actions (used in panel_{PANEL_ID}_btn_{action}_{data} format)
// ALL buttons go through the panel system for Web-UI compatibility
export const BTN_BACK_LIST = 'back_list';     // Return to list panel
export const BTN_CANCEL = 'cancel';           // Cancel and close panel
export const BTN_ADD_ROLE = 'add_role';       // Shows add role modal
export const BTN_EDIT_ROLE = 'edit_role';     // Shows edit role modal (format: edit_role_{pendingId}_{roleIndex})
export const BTN_APPEARANCE = 'appearance';   // Navigate to appearance view
export const BTN_APPEARANCE_BACK = 'appearance_back'; // Return from appearance view
export const BTN_EDIT_EMBED = 'edit_embed';   // Shows edit embed modal
export const BTN_EDIT_TEXT = 'edit_text';     // Shows edit text modal
export const BTN_PUBLISH = 'publish';         // Publish role assignment to channel
export const BTN_SAVE_EDIT = 'save_edit';     // Save edits to existing group
export const BTN_DELETE = 'delete';           // Delete pending/group

// Helper to build panel button custom IDs
export function buildButtonId(action: string, ...data: string[]): string {
  const parts = [`panel_${PANEL_ID}_btn`, action, ...data].filter(Boolean);
  return parts.join('_');
}

// Helper to parse button ID (returns action and data parts)
export function parseButtonId(buttonId: string): { action: string; data: string[] } | null {
  // buttonId comes stripped of "panel_{panelId}_btn_" prefix
  const parts = buttonId.split('_');
  if (parts.length === 0) return null;

  // Handle actions with underscores (e.g., "add_role", "edit_role", "back_list")
  if (parts[0] === 'back' && parts[1] === 'list') {
    return { action: 'back_list', data: parts.slice(2) };
  }
  if (parts[0] === 'add' && parts[1] === 'role') {
    return { action: 'add_role', data: parts.slice(2) };
  }
  if (parts[0] === 'edit' && parts[1] === 'role') {
    return { action: 'edit_role', data: parts.slice(2) };
  }
  if (parts[0] === 'edit' && parts[1] === 'embed') {
    return { action: 'edit_embed', data: parts.slice(2) };
  }
  if (parts[0] === 'edit' && parts[1] === 'text') {
    return { action: 'edit_text', data: parts.slice(2) };
  }
  if (parts[0] === 'save' && parts[1] === 'edit') {
    return { action: 'save_edit', data: parts.slice(2) };
  }
  if (parts[0] === 'appearance' && parts[1] === 'back') {
    return { action: 'appearance_back', data: parts.slice(2) };
  }

  return { action: parts[0], data: parts.slice(1) };
}

// Dropdown IDs (used in panel dropdown handling)
export const DROPDOWN_SELECTION_MODE = 'selection_mode';
export const DROPDOWN_INTERACTION_MODE = 'interaction_mode';
export const DROPDOWN_DISPLAY_MODE = 'display_mode';
export const DROPDOWN_REACTION_PERSIST = 'reaction_persist';
export const DROPDOWN_ROLE_SELECT = 'role_select';

// Modal IDs (panel_ prefix for panel handling)
export const MODAL_ADD_ROLE = 'add_role';
export const MODAL_EDIT_ROLE = 'edit_role';
export const MODAL_EDIT_EMBED = 'edit_embed';
export const MODAL_EDIT_TEXT = 'edit_text';

// Navigation prefix for pagination
export const NAV_PREFIX = 'nav';
