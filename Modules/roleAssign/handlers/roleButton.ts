import { Client, ButtonInteraction, GuildMember, MessageFlags } from 'discord.js';
import { getGroupByMessageId } from '../manager/data';
import { botCanAssignRole } from '../utils/roleValidation';
import { RA_ROLE_BTN_PREFIX } from '../constants/prefixes';
import { getRoleAddedMessage, getRoleRemovedMessage, getAlreadyHasRoleMessage } from '../utils/feedbackMessages';

export async function handleRoleButtonClick(
  client: Client,
  interaction: ButtonInteraction,
  userLevel: number
): Promise<void> {
  const { customId, guildId, member } = interaction;

  if (!guildId || !(member instanceof GuildMember)) {
    await interaction.reply({
      content: 'This can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Parse customId: ra_btn_{groupId}_{roleId}
  const withoutPrefix = customId.slice(RA_ROLE_BTN_PREFIX.length + 1);
  const underscoreIdx = withoutPrefix.indexOf('_');
  if (underscoreIdx === -1) {
    await interaction.reply({
      content: 'Invalid button format.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupId = withoutPrefix.slice(0, underscoreIdx);
  const roleId = withoutPrefix.slice(underscoreIdx + 1);

  const group = getGroupByMessageId(interaction.message.id, guildId);
  if (!group) {
    await interaction.reply({
      content: 'This role assignment is no longer active.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!group.roles.some(r => r.roleId === roleId)) {
    await interaction.reply({
      content: 'This role is no longer available.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!botCanAssignRole(interaction.guild!, roleId)) {
    await interaction.reply({
      content: 'I cannot assign this role. It may be above my highest role.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hasRole = member.roles.cache.has(roleId);
  const role = interaction.guild!.roles.cache.get(roleId);

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (hasRole) {
      await member.roles.remove(roleId);
      const msg = role ? getRoleRemovedMessage(guildId, role, interaction.user) : null;
      await interaction.editReply({ content: msg || `Removed <@&${roleId}>` });
    } else {
      if (group.selectionMode === 'single') {
        const hasAnyGroupRole = group.roles.some(r => member.roles.cache.has(r.roleId));
        if (hasAnyGroupRole) {
          const msg = getAlreadyHasRoleMessage(guildId);
          await interaction.editReply({
            content: msg || 'You already have a role from this group.',
          });
          return;
        }
      }

      if (group.selectionMode === 'exclusive') {
        const rolesToRemove = group.roles
          .map(r => r.roleId)
          .filter(id => id !== roleId && member.roles.cache.has(id));

        if (rolesToRemove.length > 0) {
          await member.roles.remove(rolesToRemove);
        }
      }

      await member.roles.add(roleId);
      const msg = role ? getRoleAddedMessage(guildId, role, interaction.user) : null;
      await interaction.editReply({ content: msg || `Added <@&${roleId}>` });
    }
  } catch (error) {
    console.error('[RoleAssign] Error toggling role:', error);
    try {
      await interaction.editReply({
        content: 'Failed to update your roles. Please try again.',
      });
    } catch {}
  }
}
