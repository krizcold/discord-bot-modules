import {
  Client,
  MessageContextMenuCommandInteraction,
  ApplicationCommandType,
  GatewayIntentBits,
  MessageFlags,
  PermissionsBitField,
} from 'discord.js';
import { ContextMenuCommandOptions } from '@bot/types/commandTypes';
import { getGroupByMessageId } from '../manager/data';
import { getPanelManager } from '@internal/utils/panelManager';
import { PANEL_ID } from '../constants/prefixes';
import { createPendingAssignment, updatePendingAssignment } from '../state';
import { RoleAssignmentGroup } from '../types/roleAssign';

const editRoleAssignmentCommand: ContextMenuCommandOptions<MessageContextMenuCommandInteraction> = {
  name: 'Edit Role Assignment',
  type: ApplicationCommandType.Message,
  testOnly: true,
  dm_permission: false,
  requiredIntents: [GatewayIntentBits.Guilds],
  permissionsRequired: [PermissionsBitField.Flags.ManageRoles],

  callback: async (client: Client, interaction: MessageContextMenuCommandInteraction) => {
    const targetMessage = interaction.targetMessage;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetMessage.author.id !== client.user?.id) {
      await interaction.reply({
        content: 'This is not a message created by me.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const group = getGroupByMessageId(targetMessage.id, guildId);
    if (!group) {
      await interaction.reply({
        content: 'This message is not a role assignment message.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pending = createPendingAssignment(guildId, interaction.user.id);
    updatePendingAssignment(guildId, pending.id, {
      isEditing: true,
      originalGroupId: group.id,
      displayMode: group.displayMode,
      interactionMode: group.interactionMode,
      selectionMode: group.selectionMode,
      embedTitle: group.embedTitle,
      embedDescription: group.embedDescription,
      embedColor: group.embedColor,
      embedThumbnail: group.embedThumbnail,
      embedFooter: group.embedFooter,
      textContent: group.textContent,
      roles: [...group.roles],
    });

    const panelManager = getPanelManager(client);
    const context = panelManager.createDirectCommandContext(PANEL_ID, interaction, client);
    context.data = { pendingId: pending.id, isEditing: true };

    const response = await panelManager.handlePanelInteraction(context);
    await interaction.reply(response);
  },
};

export = editRoleAssignmentCommand;
