/**
 * Hall of Fame Board CRUD Operations
 */

import { randomUUID } from 'crypto';
import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { Board, FeaturedMessage, FeatureHistoryEntry, STATIC_BOARD_DEFAULTS } from '../../types';
import { getDefaultBoardValues } from '../../utils/configUtils';
import {
  boardsCache,
  boardsCacheLoaded,
  featuredCache,
  featuredCacheLoaded,
  invalidateBoardCache,
  invalidateFeaturedCache,
  rebuildEmojiCache,
  getBoardFromEmojiCache,
} from '../cache';

const MODULE_NAME = 'halloffame';
const BOARDS_FILE = 'boards.json';
const FEATURED_FILE = 'featured.json';
const HISTORY_FILE = 'history.json';

// ============================================================================
// BOARD OPERATIONS
// ============================================================================

/**
 * Load all boards for a guild
 */
export function loadBoards(guildId: string, forceReload = false): Board[] {
  if (boardsCacheLoaded.has(guildId) && !forceReload) {
    return boardsCache.get(guildId) || [];
  }

  const boards = loadModuleData<Board[]>(BOARDS_FILE, guildId, MODULE_NAME, []);
  boardsCache.set(guildId, boards);
  boardsCacheLoaded.add(guildId);

  // Rebuild emoji cache after loading
  rebuildEmojiCache(guildId);

  return boards;
}

/**
 * Save all boards for a guild
 */
export function saveBoards(guildId: string, boards: Board[]): void {
  saveModuleData(BOARDS_FILE, guildId, MODULE_NAME, boards);
  boardsCache.set(guildId, boards);
  rebuildEmojiCache(guildId);
}

/**
 * Get a board by ID
 */
export function getBoard(guildId: string, boardId: string): Board | undefined {
  const boards = loadBoards(guildId);
  return boards.find(b => b.id === boardId);
}

/**
 * Get a board by emoji identifier (uses fast cache lookup)
 */
export function getBoardByEmoji(guildId: string, emojiIdentifier: string): Board | undefined {
  // Fast path: check emoji cache
  const cached = getBoardFromEmojiCache(guildId, emojiIdentifier);
  if (cached) return cached;

  // Slow path: load boards and search
  const boards = loadBoards(guildId);
  return boards.find(b => b.emojiIdentifier === emojiIdentifier && b.enabled);
}

/**
 * Check if an emoji is available (not used by another enabled board)
 */
export function isEmojiAvailable(guildId: string, emojiIdentifier: string, excludeBoardId?: string): boolean {
  const boards = loadBoards(guildId);
  return !boards.some(b =>
    b.emojiIdentifier === emojiIdentifier &&
    b.id !== excludeBoardId &&
    b.enabled
  );
}

/**
 * Create a new board
 */
export function createBoard(
  guildId: string,
  userId: string,
  data: Partial<Board>
): Board {
  const configDefaults = getDefaultBoardValues(guildId);

  const board: Board = {
    id: randomUUID(),
    guildId,
    name: data.name || 'New Board',
    emojiIdentifier: data.emojiIdentifier || '',
    emojiDisplay: data.emojiDisplay || '',
    destinationChannelId: data.destinationChannelId || '',
    sourceChannelIds: data.sourceChannelIds || STATIC_BOARD_DEFAULTS.sourceChannelIds!,
    minReactions: data.minReactions ?? configDefaults.minReactions,
    removalThreshold: data.removalThreshold ?? configDefaults.removalThreshold,
    unfeaturedAction: data.unfeaturedAction || STATIC_BOARD_DEFAULTS.unfeaturedAction!,
    allowSelfReact: data.allowSelfReact ?? configDefaults.allowSelfReact,
    syncEdits: data.syncEdits ?? configDefaults.syncEdits,
    syncDeletes: data.syncDeletes ?? configDefaults.syncDeletes,
    autoReact: data.autoReact ?? configDefaults.autoReact,
    excludedChannels: data.excludedChannels || STATIC_BOARD_DEFAULTS.excludedChannels!,
    embedColor: data.embedColor ?? configDefaults.embedColor,
    lockSourceEnabled: data.lockSourceEnabled ?? STATIC_BOARD_DEFAULTS.lockSourceEnabled!,
    lockSourceFormats: data.lockSourceFormats || STATIC_BOARD_DEFAULTS.lockSourceFormats!,
    lockDestinationEnabled: data.lockDestinationEnabled ?? STATIC_BOARD_DEFAULTS.lockDestinationEnabled!,
    enabled: data.enabled ?? STATIC_BOARD_DEFAULTS.enabled!,
    createdAt: Date.now(),
    createdBy: userId,
  };

  const boards = loadBoards(guildId);
  boards.push(board);
  saveBoards(guildId, boards);

  console.log(`[HallOfFame] Created board "${board.name}" (${board.id}) in guild ${guildId}`);
  return board;
}

/**
 * Update an existing board
 */
export function updateBoard(
  guildId: string,
  boardId: string,
  updates: Partial<Board>
): Board | null {
  const boards = loadBoards(guildId);
  const index = boards.findIndex(b => b.id === boardId);

  if (index === -1) return null;

  // Merge updates
  boards[index] = { ...boards[index], ...updates };
  saveBoards(guildId, boards);

  console.log(`[HallOfFame] Updated board "${boards[index].name}" (${boardId}) in guild ${guildId}`);
  return boards[index];
}

/**
 * Delete a board
 */
