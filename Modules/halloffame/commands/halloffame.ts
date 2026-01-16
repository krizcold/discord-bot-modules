import {
  Client,
  CommandInteraction,
  GatewayIntentBits,
  PermissionsBitField,
  MessageFlags,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { getPanelManager } from '@internal/utils/panelManager';
import { storeNavigationContext } from '@internal/utils/panel/panelButtonHandler';
import { registerHofHandlers } from '../handlers/registry';
import { HOF_PANEL_ID } from '../constants';

const halloffameCommand: CommandOptions = {
  name: 'halloffame',
  description: 'Manage Hall of Fame boards for this server.',
  testOnly: true,
  dm_permission: false,
  requiredIntents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  permissionsRequired: [PermissionsBitField.Flags.ManageGuild],

  initialize: (client: Client) => {
    // Register button/modal handlers
    registerHofHandlers(client);
  },

  callback: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const panelManager = getPanelManager(client);
    const context = panelManager.createDirectCommandContext(HOF_PANEL_ID, interaction, client);
    const response = await panelManager.handlePanelInteraction(context);

    await interaction.reply(response);

    // Store navigation context for the initial reply
    if (interaction.replied) {
      const reply = await interaction.fetchReply();
      storeNavigationContext(reply.id, context.navigationStack || [], context.accessMethod);
    }
  },
};

export = halloffameCommand;
