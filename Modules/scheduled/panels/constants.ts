/**
 * Scheduled Messages Panel Constants
 */

// Panel IDs
export const PANEL_ID = 'scheduled_messages';
export const LIST_PANEL_ID = 'scheduled_list';
export const EDITOR_PANEL_ID = 'scheduled_editor';
export const MESSAGES_PANEL_ID = 'scheduled_messages_list';
export const SCHEDULE_PANEL_ID = 'scheduled_schedule';
export const BULK_EDIT_PANEL_ID = 'scheduled_bulk';
export const DESIGN_PANEL_ID = 'scheduled_design';

// Button ID prefixes
export const BTN = {
  // List panel
  PREV: 'prev',
  NEXT: 'next',
  PAGE: 'page',
  NEW: 'new',
  EDIT: 'edit',
  BULK_ALL: 'bulk_all',
  CLOSE: 'close',

  // Editor panel
  TOGGLE: 'toggle',
  TOGGLE_PIN: 'toggle_pin',
  EDIT_NAME: 'edit_name',
  EDIT_SCHEDULE: 'edit_schedule',
  EDIT_MESSAGES: 'edit_messages',
  EDIT_DESIGN: 'edit_design',
  EDIT_CHANNEL: 'edit_channel',
  SEND_NOW: 'send_now',
  DELETE: 'delete',
  CONFIRM_DELETE: 'confirm_delete',
  CANCEL_DELETE: 'cancel_delete',
  BACK: 'back',
  SAVE: 'save',

  // Messages panel
  MSG_PREV: 'msg_prev',
  MSG_NEXT: 'msg_next',
  MSG_PAGE: 'msg_page',
  ADD_MSG: 'add_msg',
  EDIT_MSG: 'edit_msg',
  BULK_EDIT: 'bulk_edit',
  TOGGLE_VIEW: 'toggle_view',
  RESET_COUNTERS: 'reset_counters',

  // Schedule panel
  EDIT_TIME: 'edit_time',
  EDIT_DATES: 'edit_dates',
  TOGGLE_ONCE: 'toggle_once',
  EDIT_INTERVAL: 'edit_interval',
  EDIT_DAY_OF_MONTH: 'edit_day_of_month',

  // Bulk edit selection
  BULK_SELECT: 'bulksel',
} as const;

// Dropdown IDs
export const DROPDOWN = {
  GROUP_SELECT: 'group_select',
  MSG_SELECT: 'msg_select',
  FREQ_TYPE: 'freq_type',
  WEEKDAYS: 'weekdays',
  SELECTION_MODE: 'selection_mode',
  CHANNEL_SELECT: 'channel_select',
  SEND_NOW_SKIP: 'send_now_skip',
  MESSAGE_TYPE: 'message_type',
  TEXT_FORMAT: 'text_format',
} as const;

// Modal IDs
export const MODAL = {
  GROUP_NAME: 'group_name',
  ADD_MESSAGE: 'add_message',
  EDIT_MESSAGE: 'edit_message',
  EDIT_TIME: 'edit_time',
  EDIT_DATES: 'edit_dates',
  EDIT_INTERVAL: 'edit_interval',
  EDIT_DAY_OF_MONTH: 'edit_day_of_month',
  EDIT_RANDOM_PERCENT: 'edit_random_percent',
  BULK_JSON: 'bulk_json',
  SEND_NOW: 'send_now',
  EDIT_TITLE: 'edit_title',
  EDIT_FOOTER: 'edit_footer',
  EDIT_PREFIX: 'edit_prefix',
  EDIT_COLOR: 'edit_color',
  EDIT_IMAGE: 'edit_image',
  RESET_COUNTERS: 'reset_counters',
} as const;

// Pagination
export const GROUPS_PER_PAGE = 6;
export const MESSAGES_PER_PAGE = 6;

// Schedule type labels
export const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  hourly: 'Every X hours',
  daily: 'Every day',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom interval',
};

// Weekday labels (full names)
export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Status icons
export const STATUS_ICONS = {
  ACTIVE: '⏰',
  PAUSED: '⌛',
  COMPLETE: '✅',
  PIN: '📌',
  NEXT: '→',
  SENT: '✓',
  NEVER: '·',
} as const;
