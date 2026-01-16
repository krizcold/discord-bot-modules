/**
 * Hall of Fame - Startup Sync
 * Syncs featured messages and adds missing reactions on bot startup
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { syncAllGuilds } from '../../manager/boardManager';

export const requiredIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
];

export default async (client: Client) => {
  // Delay slightly to ensure all caches are populated
  setTimeout(async () => {
    try {
      await syncAllGuilds(client);
    } catch (error) {
      console.error('[HallOfFame] Startup sync failed:', error);
    }
  }, 5000);
};
