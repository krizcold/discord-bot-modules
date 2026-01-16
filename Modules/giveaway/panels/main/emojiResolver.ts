/**
 * Box Emoji Resolution
 * Resolves custom Discord emojis for decorative box drawing with fallbacks
 */

import type { Client, ApplicationEmoji, GuildEmoji, Collection } from 'discord.js';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

// Box drawing emoji names (custom Discord emojis) with ASCII fallbacks
export const BOX_EMOJI_CONFIG = {
  ul: { name: 'ul', fallback: '┌' },   // Upper left corner
  uh: { name: 'uh', fallback: '─' },   // Upper horizontal
  ca: { name: 'ca', fallback: '─' },   // Center decoration A
  cb: { name: 'cb', fallback: '─' },   // Center decoration B
  ur: { name: 'ur', fallback: '┐' },   // Upper right corner
  dl: { name: 'dl', fallback: '└' },   // Down left corner
  dh: { name: 'dh', fallback: '─' },   // Down horizontal
  dr: { name: 'dr', fallback: '┘' },   // Down right corner
} as const;

export type BoxEmojiKey = keyof typeof BOX_EMOJI_CONFIG;

// Cache resolved emojis to avoid repeated lookups
let resolvedBoxEmojis: Record<string, string> | null = null;
let cacheHasAllEmojis = false;

/**
 * Resolve box emoji names to full Discord format using bot's emoji cache
 * Checks both application emojis (bot's own) and guild emojis
 */
export async function resolveBoxEmojis(client: Client): Promise<void> {
  if (resolvedBoxEmojis && cacheHasAllEmojis) return;

  resolvedBoxEmojis = {};
  cacheHasAllEmojis = true;

  // Try to fetch application emojis (bot's own emojis)
  let appEmojis: Collection<string, ApplicationEmoji> | null = null;
  try {
    if (client.application) {
      const fetched = await client.application.emojis.fetch();
      appEmojis = fetched;
      logger.debug(`Application emojis fetched: ${fetched.size}`);
    }
  } catch (err) {
    logger.warn('Could not fetch application emojis:', err);
  }

  for (const [key, config] of Object.entries(BOX_EMOJI_CONFIG)) {
    const emojiName = config.name;
    const fallback = config.fallback;

    // First check application emojis
    let emoji: ApplicationEmoji | GuildEmoji | undefined;
    emoji = appEmojis?.find(e => e.name === emojiName);

    // Fall back to guild emojis
    if (!emoji) {
      emoji = client.emojis.cache.find(e => e.name === emojiName);
    }

    if (emoji) {
      resolvedBoxEmojis![key] = emoji.toString();
    } else {
      resolvedBoxEmojis![key] = fallback;
      cacheHasAllEmojis = false;
    }
  }
}

/**
 * Get box emoji (must call resolveBoxEmojis first)
 */
export function getBoxEmoji(name: BoxEmojiKey): string {
  return resolvedBoxEmojis?.[name] || BOX_EMOJI_CONFIG[name].fallback;
}

/**
 * Clear emoji cache (call if emojis are updated)
 */
export function clearBoxEmojiCache(): void {
  resolvedBoxEmojis = null;
  cacheHasAllEmojis = false;
}

/**
 * Debug function to check emoji availability
 */
export function debugBoxEmojis(client: Client): string[] {
  const results: string[] = [];
  const neededEmojis = Object.entries(BOX_EMOJI_CONFIG);

  results.push(`Total emojis in bot cache: ${client.emojis.cache.size}`);
  results.push(`Looking for: ${neededEmojis.map(([, c]) => c.name).join(', ')}`);

  for (const [, config] of neededEmojis) {
    const emoji = client.emojis.cache.find(e => e.name === config.name);
    if (emoji) {
      results.push(`✓ ${config.name}: ${emoji.toString()} (ID: ${emoji.id})`);
    } else {
      results.push(`✗ ${config.name}: NOT FOUND (fallback: ${config.fallback})`);
    }
  }

  // Show first 10 emojis the bot can see
  results.push(`\nSample emojis in cache:`);
  let count = 0;
  for (const [, emoji] of client.emojis.cache) {
    if (count >= 10) break;
    results.push(`  - ${emoji.name}: ${emoji.toString()}`);
    count++;
  }

  return results;
}
