/**
 * Hall of Fame - Message Update Handler
 * Syncs edits to featured messages when syncEdits is enabled
 */

import {
  Client,
  Message,
  PartialMessage,
  GatewayIntentBits,
} from 'discord.js';
import {
  loadFeatured,
  getBoard,
  handleOriginalMessageEdited,
} from '../../manager/boardManager';

export const requiredIntents = [
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

export default async (
  client: Client,
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage
) => {
  // Must be in a guild
  if (!newMessage.guildId) return;

  // Ignore bot messages
  if (newMessage.author?.bot) return;

  // Content must have changed (not just embed updates)
  if (oldMessage.content === newMessage.content) return;

  // Fetch full message if partial
  let message = newMessage;
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch (error) {
      console.error('[HallOfFame] Failed to fetch partial message on update:', error);
      return;
    }
  }

  const guildId = message.guildId!;

  // Find all featured entries for this message
  const featured = loadFeatured(guildId);
  const matchingFeatured = featured.filter(f => f.originalMessageId === message.id);

  if (matchingFeatured.length === 0) return;

  // Process each featured entry
  for (const entry of matchingFeatured) {
    const board = getBoard(guildId, entry.boardId);
    if (!board || !board.enabled || !board.syncEdits) continue;

    await handleOriginalMessageEdited(client, guildId, board.id, message as Message);
  }
};
