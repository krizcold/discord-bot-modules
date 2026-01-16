/**
 * Hall of Fame Board Manager
 * Main export file for all board management functions
 */

// Board CRUD operations
export {
  loadBoards,
  saveBoards,
  getBoard,
  getBoardByEmoji,
  isEmojiAvailable,
  createBoard,
  updateBoard,
  deleteBoard,
  getAllBoards,
  // Featured message operations
  loadFeatured,
  saveFeatured,
  isFeatured,
  getFeaturedMessage,
  getFeaturedByFeaturedId,
  getFeaturedForBoard,
  addFeaturedMessage,
  updateFeaturedMessage,
  removeFeaturedMessage,
  getFeaturedCount,
  // History operations
  loadHistory,
  saveHistory,
  addHistoryEntry,
  updateHistoryEntry,
  getHistoryForBoard,
} from './data/crud';

// Feature handling
export {
  featureMessage,
  updateFeaturedCount,
  unfeatureMessage,
  handleOriginalMessageDeleted,
  handleOriginalMessageEdited,
  getValidReactionCount,
} from './featureHandler';

// Cache utilities
export {
  invalidateBoardCache,
  invalidateFeaturedCache,
  rebuildEmojiCache,
} from './cache';

// Sync utilities
export {
  syncBoard,
  syncGuild,
  syncAllGuilds,
} from './syncHandler';
