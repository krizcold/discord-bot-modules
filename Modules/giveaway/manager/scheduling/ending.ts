import {
  Client,
  User,
  Message,
  MessageFlags,
} from 'discord.js';
import { unregisterReactionHandler } from '@internal/events/messageReactionAdd/reactionHandler';
import { getGiveaway, updateGiveaway } from '../data/crud';
import { isChannelDefinitelySendable } from '../types';
import { activeTimers } from '../cache';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');
import {
  buildGiveawayEndedV2,
  buildGiveawayOriginalEndedV2,
  buildGiveawayCancelledV2,
} from '../../utils/embedBuilder';
import { Giveaway } from '@bot/types/commandTypes';

/**
 * Fisher-Yates shuffle algorithm - produces uniformly random results
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Get placement medal emoji
 */
function getPlacementEmoji(placement: number): string {
  switch (placement) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return '🎗️';
  }
}

/**
 * Sync reaction participants from the Discord message
 * This is needed when the bot was offline and missed reaction events
 */
async function syncReactionParticipants(client: Client, giveaway: Giveaway): Promise<string[]> {
  if (giveaway.entryMode !== 'reaction' || !giveaway.messageId || !giveaway.reactionIdentifier) {
    return giveaway.participants;
  }

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!isChannelDefinitelySendable(channel)) {
      logger.warn(`[ReactionSync] Channel ${giveaway.channelId} not sendable for giveaway ${giveaway.id}`);
      return giveaway.participants;
    }

    const message = await channel.messages.fetch(giveaway.messageId);
    if (!message) {
      logger.warn(`[ReactionSync] Message ${giveaway.messageId} not found for giveaway ${giveaway.id}`);
      return giveaway.participants;
    }

    // Find the reaction matching our identifier (could be emoji ID or unicode)
    const reaction = message.reactions.cache.find(r => {
      const emojiId = r.emoji.id;
      const emojiName = r.emoji.name;
      return emojiId === giveaway.reactionIdentifier || emojiName === giveaway.reactionIdentifier;
    });

    if (!reaction) {
      logger.warn(`[ReactionSync] Reaction not found on message for giveaway ${giveaway.id}`);
      return giveaway.participants;
    }

    // Fetch all users who reacted (handles pagination automatically)
    const reactedUsers = await reaction.users.fetch();
    const syncedParticipants = new Set(giveaway.participants);
    let newCount = 0;

    for (const [userId, user] of reactedUsers) {
      if (!user.bot && !syncedParticipants.has(userId)) {
        syncedParticipants.add(userId);
        newCount++;
      }
    }

    if (newCount > 0) {
      logger.info(`[ReactionSync] Synced ${newCount} new participants for giveaway ${giveaway.id} (total: ${syncedParticipants.size})`);
      const participants = Array.from(syncedParticipants);
      // Update the stored participants
      updateGiveaway(giveaway.id, { participants }, giveaway.guildId);
      return participants;
    }

    return giveaway.participants;
  } catch (error) {
    logger.error(`[ReactionSync] Failed to sync participants for giveaway ${giveaway.id}:`, error);
    return giveaway.participants;
  }
}

