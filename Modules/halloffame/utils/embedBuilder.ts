/**
 * Hall of Fame Embed Builder
 * Builds embeds for featured messages
 */

import { EmbedBuilder, Message } from 'discord.js';
import { Board } from '../types';

/**
 * Build a featured message embed
 */
export function buildFeaturedEmbed(
  message: Message,
  board: Board,
  reactionCount: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(board.embedColor)
    .setAuthor({
      name: message.author.displayName || message.author.username,
      iconURL: message.author.displayAvatarURL(),
    })
    .setTimestamp(message.createdAt)
    .setFooter({ text: `${board.emojiDisplay} ${reactionCount}` });

  // Add message content if exists
  if (message.content) {
    // Truncate if too long (embed description max is 4096)
    const content = message.content.length > 2000
      ? message.content.slice(0, 1997) + '...'
      : message.content;
    embed.setDescription(content);
  }

  // Add first image attachment if exists
  const imageAttachment = message.attachments.find(a =>
    a.contentType?.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name || '')
  );
  if (imageAttachment) {
    embed.setImage(imageAttachment.url);
  }

  // Add embed image from message embeds (e.g., links with previews)
  if (!imageAttachment && message.embeds.length > 0) {
    const embedWithImage = message.embeds.find(e => e.image?.url || e.thumbnail?.url);
    if (embedWithImage) {
      const imageUrl = embedWithImage.image?.url || embedWithImage.thumbnail?.url;
      if (imageUrl) {
        embed.setImage(imageUrl);
      }
    }
  }

  // Add jump link field
  embed.addFields({
    name: 'Source',
    value: `[Jump to message](${message.url})`,
    inline: true,
  });

  // Add channel info
  embed.addFields({
    name: 'Channel',
    value: `<#${message.channelId}>`,
    inline: true,
  });

  return embed;
}

/**
 * Build an "unfeatured" message embed (when using edit action)
 */
export function buildUnfeaturedEmbed(
  board: Board,
  originalAuthorId: string,
  reason: string = 'Reactions dropped below threshold'
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x808080) // Gray
    .setDescription(`*This message is no longer featured.*\n-# ${reason}`)
    .setFooter({ text: `${board.emojiDisplay} Board: ${board.name}` })
    .setTimestamp();
}

/**
 * Update reaction count in footer
 */
export function updateEmbedReactionCount(
  embed: EmbedBuilder,
  board: Board,
  newCount: number
): EmbedBuilder {
  return EmbedBuilder.from(embed.toJSON())
    .setFooter({ text: `${board.emojiDisplay} ${newCount}` });
}

/**
 * Build embed for message that was deleted
 */
export function buildDeletedMessageEmbed(
  board: Board,
  originalAuthorId: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x808080) // Gray
    .setDescription(`*The original message was deleted.*`)
    .setFooter({ text: `${board.emojiDisplay} Board: ${board.name}` })
    .setTimestamp();
}
