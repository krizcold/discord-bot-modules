/**
 * Hall of Fame Handler Registry
 * Registers all button and modal handlers for the module
 */

import { Client } from 'discord.js';

/**
 * Register all Hall of Fame handlers
 */
export function registerHofHandlers(client: Client): void {
  // Close button uses admin_panel_close (handled by admin panel system)
  // All panel buttons go through the panel's handleButton method
  console.log('[HallOfFame] Registered handlers');
}
