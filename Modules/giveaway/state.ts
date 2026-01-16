import { randomUUID } from 'crypto';
import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { StoredPendingGiveaway, PendingGiveawayData } from './types';
import { isGiveawayReady } from './utils/validationUtils';

const MODULE_NAME = 'giveaway';
const PENDING_FILE = 'pending-giveaways.json';

/**
 * Load all pending giveaways for a guild
 */
export function loadPendingGiveaways(guildId: string): StoredPendingGiveaway[] {
  const data = loadModuleData<StoredPendingGiveaway[]>(PENDING_FILE, guildId, MODULE_NAME, []);
  return data;
}

/**
 * Save all pending giveaways for a guild
 */
function savePendingGiveaways(guildId: string, giveaways: StoredPendingGiveaway[]): void {
  saveModuleData(PENDING_FILE, guildId, MODULE_NAME, giveaways);
}

/**
 * Get a single pending giveaway by ID
 */
export function getPendingGiveaway(guildId: string, pendingId: string): StoredPendingGiveaway | null {
  const giveaways = loadPendingGiveaways(guildId);
  return giveaways.find(g => g.id === pendingId) || null;
}

/**
 * Create a new pending giveaway with default values
 */
export function createPendingGiveaway(guildId: string, userId: string): StoredPendingGiveaway {
  const pending: StoredPendingGiveaway = {
    id: randomUUID(),
    guildId,
    createdAt: Date.now(),
    createdBy: userId,
    status: 'draft',
    title: 'Untitled Giveaway',
    prizes: [],
    durationMs: 3600000, // 1 hour default
    winnerCount: 1,
    entryMode: 'button',
    participants: [],
    winners: [],
    ended: false,
    cancelled: false
  };

  const giveaways = loadPendingGiveaways(guildId);
  giveaways.push(pending);
  savePendingGiveaways(guildId, giveaways);

  return pending;
}

/**
 * Update a pending giveaway
 */
export function updatePendingGiveaway(
  guildId: string,
  pendingId: string,
  updates: Partial<StoredPendingGiveaway>
): StoredPendingGiveaway | null {
  const giveaways = loadPendingGiveaways(guildId);
  const index = giveaways.findIndex(g => g.id === pendingId);

  if (index === -1) {
    return null;
  }

  // Merge updates
  giveaways[index] = { ...giveaways[index], ...updates };

  // Auto-determine status based on required fields using shared validation
  // Only auto-update status if not manually set to 'ready'
  if (updates.status !== 'ready') {
    giveaways[index].status = isGiveawayReady(giveaways[index]) ? 'ready' : 'draft';
  }

  savePendingGiveaways(guildId, giveaways);
  return giveaways[index];
}

/**
 * Delete a pending giveaway
 */
export function deletePendingGiveaway(guildId: string, pendingId: string): boolean {
  const giveaways = loadPendingGiveaways(guildId);
  const index = giveaways.findIndex(g => g.id === pendingId);

  if (index === -1) {
    return false;
  }

  giveaways.splice(index, 1);
  savePendingGiveaways(guildId, giveaways);
  return true;
}

/**
 * Get all "ready" pending giveaways (ready to start)
 */
export function getReadyGiveaways(guildId: string): StoredPendingGiveaway[] {
  const giveaways = loadPendingGiveaways(guildId);
  return giveaways.filter(g => g.status === 'ready');
}

/**
 * Check if a pending giveaway has a prize set
 */
export function hasPrizeSet(pending: StoredPendingGiveaway | null): boolean {
  if (!pending) return false;
  const prize = pending.prizes?.[0];
  return !!(prize && prize.trim().length > 0);
}

/**
 * Check if a pending giveaway is ready to start
 */
export function isPendingReady(pending: StoredPendingGiveaway | null): boolean {
  if (!pending) return false;
  return pending.status === 'ready';
}
