/**
 * /responses command
 *
 * Opens the Response Manager panel.
 */

import { CommandInteraction, GatewayIntentBits, PermissionFlagsBits, MessageFlags, Client } from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { getPanelManager } from '@internal/utils/panelManager';
import { LIST_PANEL_ID } from '../panels/constants';

const responsesCommand: CommandOptions = {
  name: 'response-manager',
  description: 'Configure automatic message responses',
  devOnly: false,
  testOnly: true,
  dm_permission: false,
  permissionsRequired: [PermissionFlagsBits.ManageGuild],
  requiredIntents: [GatewayIntentBits.Guilds],

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
      console.error('[ResponseManager] Error opening panel:', error);
      await interaction.reply({
        content: 'Failed to open the Response Manager panel.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export = responsesCommand;
