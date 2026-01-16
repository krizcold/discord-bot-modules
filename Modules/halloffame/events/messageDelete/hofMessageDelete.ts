/**
 * Hall of Fame - Message Delete Handler
 * Handles featured messages when the original message is deleted
 */

import {
  Client,
  Message,
  PartialMessage,
  GatewayIntentBits,
} from 'discord.js';
import {
  loadFeatured,
  handleOriginalMessageDeleted,
} from '../../manager/boardManager';

export const requiredIntents = [
  GatewayIntentBits.GuildMessages,
];

export default async (
  client: Client,
  message: Message | PartialMessage
) => {
  // Must be in a guild
  if (!message.guildId) return;

  const guildId = message.guildId;
  const messageId = message.id;

  // Find all featured entries for this message
  const featured = loadFeatured(guildId);
  const matchingFeatured = featured.filter(f => f.originalMessageId === messageId);

  if (matchingFeatured.length === 0) return;

  // Process each featured entry (always clean up record, syncDeletes controls featured message behavior)
  for (const entry of matchingFeatured) {
    await handleOriginalMessageDeleted(client, guildId, entry.boardId, messageId);
  }
};
