import { Client, MessageReaction, User } from 'discord.js';
import { RegisteredReactionInfo } from '@bot/types/commandTypes';
import { RoleAssignmentGroup } from '../types/roleAssign';
import { botCanAssignRole } from '../utils/roleValidation';
import { getRoleAddedMessage, getRoleRemovedMessage, getAlreadyHasRoleMessage, isReactionDMEnabled } from '../utils/feedbackMessages';

async function sendDMFeedback(user: User, content: string, guildId: string): Promise<void> {
  if (!isReactionDMEnabled(guildId)) return;
  try {
    await user.send({ content });
  } catch {}
}

export async function handleRoleReaction(
  client: Client,
  reaction: MessageReaction,
  user: User,
  self: RegisteredReactionInfo,
  group: RoleAssignmentGroup,
  roleId: string
): Promise<void> {
  const guild = reaction.message.guild;
  if (!guild) return;

  if (!botCanAssignRole(guild, roleId)) {
    return;
  }

  const isPersistent = group.reactionPersist !== 'clear';
  const role = guild.roles.cache.get(roleId);

  try {
    const member = await guild.members.fetch(user.id);
    const hasRole = member.roles.cache.has(roleId);

    if (isPersistent) {
      // Persistent mode: reaction add = add role (don't toggle)
      if (!hasRole) {
        if (group.selectionMode === 'single') {
          const hasAnyGroupRole = group.roles.some(r => member.roles.cache.has(r.roleId));
          if (hasAnyGroupRole) {
            await reaction.users.remove(user.id);
            const msg = getAlreadyHasRoleMessage(group.guildId);
            if (msg) await sendDMFeedback(user, msg, group.guildId);
            return;
          }
        }

        if (group.selectionMode === 'exclusive') {
          const rolesToRemove = group.roles
            .map(r => r.roleId)
            .filter(id => id !== roleId && member.roles.cache.has(id));

          if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove);
            // Remove other reactions for exclusive mode
            for (const r of group.roles) {
              if (r.roleId !== roleId && r.emoji) {
                try {
                  await reaction.message.reactions.cache.get(r.emoji)?.users.remove(user.id);
                } catch {}
              }
            }
          }
        }

        await member.roles.add(roleId);
        if (role) {
          const msg = getRoleAddedMessage(group.guildId, role, user, true);
          if (msg) await sendDMFeedback(user, msg, group.guildId);
        }
      }
      // Don't remove the reaction in persistent mode
    } else {
      // Clear mode: toggle role, then remove reaction
      if (hasRole) {
        await member.roles.remove(roleId);
        if (role) {
          const msg = getRoleRemovedMessage(group.guildId, role, user, true);
          if (msg) await sendDMFeedback(user, msg, group.guildId);
        }
      } else {
        if (group.selectionMode === 'single') {
          const hasAnyGroupRole = group.roles.some(r => member.roles.cache.has(r.roleId));
          if (hasAnyGroupRole) {
            await reaction.users.remove(user.id);
            const msg = getAlreadyHasRoleMessage(group.guildId);
            if (msg) await sendDMFeedback(user, msg, group.guildId);
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
        if (role) {
          const msg = getRoleAddedMessage(group.guildId, role, user, true);
          if (msg) await sendDMFeedback(user, msg, group.guildId);
        }
      }

      await reaction.users.remove(user.id);
    }
  } catch (error) {
    console.error('[RoleAssign] Reaction handler error:', error);
  }
}

export async function handleRoleReactionRemove(
  client: Client,
  reaction: MessageReaction,
  user: User,
  group: RoleAssignmentGroup,
  roleId: string
): Promise<void> {
  // Only relevant for persistent mode (default)
  if (group.reactionPersist === 'clear') return;

  const guild = reaction.message.guild;
  if (!guild) return;

  if (!botCanAssignRole(guild, roleId)) {
    return;
  }

  const role = guild.roles.cache.get(roleId);

  try {
    const member = await guild.members.fetch(user.id);
    const hasRole = member.roles.cache.has(roleId);

    if (hasRole) {
      await member.roles.remove(roleId);
      if (role) {
        const msg = getRoleRemovedMessage(group.guildId, role, user, true);
        if (msg) await sendDMFeedback(user, msg, group.guildId);
      }
    }
  } catch (error) {
    console.error('[RoleAssign] Reaction remove handler error:', error);
  }
}
