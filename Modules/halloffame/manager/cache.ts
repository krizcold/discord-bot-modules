/**
 * Hall of Fame Cache System
 * In-memory caching for boards and featured messages to optimize reaction handling
 */

import { Board, FeaturedMessage } from '../types';

// Guild ID -> Board[]
export const boardsCache = new Map<string, Board[]>();
export const boardsCacheLoaded = new Set<string>();

// Guild ID -> FeaturedMessage[]
export const featuredCache = new Map<string, FeaturedMessage[]>();
export const featuredCacheLoaded = new Set<string>();

// Fast emoji lookup: "guildId:emojiIdentifier" -> Board
export const emojiToBoardCache = new Map<string, Board>();

/**
 * Invalidate board cache for a guild and rebuild emoji cache
 */
export function invalidateBoardCache(guildId: string): void {
  boardsCache.delete(guildId);
  boardsCacheLoaded.delete(guildId);
  // Clear emoji cache entries for this guild
  clearEmojiCacheForGuild(guildId);
}

/**
 * Invalidate featured cache for a guild
 */
export function invalidateFeaturedCache(guildId: string): void {
  featuredCache.delete(guildId);
  featuredCacheLoaded.delete(guildId);
}

/**
 * Clear emoji lookup cache entries for a specific guild
 */
function clearEmojiCacheForGuild(guildId: string): void {
  const prefix = `${guildId}:`;
  for (const key of emojiToBoardCache.keys()) {
    if (key.startsWith(prefix)) {
      emojiToBoardCache.delete(key);
    }
  }
}

/**
 * Rebuild emoji lookup cache for a guild from cached boards
 */
export function rebuildEmojiCache(guildId: string): void {
  // Clear existing entries for this guild
  clearEmojiCacheForGuild(guildId);

  // Add current enabled boards
  const boards = boardsCache.get(guildId) || [];
  for (const board of boards) {
    if (board.enabled) {
      const key = `${guildId}:${board.emojiIdentifier}`;
      emojiToBoardCache.set(key, board);
    }
  }
}

/**
 * Get board by emoji identifier from cache (fast path)
 * Returns undefined if not in cache
 */
export function getBoardFromEmojiCache(guildId: string, emojiIdentifier: string): Board | undefined {
  const key = `${guildId}:${emojiIdentifier}`;
  return emojiToBoardCache.get(key);
}

/**
 * Update a single board in the emoji cache
 */
export function updateEmojiCacheEntry(board: Board): void {
  const key = `${board.guildId}:${board.emojiIdentifier}`;
  if (board.enabled) {
    emojiToBoardCache.set(key, board);
  } else {
    emojiToBoardCache.delete(key);
  }
}

/**
 * Remove a board from the emoji cache
 */
export function removeFromEmojiCache(guildId: string, emojiIdentifier: string): void {
  const key = `${guildId}:${emojiIdentifier}`;
  emojiToBoardCache.delete(key);
}
