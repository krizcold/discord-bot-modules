import { Client, MessageReaction, User } from 'discord.js';
import { registerButtonHandler } from '@internal/events/interactionCreate/buttonHandler';
import { registerReactionHandler } from '@internal/events/messageReactionAdd/reactionHandler';
import { registerReactionRemoveHandler } from '@internal/events/messageReactionRemove/reactionRemoveHandler';
import { RegisteredReactionInfo } from '@bot/types/commandTypes';
import { RA_ROLE_BTN_PREFIX } from '../constants/prefixes';
import { handleRoleButtonClick } from './roleButton';
import { handleRoleReaction, handleRoleReactionRemove } from './roleReaction';
import { getAllGroups } from '../manager/data';
import { RoleAssignmentGroup, LIMITS } from '../types/roleAssign';
import { listGuilds } from '@internal/utils/dataManager';

export function registerRoleAssignHandlers(client: Client): void {
  // Live role button handler (for published role assignment messages)
  // This is NOT a panel button - it's a persistent button on live messages
  registerButtonHandler(client, RA_ROLE_BTN_PREFIX, handleRoleButtonClick, { timeoutMs: null });

  // All panel buttons (including Cancel) are handled by the panel's handleButton method
  // Terminal actions use closePanel: true for cross-platform support
}

export function recoverReactionHandlers(client: Client): void {
  const guildIds = listGuilds();

  for (const guildId of guildIds) {
    const groups = getAllGroups(guildId);

    for (const group of groups) {
      if (group.interactionMode === 'reaction') {
        registerReactionHandlersForGroup(client, group);
      }
    }
  }
}

export function registerReactionHandlersForGroup(
  client: Client,
  group: RoleAssignmentGroup
): void {
  if (group.interactionMode !== 'reaction') return;

  const isPersistent = group.reactionPersist !== 'clear';

  for (const messageId of group.messageIds) {
    const rolesForMessage = getRolesForMessage(group, messageId);

    for (const role of rolesForMessage) {
      if (role.emoji) {
        // Register reaction add handler
        registerReactionHandler(
          client,
          messageId,
          role.emoji,
          (c: Client, reaction: MessageReaction, user: User, self: RegisteredReactionInfo) =>
            handleRoleReaction(c, reaction, user, self, group, role.roleId),
          { guildId: group.guildId }
        );

        // Register reaction remove handler for persistent mode
        if (isPersistent) {
          registerReactionRemoveHandler(
            client,
            messageId,
            role.emoji,
            (c: Client, reaction: MessageReaction, user: User) =>
              handleRoleReactionRemove(c, reaction, user, group, role.roleId),
            { guildId: group.guildId }
          );
        }
      }
    }
  }
}

function getRolesForMessage(
  group: RoleAssignmentGroup,
  messageId: string
): typeof group.roles {
  const messageIndex = group.messageIds.indexOf(messageId);
  if (messageIndex === -1) return [];

  const startIdx = messageIndex * LIMITS.REACTIONS_PER_MESSAGE;
  return group.roles.slice(startIdx, startIdx + LIMITS.REACTIONS_PER_MESSAGE);
}
