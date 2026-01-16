/**
 * Hall of Fame - Channel Lock Handler
 * Enforces content restrictions on locked channels
 *
 * Source channel lock: Only allows specific content types (images, videos, etc.)
 * Destination channel lock: Only allows bot messages (admin exempt)
 */

import {
  Client,
  Message,
  GatewayIntentBits,
  PermissionFlagsBits,
} from 'discord.js';
import { getAllBoards } from '../../manager/boardManager';

export const requiredIntents = [
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

// Content type detection patterns
const CONTENT_PATTERNS = {
  images: /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i,
  videos: /\.(mp4|webm|mov|avi|mkv)$/i,
  audio: /\.(mp3|wav|ogg|flac|m4a)$/i,
  files: /\.[a-z0-9]+$/i, // Any file extension
  links: /https?:\/\/[^\s]+/i,
};

/**
 * Check if a message contains a specific content type
 */
function hasContentType(message: Message, format: string): boolean {
  switch (format) {
    case 'images':
      // Check attachments for images
      if (message.attachments.some(a => a.contentType?.startsWith('image/'))) return true;
      // Check embeds for images
      if (message.embeds.some(e => e.image || e.thumbnail)) return true;
      // Check URL patterns
      if (CONTENT_PATTERNS.images.test(message.content)) return true;
      return false;

    case 'videos':
      // Check attachments for videos
      if (message.attachments.some(a => a.contentType?.startsWith('video/'))) return true;
      // Check embeds for video
      if (message.embeds.some(e => e.video)) return true;
      // Check URL patterns
      if (CONTENT_PATTERNS.videos.test(message.content)) return true;
      return false;

    case 'audio':
      // Check attachments for audio
      if (message.attachments.some(a => a.contentType?.startsWith('audio/'))) return true;
      // Check URL patterns
      if (CONTENT_PATTERNS.audio.test(message.content)) return true;
      return false;

    case 'files':
      // Any attachment counts as a file
      if (message.attachments.size > 0) return true;
      return false;

    case 'links':
      // Check for URLs in content
      if (CONTENT_PATTERNS.links.test(message.content)) return true;
      // Check embeds for URLs
      if (message.embeds.some(e => e.url)) return true;
      return false;

    default:
      return false;
  }
}

/**
 * Check if message matches any of the allowed formats
 */
function matchesAllowedFormats(message: Message, allowedFormats: string[]): boolean {
  if (allowedFormats.length === 0) return true; // No restrictions

  return allowedFormats.some(format => hasContentType(message, format));
}

/**
 * Check if user has permission to bypass locks
 */
async function hasLockBypassPermission(message: Message): Promise<boolean> {
  // Bot messages are always allowed
  if (message.author.bot) return true;

  // Check if user has ManageMessages permission
  const member = message.member || await message.guild?.members.fetch(message.author.id).catch(() => null);
  if (!member) return false;

  return member.permissions.has(PermissionFlagsBits.ManageMessages);
}

export default async (client: Client, message: Message) => {
  // Ignore DMs
  if (!message.guild || !message.guildId) return;

  // Ignore bot messages for source lock (but destination lock handles bots separately)
  const isBot = message.author.bot;

  const guildId = message.guildId;
  const channelId = message.channelId;

  // Get all enabled boards
  const boards = getAllBoards(guildId, true);
  if (boards.length === 0) return;

  // Check each board for lock violations
  for (const board of boards) {
    // Check destination channel lock
    if (board.lockDestinationEnabled && channelId === board.destinationChannelId) {
      // Only bot messages allowed in destination (admins/mods exempt)
      if (!isBot) {
        const canBypass = await hasLockBypassPermission(message);
        if (!canBypass) {
          try {
            await message.delete();
            console.log(`[HallOfFame] Deleted non-bot message in locked destination channel ${channelId}`);
          } catch (error) {
            console.warn(`[HallOfFame] Failed to delete message in locked destination: ${error}`);
          }
          return; // Message deleted, stop processing
        }
      }
    }

    // Check source channel lock
    if (board.lockSourceEnabled && board.lockSourceFormats.length > 0) {
      // Only apply to configured source channels
      const isWatchedChannel = board.sourceChannelIds.length === 0 ||
        board.sourceChannelIds.includes(channelId);

      // Only enforce lock on specifically watched channels, not "all channels" mode
      if (board.sourceChannelIds.length > 0 && isWatchedChannel) {
        // Don't lock bot messages in source
        if (!isBot) {
          const canBypass = await hasLockBypassPermission(message);
          if (!canBypass) {
            // Check if message matches allowed formats
            if (!matchesAllowedFormats(message, board.lockSourceFormats)) {
              try {
                await message.delete();
                console.log(`[HallOfFame] Deleted message without required content type in locked source channel ${channelId}`);
              } catch (error) {
                console.warn(`[HallOfFame] Failed to delete message in locked source: ${error}`);
              }
              return; // Message deleted, stop processing
            }
          }
        }
      }
    }

    // Auto-react to valid messages in watched source channels
    // Only works when specific watch channels are set (not "all channels" mode)
    if (board.autoReact && !isBot && board.sourceChannelIds.length > 0) {
      if (board.sourceChannelIds.includes(channelId)) {
        try {
          await message.react(board.emojiIdentifier);
        } catch (error) {
          console.warn(`[HallOfFame] Failed to auto-react: ${error}`);
        }
      }
    }
  }
};
