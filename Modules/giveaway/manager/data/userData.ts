import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { UserGiveawayData } from '../types';

/**
 * Load user giveaway data (guild-specific, module-namespaced)
 */
function loadUserGiveawayData(guildId: string): UserGiveawayData {
  return loadModuleData('userGiveawayData.json', guildId, 'giveaway', {});
}

/**
 * Save user giveaway data (guild-specific, module-namespaced)
 */
function saveUserGiveawayData(data: UserGiveawayData, guildId: string): void {
  saveModuleData('userGiveawayData.json', guildId, 'giveaway', data);
}

export function getUserTriviaAttempts(giveawayId: string, userId: string, guildId: string): number {
  const data = loadUserGiveawayData(guildId);
  return data[giveawayId]?.[userId]?.triviaAttemptsMade || 0;
}

export function incrementUserTriviaAttempts(giveawayId: string, userId: string, guildId: string): number {
  const data = loadUserGiveawayData(guildId);
  if (!data[giveawayId]) data[giveawayId] = {};
  if (!data[giveawayId][userId]) data[giveawayId][userId] = { triviaAttemptsMade: 0 };

  data[giveawayId][userId].triviaAttemptsMade = (data[giveawayId][userId].triviaAttemptsMade || 0) + 1;
  saveUserGiveawayData(data, guildId);
  return data[giveawayId][userId].triviaAttemptsMade!;
}
