/**
 * Response Manager - History Manager
 *
 * Tracks bot responses for lookup by reply-based triggers.
 * Stores a FIFO queue of recent responses per guild.
 */

import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { getMergedConfig } from '@internal/utils/configManager';
import { ResponseHistoryEntry, ResponseHistoryStorage, ResponseType } from '../types/responseManager';

const MODULE_NAME = 'response-manager';
const HISTORY_FILE = 'history.json';
const CONFIG_FILE = 'response-manager-config.json';
const DEFAULT_MAX_ENTRIES = 10;

/**
 * Get max history entries from config
 */
function getMaxHistoryEntries(guildId: string): number {
  const config = getMergedConfig(CONFIG_FILE, guildId);
  return config.properties?.maxHistoryEntries?.value ?? DEFAULT_MAX_ENTRIES;
}

/**
 * Load history for a guild
 */
function loadHistory(guildId: string): ResponseHistoryStorage {
  return loadModuleData<ResponseHistoryStorage>(
    HISTORY_FILE,
    guildId,
    MODULE_NAME,
    { entries: [] }
  );
}

/**
 * Save history for a guild
 */
function saveHistory(guildId: string, storage: ResponseHistoryStorage): void {
  saveModuleData(HISTORY_FILE, guildId, MODULE_NAME, storage);
}

/**
 * Record a response in history
 */
export function recordResponse(
  guildId: string,
  entry: Omit<ResponseHistoryEntry, 'timestamp'>
): void {
  const storage = loadHistory(guildId);
  const maxEntries = getMaxHistoryEntries(guildId);

  const newEntry: ResponseHistoryEntry = {
    ...entry,
    timestamp: Date.now(),
  };

  // Add to front (most recent first)
  storage.entries.unshift(newEntry);

  // Prune if over limit
  if (storage.entries.length > maxEntries) {
    storage.entries = storage.entries.slice(0, maxEntries);
  }

  saveHistory(guildId, storage);
}

/**
 * Lookup a message in history by message ID
 * Returns the history entry if found, null otherwise
 */
export function lookupByMessageId(
  guildId: string,
  messageId: string
): ResponseHistoryEntry | null {
  const storage = loadHistory(guildId);
  return storage.entries.find(e => e.messageId === messageId) || null;
}

/**
 * Lookup a message in history by channel ID (most recent in that channel)
 */
export function lookupByChannelId(
  guildId: string,
  channelId: string
): ResponseHistoryEntry | null {
  const storage = loadHistory(guildId);
  return storage.entries.find(e => e.channelId === channelId) || null;
}

/**
 * Get all history entries for a guild
 */
export function getHistory(guildId: string): ResponseHistoryEntry[] {
  return loadHistory(guildId).entries;
}

/**
 * Clear all history for a guild
 */
export function clearHistory(guildId: string): void {
  saveHistory(guildId, { entries: [] });
}

/**
 * Remove entries older than a certain age (in milliseconds)
 */
export function pruneOldEntries(guildId: string, maxAgeMs: number): number {
  const storage = loadHistory(guildId);
  const now = Date.now();
  const originalLength = storage.entries.length;

  storage.entries = storage.entries.filter(e => (now - e.timestamp) < maxAgeMs);

  if (storage.entries.length !== originalLength) {
    saveHistory(guildId, storage);
  }

  return originalLength - storage.entries.length;
}
