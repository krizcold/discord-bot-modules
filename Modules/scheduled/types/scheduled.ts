// Reminder Types

export interface UserReminder {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  messageId: string;      // Original bot reply (to delete later)
  message: string;        // User's reminder text
  createdAt: number;      // Unix ms
  triggerAt: number;      // Unix ms
}

export interface ReminderStorage {
  reminders: UserReminder[];
}

// Scheduled Messages Types

export interface ScheduledGroup {
  id: string;
  guildId: string;
  name: string;
  enabled: boolean;
  channelId: string;

  // Messages
  messages: ScheduledMessage[];
  selectionMode: 'random' | 'sequential';
  randomOldestPercent: number;  // Default 30
  loop: boolean;                // true = loop forever, false = stop after all sent
  currentIndex: number;         // For sequential mode

  // Pin behavior
  autoPin: boolean;
  lastPinnedMessageId?: string;
  lastPinnedChannelId?: string;

  // Design (optional)
  design?: MessageDesign;

  // Schedule
  schedule: ScheduleConfig;

  // Timestamps
  createdAt: number;
  lastSentAt: number | null;
  nextSendAt: number | null;
}

export interface ScheduledMessage {
  id: string;
  content: string;
  sentCount: number;
  lastSentAt: number | null;
  createdAt: number;

  // Optional per-message image (shown alongside group design image if both exist)
  image?: string;

  // Queue system
  forceNext?: boolean;       // If true, this message is forced to be next (only one at a time)
  queuePosition?: number;    // Queue position (lower = earlier in queue, 0 = not queued)
}

export interface ScheduleConfig {
  type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

  // Time of day (24h format)
  timeHour: number;
  timeMinute: number;

  // For hourly/custom intervals
  intervalHours?: number;
  intervalMinutes?: number;  // For custom: every X minutes
  intervalDays?: number;

  // For weekly (0=Sun, 6=Sat)
  weekdays?: number[];

  // For monthly
  dayOfMonth?: number;

  // Schedule bounds
  startDate: number;        // Unix ms
  endDate?: number;         // Unix ms (optional)

  // Timezone
  utcOffset: number;        // Hours from UTC
  minuteModifier: number;   // Additional minutes (for half-hour zones)
}

export type TextFormat = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'codeblock' | 'spoiler' | 'quote';

export interface MessageDesign {
  messageType: 'message' | 'embed';
  title?: string;         // Plain text, prepended to message
  footer?: string;        // Plain text, appended to message
  prefix?: string;        // Text/emoji before each message
  formats?: TextFormat[]; // Text formatting to apply

  // Embed-only options
  color?: number;         // Embed color (hex as number)
  image?: string;         // Image URL at bottom of embed
}

export interface GroupStorage {
  groups: ScheduledGroup[];
}

// Panel State Types

export type MessagesViewMode = 'detailed' | 'compact';

export interface ScheduledPanelState {
  currentPage: number;
  messagesPage?: number;
  messagesViewMode?: MessagesViewMode;
  editingGroupId?: string;
  pendingGroup?: Partial<ScheduledGroup>;
  selectedMessageIndex?: number;
}

// Settings Types

export type EmbedBehavior = 'never' | 'with_perms' | 'always';
