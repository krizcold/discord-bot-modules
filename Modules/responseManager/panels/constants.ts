/**
 * Response Manager Panel Constants
 */

// Panel IDs
export const PANEL_ID = 'response_manager';
export const LIST_PANEL_ID = 'response_manager_list';
export const EDITOR_PANEL_ID = 'response_manager_editor';
export const KEYWORDS_PANEL_ID = 'response_manager_keywords';
export const RESPONSE_CONFIG_PANEL_ID = 'response_manager_response_config';
export const COMMAND_CONFIG_PANEL_ID = 'response_manager_command_config';
export const ARG_MAPPING_PANEL_ID = 'response_manager_arg_mapping';
export const COOLDOWN_PANEL_ID = 'response_manager_cooldown';

// Button ID prefixes (used with panel_{PANEL_ID}_btn_{action})
export const BTN = {
  // List panel
  PREV: 'prev',
  NEXT: 'next',
  PAGE: 'page',
  NEW: 'new',
  EDIT: 'edit',          // + group id suffix
  CLOSE: 'close',

  // Editor panel
  TOGGLE: 'toggle',
  EDIT_NAME: 'edit_name',
  EDIT_KEYWORDS: 'edit_keywords',
  EDIT_CHANNELS: 'edit_channels',
  EDIT_MATCH_MODE: 'edit_match_mode',
  CONFIG_RESPONSE: 'config_response',
  DELETE: 'delete',
  CONFIRM_DELETE: 'confirm_delete',
  CANCEL_DELETE: 'cancel_delete',
  BACK: 'back',
  SAVE: 'save',

  // Response config
  ADD_RESPONSE: 'add_response',
  REMOVE_RESPONSE: 'remove_response',
  EDIT_RESPONSE: 'edit_response',       // + index suffix
  TOGGLE_SELECTION: 'toggle_selection',
  TOGGLE_EPHEMERAL: 'toggle_ephemeral',
  TOGGLE_HISTORY: 'toggle_history',
  RESP_PREV: 'resp_prev',
  RESP_NEXT: 'resp_next',
  VARS_HELP: 'vars_help',
  VARS_BACK: 'vars_back',

  // Command config
  SELECT_COMMAND: 'select_command',
  MAP_ARGS: 'map_args',

  // Arg mapping
  ARG_PREV: 'arg_prev',
  ARG_NEXT: 'arg_next',

  // Keywords panel
  UPLOAD_KEYWORDS: 'upload_keywords',
  DOWNLOAD_KEYWORDS: 'download_keywords',

  // Cooldown panel
  EDIT_COOLDOWN: 'edit_cooldown',
  EDIT_GROUP_COOLDOWN: 'edit_group_cooldown',
  EDIT_KEYWORD_COOLDOWN: 'edit_keyword_cooldown',
  RESET_COOLDOWN: 'reset_cooldown',
} as const;

// Dropdown IDs (used with panel_{PANEL_ID}_dropdown_{name})
export const DROPDOWN = {
  RESPONSE_TYPE: 'response_type',
  MATCH_MODE: 'match_mode',
  COMMAND: 'command',
  ARG_MAP: 'arg_map',     // + arg name suffix
  CHANNEL_SELECT: 'channel_select',
} as const;

// Modal IDs
export const MODAL = {
  GROUP_NAME: 'group_name',
  KEYWORDS: 'keywords',
  ADD_KEYWORD: 'add_keyword',
  UPLOAD_KEYWORDS: 'upload_keywords',
  ADD_RESPONSE: 'add_response',
  EDIT_RESPONSE: 'edit_response',       // + index suffix
  STATIC_VALUE: 'static_value',
  GROUP_COOLDOWN: 'group_cooldown',
  KEYWORD_COOLDOWN: 'keyword_cooldown',
} as const;

// Items per page in list view
export const ITEMS_PER_PAGE = 5;

// Items per page in responses list
export const RESPONSES_PER_PAGE = 8;

// Max total characters for all responses combined (default, configurable)
export const DEFAULT_MAX_RESPONSE_LENGTH = 10000;

// Max groups per guild (default, configurable via module config)
export const DEFAULT_MAX_GROUPS = 50;

// Max channels per group (Discord limit)
export const MAX_CHANNELS = 25;
