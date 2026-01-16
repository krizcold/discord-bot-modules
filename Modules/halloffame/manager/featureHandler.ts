/**
 * Hall of Fame Feature Handler
 * Core logic for featuring and unfeaturing messages
 */

import { randomUUID } from 'crypto';
import { Client, Message, TextChannel, EmbedBuilder } from 'discord.js';
import { Board, FeaturedMessage, FeatureHistoryEntry } from '../types';
import {
  isFeatured,
  getFeaturedMessage,
  addFeaturedMessage,
  updateFeaturedMessage,
  removeFeaturedMessage,
  addHistoryEntry,
  updateHistoryEntry,
  getBoard,
} from './data/crud';
import {
  buildFeaturedEmbed,
  buildUnfeaturedEmbed,
  buildDeletedMessageEmbed,
} from '../utils/embedBuilder';

/**
 * Feature a message to a board's destination channel
 */
export async function featureMessage(
  client: Client,
  board: Board,
  message: Message,
  reactionCount: number
): Promise<FeaturedMessage | null> {
  try {
    // Build the featured embed
    const embed = buildFeaturedEmbed(message, board, reactionCount);

    // Get destination channel
    const destChannel = await client.channels.fetch(board.destinationChannelId);
    if (!destChannel || !destChannel.isTextBased()) {
      console.error(`[HallOfFame] Destination channel ${board.destinationChannelId} not found or not text-based`);
      return null;
    }

    // Collect attachments to forward (audio, video, files - images handled by embed)
    const attachmentsToForward = message.attachments
      .filter(a => !a.contentType?.startsWith('image/'))
      .map(a => a.url);

    // Send featured message with attachments
    const featuredMsg = await (destChannel as TextChannel).send({
      embeds: [embed],
      files: attachmentsToForward,
    });

    // Create featured record
    const featured: FeaturedMessage = {
      id: randomUUID(),
      boardId: board.id,
      originalMessageId: message.id,
      originalChannelId: message.channelId,
      featuredMessageId: featuredMsg.id,
      authorId: message.author.id,
      currentReactionCount: reactionCount,
      featuredAt: Date.now(),
      lastUpdated: Date.now(),
    };

    // Save featured record
    addFeaturedMessage(board.guildId, featured);

    // Add to history
    const historyEntry: FeatureHistoryEntry = {
      id: randomUUID(),
      boardId: board.id,
      originalMessageId: message.id,
      originalChannelId: message.channelId,
      authorId: message.author.id,
      peakReactionCount: reactionCount,
      featuredAt: Date.now(),
    };
    addHistoryEntry(board.guildId, historyEntry);

    console.log(`[HallOfFame] Featured message ${message.id} to board "${board.name}" with ${reactionCount} reactions`);
    return featured;
  } catch (error) {
    console.error(`[HallOfFame] Failed to feature message: ${error}`);
    return null;
  }
}

/**
 * Update the reaction count on a featured message
 */
export async function updateFeaturedCount(
  client: Client,
  guildId: string,
  boardId: string,
  originalMessageId: string,
  newCount: number
): Promise<boolean> {
  try {
    const featured = getFeaturedMessage(guildId, boardId, originalMessageId);
    if (!featured) return false;

    const board = getBoard(guildId, boardId);
    if (!board) return false;

    // Get the featured message to update
    const destChannel = await client.channels.fetch(board.destinationChannelId);
    if (!destChannel || !destChannel.isTextBased()) return false;

    const featuredMsg = await (destChannel as TextChannel).messages.fetch(featured.featuredMessageId).catch(() => null);
    if (!featuredMsg) {
      // Featured message was deleted, clean up record
      removeFeaturedMessage(guildId, boardId, originalMessageId);
      return false;
    }

    // Update the embed footer with new count
    const existingEmbed = featuredMsg.embeds[0];
    if (existingEmbed) {
      const updatedEmbed = EmbedBuilder.from(existingEmbed)
        .setFooter({ text: `${board.emojiDisplay} ${newCount}` });

      await featuredMsg.edit({ embeds: [updatedEmbed] });
    }

    // Update record
    updateFeaturedMessage(guildId, originalMessageId, boardId, {
      currentReactionCount: newCount,
    });

    // Update peak in history if higher
    updateHistoryEntry(guildId, originalMessageId, boardId, {
      peakReactionCount: Math.max(featured.currentReactionCount, newCount),
    });

    return true;
  } catch (error) {
    console.error(`[HallOfFame] Failed to update featured count: ${error}`);
    return false;
  }
}

/**
 * Unfeature a message (remove or edit based on board settings)
 */
