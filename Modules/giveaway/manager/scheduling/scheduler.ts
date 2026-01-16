import { Client } from 'discord.js';
import { Giveaway } from '@bot/types/commandTypes';
import { unregisterReactionHandler } from '@internal/events/messageReactionAdd/reactionHandler';
import { listGuilds, loadModuleData } from '@internal/utils/dataManager';
import { getGiveaway } from '../data/crud';
import { activeTimers, giveawaysCache } from '../cache';
import { processEndedGiveaway } from './ending';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

export function scheduleGiveawayEnd(client: Client, giveaway: Giveaway): void {
  if (giveaway.ended || giveaway.cancelled) {
    // Ensure reaction handler is cleaned up if somehow missed
    if (giveaway.entryMode === 'reaction' && giveaway.messageId) {
      unregisterReactionHandler(client, giveaway.messageId);
    }
    return;
  }

  const timeRemaining = giveaway.endTime - Date.now();
  const guildId = giveaway.guildId;
  const MAX_TIMEOUT = 2147483647; // ~24.8 days - setTimeout max value

  if (timeRemaining <= 0) {
    logger.info(`Giveaway ${giveaway.id} end time passed, processing immediately`);
    processEndedGiveaway(client, giveaway.id, guildId).catch(err => logger.error('Failed to process ended giveaway:', err));
  } else if (timeRemaining > MAX_TIMEOUT) {
    // For giveaways longer than 24.8 days, schedule a re-check instead
    logger.info(`Giveaway ${giveaway.id} duration exceeds max timeout, scheduling re-check`);
    if (activeTimers.has(giveaway.id)) {
      clearTimeout(activeTimers.get(giveaway.id));
    }
    const timer = setTimeout(() => {
      // Re-check the giveaway after 24 days (it will reschedule if still pending)
      const updatedGiveaway = getGiveaway(giveaway.id, guildId);
      if (updatedGiveaway && !updatedGiveaway.ended && !updatedGiveaway.cancelled) {
        scheduleGiveawayEnd(client, updatedGiveaway);
      }
      activeTimers.delete(giveaway.id);
    }, MAX_TIMEOUT);
    activeTimers.set(giveaway.id, timer);
  } else {
    if (activeTimers.has(giveaway.id)) {
      clearTimeout(activeTimers.get(giveaway.id));
    }
    const timer = setTimeout(() => {
      processEndedGiveaway(client, giveaway.id, guildId).catch(err => logger.error('Failed to process ended giveaway:', err));
      activeTimers.delete(giveaway.id);
    }, timeRemaining);
    activeTimers.set(giveaway.id, timer);
    logger.info(`Scheduled end for giveaway ${giveaway.id} in ${Math.round(timeRemaining / 1000)}s`);
  }
}

export function scheduleExistingGiveaways(client: Client): void {
  logger.info('Scheduling ends for existing active giveaways...');

  let scheduledCount = 0;
  let processedImmediatelyCount = 0;

  // Use dataManager to list guilds with data (no Discord connection needed)
  const guildsWithData = listGuilds();

  for (const guildId of guildsWithData) {
    const giveaways = loadModuleData<Giveaway[]>('giveaways.json', guildId, 'giveaway', []).filter((g: Giveaway) => !g.ended && !g.cancelled);

    for (const giveaway of giveaways) {
      if (giveaway.endTime > Date.now()) {
        scheduleGiveawayEnd(client, giveaway);
        scheduledCount++;
      } else {
        // If endtime is past, but it wasn't marked ended (e.g. bot restart)
        logger.info(`Giveaway ${giveaway.id} ended while offline, processing now`);
        processEndedGiveaway(client, giveaway.id, guildId).catch(err => logger.error('Failed to process overdue giveaway:', err));
        processedImmediatelyCount++;
      }
    }
  }

  logger.info(`Scheduled ${scheduledCount} future giveaways, processed ${processedImmediatelyCount} overdue`);
}
