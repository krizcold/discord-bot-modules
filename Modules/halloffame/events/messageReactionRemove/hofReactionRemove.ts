/**
 * Hall of Fame - Reaction Remove Handler
 * Updates featured messages when reactions are removed
 * Unfeatures messages that drop below the removal threshold
 */

import {
  Client,
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
  GatewayIntentBits,
  Message,
} from 'discord.js';
import {
  getBoardByEmoji,
  isFeatured,
  updateFeaturedCount,
  unfeatureMessage,
  getValidReactionCount,
} from '../../manager/boardManager';

export const requiredIntents = [
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildMessages,
];

export default async (
  client: Client,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) => {
  // Ignore bot reactions being removed
  if (user.bot) return;

  // Must be in a guild
  if (!reaction.message.guildId) return;

  // Fetch partials if needed
  if (reaction.partial) {
    try {
      reaction = await reaction.fetch();
    } catch (error) {
      // Reaction might be fully removed, check if we have a featured message
      // We'll handle this below
      console.warn('[HallOfFame] Could not fetch partial reaction on remove:', error);
    }
  }

  if (user.partial) {
    try {
      user = await user.fetch();
    } catch (error) {
      console.error('[HallOfFame] Failed to fetch partial user:', error);
      return;
    }
  }

  // Get message (may be partial)
  let message = reaction.message;
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch (error) {
      console.error('[HallOfFame] Failed to fetch partial message:', error);
      return;
    }
  }

  const guildId = message.guildId!;
  const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;

  if (!emojiIdentifier) return;

  // Find board matching this emoji
  const board = getBoardByEmoji(guildId, emojiIdentifier);
  if (!board || !board.enabled) return;

  // Check if this message is featured on this board
  if (!isFeatured(guildId, board.id, message.id)) {
    return;
  }

  // Get current valid reaction count
  const reactionCount = await getValidReactionCount(message as Message, board);

  // Check if below removal threshold
  if (board.removalThreshold > 0 && reactionCount < board.removalThreshold) {
    // Unfeature the message
    await unfeatureMessage(
      client,
      guildId,
      board.id,
      message.id,
      'Reactions dropped below threshold'
    );
  } else {
    // Just update the count
    await updateFeaturedCount(client, guildId, board.id, message.id, reactionCount);
  }
};
