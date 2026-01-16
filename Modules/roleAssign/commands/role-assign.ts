import {
  Client,
  CommandInteraction,
  GatewayIntentBits,
  PermissionsBitField,
  MessageFlags,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { getPanelManager } from '@internal/utils/panelManager';
import { registerRoleAssignHandlers, recoverReactionHandlers } from '../handlers/registry';
import { LIST_PANEL_ID } from '../constants/prefixes';

const roleAssignCommand: CommandOptions = {
  name: 'role-assign',
  description: 'Create role assignment messages for self-service role selection.',
  testOnly: true,
  dm_permission: false,
  requiredIntents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  permissionsRequired: [PermissionsBitField.Flags.ManageRoles],

  initialize: (client: Client) => {
    registerRoleAssignHandlers(client);
    recoverReactionHandlers(client);
  },

  callback: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const panelManager = getPanelManager(client);
    const context = panelManager.createDirectCommandContext(LIST_PANEL_ID, interaction, client);
    const response = await panelManager.handlePanelInteraction(context);
    await interaction.reply(response);
  },
};

export = roleAssignCommand;