export async function processEndedGiveaway(client: Client, giveawayId: string, guildId: string): Promise<void> {
  logger.info(`Processing end for giveaway ${giveawayId}`);
  const giveaway = getGiveaway(giveawayId, guildId);

  // Unregister reaction handler if it was a reaction giveaway
  if (giveaway && giveaway.entryMode === 'reaction' && giveaway.messageId) {
    unregisterReactionHandler(client, giveaway.messageId);
  }

  if (!giveaway || (giveaway.ended && !giveaway.cancelled)) {
    activeTimers.delete(giveawayId);
    return;
  }
  if (giveaway.cancelled) {
    activeTimers.delete(giveawayId);
    // Ensure it's marked as ended if cancelled
    if (!giveaway.ended) {
      updateGiveaway(giveawayId, { ended: true }, guildId);
    }
    return;
  }

  // For reaction giveaways, sync participants from the Discord message
  // This ensures we capture reactions that occurred while the bot was offline
  const participants = await syncReactionParticipants(client, giveaway);

  const isCompetition = giveaway.entryMode === 'competition';
  let winners: User[] = [];
  const prizeAssignments: Record<string, string> = {};

  if (isCompetition && giveaway.competitionPlacements) {
    // Competition mode: winners are already determined by placement order
    const sortedPlacements = Object.entries(giveaway.competitionPlacements)
      .sort(([, a], [, b]) => a - b); // Sort by placement (0 = 1st, 1 = 2nd, etc.)

    for (const [userId, placement] of sortedPlacements) {
      try {
        const user = await client.users.fetch(userId);
        winners.push(user);

        // Assign prize based on placement (prizes are in order for competition)
        const winnerPrize = giveaway.prizes[placement];
        if (winnerPrize) {
          prizeAssignments[userId] = winnerPrize;
        }
      } catch (e) {
        logger.error(`Failed to fetch competition winner user ${userId} for giveaway ${giveawayId}:`, e);
      }
    }
  } else if (participants.length > 0) {
    // Non-competition modes: randomly select winners
    const shuffled = shuffleArray(participants);
    const winnerIds = shuffled.slice(0, giveaway.winnerCount);

    // Shuffle prizes for random assignment
    const prizesToAssign = shuffleArray(giveaway.prizes);

    for (let i = 0; i < winnerIds.length; i++) {
      const id = winnerIds[i];
      try {
        const user = await client.users.fetch(id);
        winners.push(user);

        // Assign prize to this winner
        const winnerPrize = prizesToAssign[i];
        if (winnerPrize) {
          prizeAssignments[id] = winnerPrize;
        }
      } catch (e) {
        logger.error(`Failed to fetch winner user ${id} for giveaway ${giveawayId}:`, e);
      }
    }
  }

  updateGiveaway(giveawayId, {
    ended: true,
    winners: winners.map(w => w.id),
    cancelled: false,
    prizeAssignments,
  }, guildId);
  activeTimers.delete(giveawayId);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);

    if (isChannelDefinitelySendable(channel)) {
      let originalMessage: Message | null = null;
      try {
        originalMessage = await channel.messages.fetch(giveaway.messageId);
      } catch {
        logger.warn(`Could not fetch original message ${giveaway.messageId}, it may have been deleted`);
      }

      // Build V2 result container (mentions in TextDisplay WILL ping users!)
      const { container, components } = buildGiveawayEndedV2(giveaway, winners, isCompetition);

      // Send result message with V2 flag
      const resultMessage = await channel.send({
        components: components.length > 0 ? [container, ...components] : [container],
        flags: MessageFlags.IsComponentsV2,
      });

      // Update original announcement message to show ended state
      if (originalMessage) {
        const endedContainer = buildGiveawayOriginalEndedV2(giveaway, resultMessage.url);

        await originalMessage.edit({
          content: '',
          embeds: [],
          components: [endedContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch(err => logger.error('Failed to edit ended giveaway message:', err));

        if (giveaway.entryMode === 'reaction' && giveaway.reactionDisplayEmoji) {
          // Remove all reactions from the original message
          originalMessage.reactions.removeAll().catch(e => logger.warn(`Could not remove reactions: ${e.message}`));
        }
      }
    } else {
      logger.error(`Channel ${giveaway.channelId} is not sendable for giveaway ${giveawayId}`);
    }
  } catch (e) {
    logger.error(`Error announcing results for giveaway ${giveawayId}:`, e);
  }
}

export async function cancelGiveaway(client: Client, giveawayId: string, guildId: string): Promise<boolean> {
  logger.info(`Cancelling giveaway ${giveawayId}`);
  const giveaway = getGiveaway(giveawayId, guildId);

  if (!giveaway) {
    logger.warn(`Cancel failed: Giveaway ${giveawayId} not found`);
    return false;
  }

  // Unregister reaction handler if it was a reaction giveaway
  if (giveaway.entryMode === 'reaction' && giveaway.messageId) {
    unregisterReactionHandler(client, giveaway.messageId);
  }

  if (giveaway.cancelled) {
    logger.warn(`Cancel failed: Giveaway ${giveawayId} is already cancelled`);
    return false;
  }
  if (giveaway.ended && !giveaway.cancelled) {
    logger.warn(`Cancel failed: Giveaway ${giveawayId} has already ended`);
    return false;
  }

  const updated = updateGiveaway(giveawayId, { cancelled: true, ended: true, winners: [] }, guildId);
  if (!updated) {
    logger.error(`Failed to update giveaway data for cancellation: ${giveawayId}`);
    return false;
  }

  if (activeTimers.has(giveawayId)) {
    clearTimeout(activeTimers.get(giveawayId)!);
    activeTimers.delete(giveawayId);
  }

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    if (isChannelDefinitelySendable(channel)) {
      const originalMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (originalMessage) {
        // Build V2 cancelled container
        const cancelledContainer = buildGiveawayCancelledV2(giveaway);

        await originalMessage.edit({
          content: '',
          embeds: [],
          components: [cancelledContainer],
          flags: MessageFlags.IsComponentsV2,
        });

        if (giveaway.entryMode === 'reaction') {
          originalMessage.reactions.removeAll().catch(e => logger.warn(`Could not remove reactions: ${e.message}`));
        }
      } else {
        logger.warn(`Original message not found for cancelled giveaway ${giveawayId}`);
      }
    } else {
      logger.error(`Channel ${giveaway.channelId} is not sendable for cancelling giveaway ${giveawayId}`);
    }
  } catch (e) {
    logger.error(`Error updating message for cancelled giveaway ${giveawayId}:`, e);
  }

  logger.info(`Successfully cancelled giveaway ${giveawayId}`);
  return true;
}
