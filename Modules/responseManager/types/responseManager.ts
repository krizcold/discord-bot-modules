/**
 * Response Manager Types
 */

/**
 * Match modes for keyword matching
 */
export type MatchMode = 'exact' | 'contains' | 'startsWith' | 'word';

/**
 * Response types - what action to take when triggered
 */
export type ResponseType = 'react' | 'reply' | 'respond' | 'command';

/**
 * Selection mode for multiple responses
 */
export type SelectionMode = 'random' | 'sequential';

/**
 * Keyword pattern with optional variables
 * e.g., "ts {hour}:{min}" extracts hour and min variables
 */
export interface KeywordPattern {
  pattern: string;       // The raw pattern string
  variables: string[];   // Extracted variable names
}

/**
 * Argument mapping for command type responses
 */
export interface ArgumentMapping {
  source: 'variable' | 'static';
  value: string;         // Variable name (e.g., "hour") or static value
}

/**
 * Cooldown configuration
 * - charges: Max number of uses before needing to reload (0 = infinite)
 * - reloadSeconds: Time in seconds to restore 1 charge
 */
export interface CooldownConfig {
  charges: number;
  reloadSeconds: number;
}

/**
 * Response item with value and optional display format
 * For emojis: value = identifier (ID or unicode), displayValue = <:name:id>, inputValue = :name:
 * For messages: value = message text, displayValue/inputValue not used
 */
export interface ResponseItem {
  value: string;
  displayValue?: string;
  inputValue?: string;    // What the user typed (for edit modal)
}

/**
 * A response group configuration
 */
export interface ResponseGroup {
  id: string;
  name: string;
  enabled: boolean;
  keywords: KeywordPattern[];
  matchMode: MatchMode;
  responseType: ResponseType;
  responses: ResponseItem[];        // Emoji(s) for react, message(s) for reply/respond
  selectionMode: SelectionMode;
  enabledChannels: string[];        // Empty = all channels
  lastSequenceIndex?: number;       // For sequential mode tracking

  // Command type specific
  commandName?: string;
  argumentMapping?: Record<string, ArgumentMapping>;

  // Cooldown configuration
  // Group cooldown applies to all triggers (default: 1s reload, infinite charges)
  // Keyword cooldown applies per-keyword only if >1 keyword exists
  groupCooldown?: CooldownConfig;
  keywordCooldown?: CooldownConfig;

  // Make reply/respond messages ephemeral (only visible to trigger user)
  ephemeral?: boolean;

  // History tracking - record this group's triggers in history (default: true)
  // Set to false for meta-responses like "what did the bot react to?" to avoid loops
  trackHistory?: boolean;
}

/**
 * History entry for tracking bot responses
 */
export interface ResponseHistoryEntry {
  timestamp: number;
  channelId: string;
  messageId: string;        // The message that triggered the response
  userId: string;           // Who triggered it
  groupId: string;
  groupName: string;
  keyword: string;          // What keyword matched
  responseType: ResponseType;
  response: string;         // What was sent/reacted (emoji ID, message text, or command name)
}

/**
 * History storage structure
 */
export interface ResponseHistoryStorage {
  entries: ResponseHistoryEntry[];
}

/**
 * Storage structure for response groups
 */
export interface ResponseManagerStorage {
  groups: ResponseGroup[];
}

/**
 * Panel session state for editing
 */
export interface ResponseManagerPanelState {
  currentPage: number;
  keywordsPage?: number;
  responsesPage?: number;
  editingGroupId?: string;
  pendingGroup?: Partial<ResponseGroup>;
}

/**
 * Result of pattern matching
 */
export interface PatternMatchResult {
  matched: boolean;
  group?: ResponseGroup;
  variables?: Record<string, string>;
  pattern?: KeywordPattern;
}

/**
 * Overlap detection result
 */
export interface OverlapInfo {
  keyword: string;
  groups: string[];  // Group names that overlap
}

/**
 * Default empty response group
 */
export function createDefaultGroup(): Partial<ResponseGroup> {
  return {
    name: '',
    enabled: true,
    keywords: [],
    matchMode: 'word',
    responseType: 'react',
    responses: [],
    selectionMode: 'random',
    enabledChannels: [],
    groupCooldown: { charges: 0, reloadSeconds: 1 },     // Infinite charges, 1s reload (default)
    keywordCooldown: { charges: 0, reloadSeconds: 0 },   // Disabled by default
  };
}

/**
 * Default storage
 */
export function createDefaultStorage(): ResponseManagerStorage {
  return {
    groups: [],
  };
}