export async function unfeatureMessage(
  client: Client,
  guildId: string,
  boardId: string,
  originalMessageId: string,
  reason: string = 'Reactions dropped below threshold'
): Promise<boolean> {
  try {
    const featured = getFeaturedMessage(guildId, boardId, originalMessageId);
    if (!featured) return false;

    const board = getBoard(guildId, boardId);
    if (!board) return false;

    // Get the featured message
    const destChannel = await client.channels.fetch(board.destinationChannelId);
    if (!destChannel || !destChannel.isTextBased()) {
      // Channel gone, just clean up record
      removeFeaturedMessage(guildId, boardId, originalMessageId);
      return true;
    }

    const featuredMsg = await (destChannel as TextChannel).messages.fetch(featured.featuredMessageId).catch(() => null);

    if (featuredMsg) {
      if (board.unfeaturedAction === 'delete') {
        // Delete the featured message
        await featuredMsg.delete().catch(() => null);
      } else {
        // Edit to show unfeatured state
        const unfeaturedEmbed = buildUnfeaturedEmbed(board, featured.authorId, reason);
        await featuredMsg.edit({ embeds: [unfeaturedEmbed] }).catch(() => null);
      }
    }

    // Remove featured record
    removeFeaturedMessage(guildId, boardId, originalMessageId);

    // Update history
    updateHistoryEntry(guildId, originalMessageId, boardId, {
      unfeaturedAt: Date.now(),
      unfeaturedReason: 'removed',
    });

    console.log(`[HallOfFame] Unfeatured message ${originalMessageId} from board "${board.name}"`);
    return true;
  } catch (error) {
    console.error(`[HallOfFame] Failed to unfeature message: ${error}`);
    return false;
  }
}

/**
 * Handle original message deletion
 * Always removes the featured record; only modifies featured message if syncDeletes enabled
 */
export async function handleOriginalMessageDeleted(
  client: Client,
  guildId: string,
  boardId: string,
  originalMessageId: string
): Promise<boolean> {
  try {
    const featured = getFeaturedMessage(guildId, boardId, originalMessageId);
    if (!featured) return false;

    const board = getBoard(guildId, boardId);
    if (!board) {
      // Board deleted, just clean up record
      removeFeaturedMessage(guildId, boardId, originalMessageId);
      return true;
    }

    // Only modify the featured message in Hall of Fame if syncDeletes is enabled
    if (board.syncDeletes) {
      const destChannel = await client.channels.fetch(board.destinationChannelId);
      if (destChannel?.isTextBased()) {
        const featuredMsg = await (destChannel as TextChannel).messages.fetch(featured.featuredMessageId).catch(() => null);

        if (featuredMsg) {
          if (board.unfeaturedAction === 'delete') {
            await featuredMsg.delete().catch(() => null);
          } else {
            const deletedEmbed = buildDeletedMessageEmbed(board, featured.authorId);
            await featuredMsg.edit({ embeds: [deletedEmbed] }).catch(() => null);
          }
        }
      }
    }

    // Always remove featured record when original is deleted
    removeFeaturedMessage(guildId, boardId, originalMessageId);

    // Update history
    updateHistoryEntry(guildId, originalMessageId, boardId, {
      unfeaturedAt: Date.now(),
      unfeaturedReason: 'message_deleted',
    });

    return true;
  } catch (error) {
    console.error(`[HallOfFame] Failed to handle original message deletion: ${error}`);
    return false;
  }
}

/**
 * Handle original message edit
 */
export async function handleOriginalMessageEdited(
  client: Client,
  guildId: string,
  boardId: string,
  originalMessage: Message
): Promise<boolean> {
  try {
    const featured = getFeaturedMessage(guildId, boardId, originalMessage.id);
    if (!featured) return false;

    const board = getBoard(guildId, boardId);
    if (!board || !board.syncEdits) return false;

    // Get the featured message
    const destChannel = await client.channels.fetch(board.destinationChannelId);
    if (!destChannel || !destChannel.isTextBased()) return false;

    const featuredMsg = await (destChannel as TextChannel).messages.fetch(featured.featuredMessageId).catch(() => null);
    if (!featuredMsg) return false;

    // Rebuild embed with new content
    const updatedEmbed = buildFeaturedEmbed(originalMessage, board, featured.currentReactionCount);
    await featuredMsg.edit({ embeds: [updatedEmbed] });

    // Update record
    updateFeaturedMessage(guildId, originalMessage.id, boardId, {});

    return true;
  } catch (error) {
    console.error(`[HallOfFame] Failed to handle original message edit: ${error}`);
    return false;
  }
}

/**
 * Get valid reaction count for a message/board
 * Filters out bots and self-reacts if disabled
 */
export async function getValidReactionCount(
  message: Message,
  board: Board
): Promise<number> {
  const reaction = message.reactions.cache.find(
    r => (r.emoji.id || r.emoji.name) === board.emojiIdentifier
  );

  if (!reaction) return 0;

  // Fetch users if cache is incomplete
  let users = reaction.users.cache;
  if (users.size < (reaction.count || 0)) {
    try {
      users = await reaction.users.fetch();
    } catch {
      // Use cached count as fallback
      return reaction.count || 0;
    }
  }

  // Filter out invalid reactions
  let count = 0;
  for (const [userId, user] of users) {
    // Skip bots
    if (user.bot) continue;

    // Skip self-reacts if disabled
    if (!board.allowSelfReact && message.author.id === userId) continue;

    count++;
  }

  return count;
}
