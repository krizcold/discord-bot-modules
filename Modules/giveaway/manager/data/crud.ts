import { Giveaway } from '@bot/types/commandTypes';
import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { giveawaysCache, cacheLoaded, activeTimers } from '../cache';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/**
 * Load giveaways from data manager (guild-specific)
 */
function loadGiveaways(guildId: string, forceReload = false): Giveaway[] {
  if (cacheLoaded.has(guildId) && !forceReload) {
    return giveawaysCache.get(guildId) || [];
  }

  const giveaways: Giveaway[] = loadModuleData('giveaways.json', guildId, 'giveaway', []);

  giveawaysCache.set(guildId, giveaways);
  cacheLoaded.add(guildId);

  return giveaways;
}

/**
 * Save giveaways to data manager (guild-specific)
 */
function saveGiveaways(guildId: string): void {
  const giveaways = giveawaysCache.get(guildId) || [];
  saveModuleData('giveaways.json', guildId, 'giveaway', giveaways);
}

export function addGiveaway(giveawayData: Giveaway, guildId: string): Giveaway | null {
  const giveaways = loadGiveaways(guildId);

  if (giveaways.some(g => g.id === giveawayData.id)) {
    logger.warn(`Rejected giveaway with duplicate ID: ${giveawayData.id}`);
    return null;
  }
  if (giveawayData.entryMode === 'trivia' && (giveawayData.maxTriviaAttempts === undefined || giveawayData.maxTriviaAttempts === 0)) {
    giveawayData.maxTriviaAttempts = -1;
  }

  giveaways.push(giveawayData);
  giveawaysCache.set(guildId, giveaways);
  saveGiveaways(guildId);

  logger.info(`Added new giveaway: ${giveawayData.id} (${giveawayData.title})`);
  return giveawayData;
}

export function getGiveaway(giveawayId: string, guildId: string): Giveaway | undefined {
  const giveaways = loadGiveaways(guildId);
  return giveaways.find(g => g.id === giveawayId);
}

export function updateGiveaway(giveawayId: string, updatedData: Partial<Giveaway>, guildId: string): boolean {
  const giveaways = loadGiveaways(guildId);

  const index = giveaways.findIndex(g => g.id === giveawayId);
  if (index === -1) return false;

  giveaways[index] = { ...giveaways[index], ...updatedData };
  giveawaysCache.set(guildId, giveaways);
  saveGiveaways(guildId);

  return true;
}

export function removeGiveaway(giveawayId: string, guildId: string): boolean {
  const giveaways = loadGiveaways(guildId);

  const initialLength = giveaways.length;
  const filtered = giveaways.filter(g => g.id !== giveawayId);

  if (activeTimers.has(giveawayId)) {
    clearTimeout(activeTimers.get(giveawayId));
    activeTimers.delete(giveawayId);
  }

  if (filtered.length < initialLength) {
    giveawaysCache.set(guildId, filtered);
    saveGiveaways(guildId);
    return true;
  }
  return false;
}

export function getAllGiveaways(guildId: string, activeOnly = false): Giveaway[] {
  let filtered = loadGiveaways(guildId);

  if (activeOnly) {
    const now = Date.now();
    filtered = filtered.filter(g => !g.ended && !g.cancelled && g.endTime > now);
  }

  // Sort by startTime descending (newer first)
  return filtered.sort((a, b) => b.startTime - a.startTime);
}

export function addParticipant(giveawayId: string, userId: string, guildId: string): boolean {
  const giveaway = getGiveaway(giveawayId, guildId);
  if (!giveaway || giveaway.ended || giveaway.cancelled || giveaway.endTime <= Date.now()) return false;
  if (giveaway.participants.includes(userId)) return false;
  giveaway.participants.push(userId);
  return updateGiveaway(giveawayId, { participants: giveaway.participants }, guildId);
}
