/**
 * /scheduled-messages command
 *
 * Opens the Scheduled Messages panel (mod only).
 */

import { CommandInteraction, GatewayIntentBits, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { Client } from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { getPanelManager } from '@internal/utils/panelManager';
import { LIST_PANEL_ID } from '../panels/constants';
import { initialize as initButtonHandlers } from '../handlers/buttons';
import { initializeScheduler } from '../manager/scheduler';

const scheduledMessagesCommand: CommandOptions = {
  name: 'scheduled-messages',
  description: 'Manage scheduled messages and announcements',
  devOnly: false,
  testOnly: true,
  dm_permission: false,
  permissionsRequired: [PermissionFlagsBits.ManageMessages],
  requiredIntents: [GatewayIntentBits.Guilds],

  initialize: (client: Client): void => {
    // Register button handlers for modals
    initButtonHandlers(client);

    // Initialize scheduler for existing reminders and groups
    initializeScheduler(client);

    console.log('[Scheduled] Module initialized');
  },

  callback: async (client: Client, interaction: CommandInteraction): Promise<void> => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const panelManager = getPanelManager(client);
      const context = panelManager.createDirectCommandContext(
        LIST_PANEL_ID,
        interaction,
        client
      );

      const response = await panelManager.handlePanelInteraction(context);
      await interaction.reply(response);
    } catch (error) {
      console.error('[Scheduled] Error opening panel:', error);
      await interaction.reply({
        content: 'Failed to open the Scheduled Messages panel.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export = scheduledMessagesCommand;