export function deleteBoard(guildId: string, boardId: string): boolean {
  const boards = loadBoards(guildId);
  const index = boards.findIndex(b => b.id === boardId);

  if (index === -1) return false;

  const deleted = boards.splice(index, 1)[0];
  saveBoards(guildId, boards);

  console.log(`[HallOfFame] Deleted board "${deleted.name}" (${boardId}) from guild ${guildId}`);
  return true;
}

/**
 * Get all boards for a guild
 */
export function getAllBoards(guildId: string, enabledOnly = false): Board[] {
  let boards = loadBoards(guildId);

  if (enabledOnly) {
    boards = boards.filter(b => b.enabled);
  }

  return boards;
}

// ============================================================================
// FEATURED MESSAGE OPERATIONS
// ============================================================================

/**
 * Load featured messages for a guild
 */
export function loadFeatured(guildId: string, forceReload = false): FeaturedMessage[] {
  if (featuredCacheLoaded.has(guildId) && !forceReload) {
    return featuredCache.get(guildId) || [];
  }

  const featured = loadModuleData<FeaturedMessage[]>(FEATURED_FILE, guildId, MODULE_NAME, []);
  featuredCache.set(guildId, featured);
  featuredCacheLoaded.add(guildId);

  return featured;
}

/**
 * Save featured messages for a guild
 */
export function saveFeatured(guildId: string, featured: FeaturedMessage[]): void {
  saveModuleData(FEATURED_FILE, guildId, MODULE_NAME, featured);
  featuredCache.set(guildId, featured);
}

/**
 * Check if a message is featured on a specific board
 */
export function isFeatured(guildId: string, boardId: string, originalMessageId: string): boolean {
  const featured = loadFeatured(guildId);
  return featured.some(f => f.boardId === boardId && f.originalMessageId === originalMessageId);
}

/**
 * Get featured message record
 */
export function getFeaturedMessage(
  guildId: string,
  boardId: string,
  originalMessageId: string
): FeaturedMessage | undefined {
  const featured = loadFeatured(guildId);
  return featured.find(f => f.boardId === boardId && f.originalMessageId === originalMessageId);
}

/**
 * Get featured message by featured message ID
 */
export function getFeaturedByFeaturedId(
  guildId: string,
  featuredMessageId: string
): FeaturedMessage | undefined {
  const featured = loadFeatured(guildId);
  return featured.find(f => f.featuredMessageId === featuredMessageId);
}

/**
 * Get all featured messages for a board
 */
export function getFeaturedForBoard(guildId: string, boardId: string): FeaturedMessage[] {
  const featured = loadFeatured(guildId);
  return featured.filter(f => f.boardId === boardId);
}

/**
 * Add a featured message record
 */
export function addFeaturedMessage(guildId: string, record: FeaturedMessage): void {
  const featured = loadFeatured(guildId);
  featured.push(record);
  saveFeatured(guildId, featured);
}

/**
 * Update a featured message record
 */
export function updateFeaturedMessage(
  guildId: string,
  originalMessageId: string,
  boardId: string,
  updates: Partial<FeaturedMessage>
): boolean {
  const featured = loadFeatured(guildId);
  const index = featured.findIndex(
    f => f.boardId === boardId && f.originalMessageId === originalMessageId
  );

  if (index === -1) return false;

  featured[index] = { ...featured[index], ...updates, lastUpdated: Date.now() };
  saveFeatured(guildId, featured);
  return true;
}

/**
 * Remove a featured message record
 */
export function removeFeaturedMessage(
  guildId: string,
  boardId: string,
  originalMessageId: string
): FeaturedMessage | null {
  const featured = loadFeatured(guildId);
  const index = featured.findIndex(
    f => f.boardId === boardId && f.originalMessageId === originalMessageId
  );

  if (index === -1) return null;

  const removed = featured.splice(index, 1)[0];
  saveFeatured(guildId, featured);
  return removed;
}

/**
 * Get count of featured messages for a board
 */
export function getFeaturedCount(guildId: string, boardId: string): number {
  const featured = loadFeatured(guildId);
  return featured.filter(f => f.boardId === boardId).length;
}

// ============================================================================
// HISTORY OPERATIONS
// ============================================================================

/**
 * Load feature history for a guild
 */
export function loadHistory(guildId: string): FeatureHistoryEntry[] {
  return loadModuleData<FeatureHistoryEntry[]>(HISTORY_FILE, guildId, MODULE_NAME, []);
}

/**
 * Save feature history for a guild
 */
export function saveHistory(guildId: string, history: FeatureHistoryEntry[]): void {
  saveModuleData(HISTORY_FILE, guildId, MODULE_NAME, history);
}

/**
 * Add an entry to feature history
 */
export function addHistoryEntry(guildId: string, entry: FeatureHistoryEntry): void {
  const history = loadHistory(guildId);
  history.push(entry);
  saveHistory(guildId, history);
}

/**
 * Update a history entry (e.g., when unfeatured)
 */
export function updateHistoryEntry(
  guildId: string,
  originalMessageId: string,
  boardId: string,
  updates: Partial<FeatureHistoryEntry>
): boolean {
  const history = loadHistory(guildId);
  // Find the most recent entry for this message/board
  const index = history.findLastIndex(
    h => h.boardId === boardId && h.originalMessageId === originalMessageId && !h.unfeaturedAt
  );

  if (index === -1) return false;

  history[index] = { ...history[index], ...updates };
  saveHistory(guildId, history);
  return true;
}

/**
 * Get history for a specific board
 */
export function getHistoryForBoard(guildId: string, boardId: string): FeatureHistoryEntry[] {
  const history = loadHistory(guildId);
  return history.filter(h => h.boardId === boardId);
}
