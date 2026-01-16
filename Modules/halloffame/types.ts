/**
 * Hall of Fame Module Types
 */

/**
 * Board configuration - defines a single "starboard" system
 */
export interface Board {
  /** Unique identifier (UUID) */
  id: string;
  /** Guild this board belongs to */
  guildId: string;
  /** Display name for the board */
  name: string;
  /** Emoji identifier (custom emoji ID or unicode character) */
  emojiIdentifier: string;
  /** Emoji display format (<:name:id> or unicode) for rendering */
  emojiDisplay: string;
  /** Channel where featured messages are posted */
  destinationChannelId: string;
  /** Source channels to monitor (empty = all channels) */
  sourceChannelIds: string[];
  /** Minimum reactions to feature a message (default: 3) */
  minReactions: number;
  /** Below this count = unfeature (0 = never auto-remove) */
  removalThreshold: number;
  /** What to do when a message is unfeatured */
  unfeaturedAction: 'delete' | 'edit';
  /** Can users react to their own messages? */
  allowSelfReact: boolean;
  /** Update featured message when original is edited */
  syncEdits: boolean;
  /** Handle featured message when original is deleted */
  syncDeletes: boolean;
  /** Bot auto-reacts on featured posts */
  autoReact: boolean;
  /** Channel IDs excluded from this board */
  excludedChannels: string[];
  /** Embed accent color (hex number) */
  embedColor: number;
  /** Lock source channels to specific content types */
  lockSourceEnabled: boolean;
  /** Allowed content formats when source lock enabled: 'images', 'videos', 'audio', 'files', 'links' */
  lockSourceFormats: string[];
  /** Lock destination channel to bot-only messages */
  lockDestinationEnabled: boolean;
  /** Whether the board is active */
  enabled: boolean;
  /** When the board was created */
  createdAt: number;
  /** User ID who created the board */
  createdBy: string;
}

/**
 * Static default values for new boards (non-configurable)
 * For configurable defaults, use getDefaultBoardValues() from configUtils
 */
export const STATIC_BOARD_DEFAULTS: Partial<Board> = {
  unfeaturedAction: 'delete',
  excludedChannels: [],
  enabled: true,
  sourceChannelIds: [],
  lockSourceEnabled: false,
  lockSourceFormats: [],
  lockDestinationEnabled: false,
};

/**
 * Default values for new boards (legacy - use getDefaultBoardValues for configurable values)
 * @deprecated Use getDefaultBoardValues() from configUtils for configurable defaults
 */
export const DEFAULT_BOARD_VALUES: Partial<Board> = {
  minReactions: 3,
  removalThreshold: 0,
  unfeaturedAction: 'delete',
  allowSelfReact: false,
  syncEdits: true,
  syncDeletes: true,
  autoReact: true,
  excludedChannels: [],
  embedColor: 0xFFD700, // Gold
  enabled: true,
  sourceChannelIds: [],
  lockSourceEnabled: false,
  lockSourceFormats: [],
  lockDestinationEnabled: false,
};

/**
 * Currently featured message record
 */
export interface FeaturedMessage {
  /** Unique identifier (UUID) */
  id: string;
  /** Board this featured message belongs to */
  boardId: string;
  /** Original message ID in source channel */
  originalMessageId: string;
  /** Channel ID of the original message */
  originalChannelId: string;
  /** Message ID of the featured post in destination channel */
  featuredMessageId: string;
  /** Author of the original message */
  authorId: string;
  /** Current reaction count */
  currentReactionCount: number;
  /** When the message was featured */
  featuredAt: number;
  /** Last time the featured message was updated */
  lastUpdated: number;
}

/**
 * Historical record of featured messages
 */
export interface FeatureHistoryEntry {
  /** Unique identifier (UUID) */
  id: string;
  /** Board this entry belongs to */
  boardId: string;
  /** Original message ID */
  originalMessageId: string;
  /** Channel ID of the original message */
  originalChannelId: string;
  /** Author of the original message */
  authorId: string;
  /** Peak reaction count achieved */
  peakReactionCount: number;
  /** When the message was featured */
  featuredAt: number;
  /** When the message was unfeatured (if applicable) */
  unfeaturedAt?: number;
  /** Reason for unfeaturing */
  unfeaturedReason?: 'removed' | 'deleted' | 'message_deleted' | 'board_deleted';
}

/**
 * Board display status for list view
 */
export type BoardDisplayStatus = 'active' | 'disabled';

/**
 * Board list item for panel display
 */
export interface BoardListItem {
  id: string;
  name: string;
  emojiDisplay: string;
  status: BoardDisplayStatus;
  featuredCount: number;
}

/**
 * Pending board for create/edit state
 */
export interface PendingBoard extends Partial<Board> {
  /** If editing, the existing board ID */
  existingId?: string;
  /** Original emoji input from user (for pre-filling edit modal) */
  emojiInput?: string;
}
