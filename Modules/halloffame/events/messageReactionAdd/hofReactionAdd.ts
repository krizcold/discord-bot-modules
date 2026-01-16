/**
 * Hall of Fame - Reaction Add Handler
 * Monitors reactions and features messages when they reach the threshold
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
  featureMessage,
  updateFeaturedCount,
  getValidReactionCount,
} from '../../manager/boardManager';

export const requiredIntents = [
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

export default async (
  client: Client,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) => {
  // Ignore bot reactions
  if (user.bot) return;

  // Must be in a guild
  if (!reaction.message.guildId) return;

  // Fetch partials if needed
  if (reaction.partial) {
    try {
      reaction = await reaction.fetch();
    } catch (error) {
      console.error('[HallOfFame] Failed to fetch partial reaction:', error);
      return;
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

  // Ensure message is fully fetched
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
  const channelId = message.channelId;
  const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;

  if (!emojiIdentifier) return;

  // Find board matching this emoji
  const board = getBoardByEmoji(guildId, emojiIdentifier);
  if (!board || !board.enabled) return;

  // Check source channels (empty = all channels)
  if (board.sourceChannelIds.length > 0 && !board.sourceChannelIds.includes(channelId)) {
    return;
  }

  // Check excluded channels
  if (board.excludedChannels.includes(channelId)) {
    return;
  }

  // Check self-react
  if (!board.allowSelfReact && message.author?.id === user.id) {
    return;
  }

  // Don't feature bot messages
  if (message.author?.bot) {
    return;
  }

  // Don't feature messages in the destination channel (prevents loops)
  if (channelId === board.destinationChannelId) {
    return;
  }

  // Get valid reaction count (filtering bots, blacklisted, self-reacts)
  const reactionCount = await getValidReactionCount(message as Message, board);

  // Check if already featured
  const alreadyFeatured = isFeatured(guildId, board.id, message.id);

  if (alreadyFeatured) {
    // Update reaction count
    await updateFeaturedCount(client, guildId, board.id, message.id, reactionCount);
  } else if (reactionCount >= board.minReactions) {
    // Feature the message
    await featureMessage(client, board, message as Message, reactionCount);
  }
};
