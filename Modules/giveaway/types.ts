import { Giveaway } from '@bot/types/commandTypes';
import {
  DMChannel,
  NewsChannel,
  TextChannel as GuildTextChannel,
  ThreadChannel,
  VoiceChannel,
} from 'discord.js';

// Pending giveaway data during creation
export interface PendingGiveawayData extends Partial<Omit<Giveaway, 'endTime' | 'startTime' | 'reactionIdentifier' | 'reactionDisplayEmoji'>> {
  durationMs?: number;
  reactionIdentifier?: string; // Actual ID for custom, or unicode char for standard
  reactionDisplayEmoji?: string; // <:name:id> or unicode char for display in panel
  reactionEmojiInput?: string; // Raw user input for editing (what they typed)
}

// Stored pending giveaway (persisted to JSON)
export interface StoredPendingGiveaway extends PendingGiveawayData {
  id: string;                      // UUID for identification
  createdAt: number;               // Timestamp when created
  createdBy: string;               // User ID who created it
  status: 'draft' | 'ready';       // 'ready' = all required fields set
  /** Array of prizes for multi-winner giveaways (length must equal winnerCount) */
  prizes?: string[];
  /** For competition mode: show live leaderboard as winners are determined (default: true) */
  liveLeaderboard?: boolean;
}

// Giveaway status for display
export type GiveawayDisplayStatus = 'active' | 'pending' | 'ended' | 'cancelled';

// Combined giveaway item for list display (can be active giveaway or pending)
export interface GiveawayListItem {
  id: string;
  title: string;
  status: GiveawayDisplayStatus;
  timestamp: number;               // End time for active, created time for pending, etc.
  winnerCount?: number;            // For ended giveaways
  isPending: boolean;              // true if it's a StoredPendingGiveaway
}

// Sendable text channel types
export type SendableTextChannel = GuildTextChannel | DMChannel | NewsChannel | ThreadChannel | VoiceChannel;

// Type guard for sendable channels
export function isSendableChannel(channel: any): channel is SendableTextChannel {
  return channel &&
         typeof channel.send === 'function' &&
         channel.isTextBased() &&
         !channel.partial;
}
