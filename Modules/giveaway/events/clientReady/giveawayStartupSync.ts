// Giveaway Startup Sync - Schedules existing giveaways and processes overdue ones on bot startup

import { Client } from 'discord.js';
import { scheduleExistingGiveaways } from '../../manager/giveawayManager';

export default async function giveawayStartupSync(client: Client): Promise<void> {
  // Schedule all existing active giveaways and process any that ended while bot was offline
  scheduleExistingGiveaways(client);
}
