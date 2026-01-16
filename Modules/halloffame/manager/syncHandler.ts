/**
 * Hall of Fame Sync Handler
 * Syncs featured message records with actual Discord state
 */

import { Client, TextChannel, Message, Collection } from 'discord.js';
import { Board, FeaturedMessage } from '../types';
import {
  getAllBoards,
  loadFeatured,
  removeFeaturedMessage,
  getBoard,
} from './data/crud';

export interface SyncResult {
  boardId: string;
  boardName: string;
  removedFeatured: number;
  addedReactions: number;
  errors: string[];
}

/**
 * Sync a single board - check featured messages and add missing reactions
 */
export async function syncBoard(
  client: Client,
  guildId: string,
  boardId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    boardId,
    boardName: '',
    removedFeatured: 0,
    addedReactions: 0,
    errors: [],
  };

  const board = getBoard(guildId, boardId);
  if (!board) {
    result.errors.push('Board not found');
    return result;
  }

  result.boardName = board.name;

  // 1. Check if featured messages still exist
  const featured = loadFeatured(guildId).filter(f => f.boardId === boardId);

  for (const entry of featured) {
    try {
      // Check if original message still exists
      const sourceChannel = await client.channels.fetch(entry.originalChannelId).catch(() => null);
      if (!sourceChannel?.isTextBased()) {
        removeFeaturedMessage(guildId, boardId, entry.originalMessageId);
        result.removedFeatured++;
        continue;
      }

      const originalMsg = await (sourceChannel as TextChannel).messages.fetch(entry.originalMessageId).catch(() => null);
      if (!originalMsg) {
        removeFeaturedMessage(guildId, boardId, entry.originalMessageId);
        result.removedFeatured++;
        continue;
      }

      // Check if featured message still exists
      const destChannel = await client.channels.fetch(board.destinationChannelId).catch(() => null);
      if (!destChannel?.isTextBased()) {
        removeFeaturedMessage(guildId, boardId, entry.originalMessageId);
        result.removedFeatured++;
        continue;
      }

      const featuredMsg = await (destChannel as TextChannel).messages.fetch(entry.featuredMessageId).catch(() => null);
      if (!featuredMsg) {
        removeFeaturedMessage(guildId, boardId, entry.originalMessageId);
        result.removedFeatured++;
      }
    } catch (error) {
      result.errors.push(`Error checking featured ${entry.originalMessageId}: ${error}`);
    }
  }

  // 2. Add missing reactions in source channels (if auto-react enabled and channels defined)
  if (board.autoReact && board.sourceChannelIds.length > 0) {
    for (const channelId of board.sourceChannelIds) {
      try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) continue;

        // Fetch recent messages (last 100)
        const messages = await (channel as TextChannel).messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages) continue;

        for (const [, message] of messages) {
          // Skip bot messages
          if (message.author.bot) continue;

          // Check if bot has already reacted with this emoji
          const existingReaction = message.reactions.cache.find(
            r => (r.emoji.id || r.emoji.name) === board.emojiIdentifier
          );

          const botReacted = existingReaction?.me ?? false;

          if (!botReacted) {
            try {
              await message.react(board.emojiIdentifier);
              result.addedReactions++;
            } catch (error) {
              // Silently skip if can't react (message too old, etc.)
            }
          }
        }
      } catch (error) {
        result.errors.push(`Error syncing channel ${channelId}: ${error}`);
      }
    }
  }

  return result;
}

/**
 * Sync all boards for a guild
 */
export async function syncGuild(
  client: Client,
  guildId: string
): Promise<SyncResult[]> {
  const boards = getAllBoards(guildId, true); // Only enabled boards
  const results: SyncResult[] = [];

  for (const board of boards) {
    const result = await syncBoard(client, guildId, board.id);
    results.push(result);
  }

  return results;
}

/**
 * Sync all guilds on startup
 */
export async function syncAllGuilds(client: Client): Promise<void> {
  console.log('[HallOfFame] Starting sync for all guilds...');

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const results = await syncGuild(client, guildId);

      let totalRemoved = 0;
      let totalReactions = 0;

      for (const result of results) {
        totalRemoved += result.removedFeatured;
        totalReactions += result.addedReactions;
      }

      if (totalRemoved > 0 || totalReactions > 0) {
        console.log(`[HallOfFame] Synced ${guild.name}: removed ${totalRemoved} stale records, added ${totalReactions} reactions`);
      }
    } catch (error) {
      console.error(`[HallOfFame] Failed to sync guild ${guildId}:`, error);
    }
  }

  console.log('[HallOfFame] Sync complete');
}
