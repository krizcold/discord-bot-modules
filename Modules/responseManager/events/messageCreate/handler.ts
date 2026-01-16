/**
 * Response Manager - Message Handler
 *
 * Processes incoming messages and triggers configured responses.
 */

import { Client, Message, CommandInteraction, PermissionsBitField } from 'discord.js';
import { getEnabledGroups, updateSequenceIndex } from '../../utils/storage';
import { findMatchingGroup } from '../../utils/patternParser';
import { canTrigger, recordTrigger } from '../../utils/cooldownManager';
import { createCommandProxy } from '../../utils/interactionProxy';
import { recordResponse } from '../../utils/historyManager';
import { getEmojiDisplay } from '@internal/utils/emojiHandler';
import {
  usesHistoryVariables,
  usesReplyVariables,
  resolveHistoryForReply,
  canSatisfyVariables,
  injectVariables,
  VariableContext,
} from '../../utils/responseVariables';
import { ResponseGroup, ResponseItem, PatternMatchResult, ResponseHistoryEntry } from '../../types/responseManager';
import getLocalCommands from '@internal/utils/getLocalCommands';
import { getConfigProperty } from '@internal/utils/configManager';

/**
 * Get the next response based on selection mode
 */
function getNextResponse(group: ResponseGroup): { response: ResponseItem; newIndex?: number } | null {
  if (!group.responses || group.responses.length === 0) {
    return null;
  }

  if (group.selectionMode === 'random') {
    const idx = Math.floor(Math.random() * group.responses.length);
    return { response: group.responses[idx] };
  }

  // Sequential mode
  const currentIdx = group.lastSequenceIndex ?? -1;
  const nextIdx = (currentIdx + 1) % group.responses.length;
  return {
    response: group.responses[nextIdx],
    newIndex: nextIdx,
  };
}

/**
 * Handle react response type
 * Responses are stored as validated identifiers (emoji ID or unicode)
 * Returns displayValue for history (shows emoji properly) with fallback lookup
 */
async function handleReact(client: Client, message: Message, group: ResponseGroup): Promise<string | null> {
  const result = getNextResponse(group);
  if (!result) return null;

  try {
    // Identifier is already validated and stored correctly
    // - Custom emoji: numeric ID (e.g., "123456789")
    // - Unicode emoji: the character itself (e.g., "🎉")
    await message.react(result.response.value);

    if (result.newIndex !== undefined) {
      updateSequenceIndex(message.guildId!, group.id, result.newIndex);
    }

    // Return displayValue for history (e.g., "<:emoji:123>" or "🎉")
    // If displayValue not stored (legacy data), look up emoji from cache
    if (result.response.displayValue) {
      return result.response.displayValue;
    }
    return getEmojiDisplay(result.response.value, client);
  } catch (error) {
    console.error(`[ResponseManager] Failed to react with ${result.response.value}:`, error);
    return null;
  }
}

/**
 * Handle reply response type
 */
async function handleReply(
  message: Message,
  group: ResponseGroup,
  variableContext: VariableContext
): Promise<string | null> {
  const result = getNextResponse(group);
  if (!result) return null;

  try {
    // Inject variables into response
    const responseText = injectVariables(result.response.value, variableContext);
    await message.reply(responseText);

    if (result.newIndex !== undefined) {
      updateSequenceIndex(message.guildId!, group.id, result.newIndex);
    }

    return responseText;
  } catch (error) {
    console.error(`[ResponseManager] Failed to reply:`, error);
    return null;
  }
}

/**
 * Handle respond response type (send without replying)
 */
async function handleRespond(
  message: Message,
  group: ResponseGroup,
  variableContext: VariableContext
): Promise<string | null> {
  const result = getNextResponse(group);
  if (!result) return null;

  try {
    // Inject variables into response
    const responseText = injectVariables(result.response.value, variableContext);

    if ('send' in message.channel) {
      await message.channel.send(responseText);
    }

    if (result.newIndex !== undefined) {
      updateSequenceIndex(message.guildId!, group.id, result.newIndex);
    }

    return responseText;
  } catch (error) {
    console.error(`[ResponseManager] Failed to respond:`, error);
    return null;
  }
}

/**
 * Handle command response type
 *
 * Executes a slash command callback using a MessageInteractionProxy.
 * The proxy mimics a CommandInteraction, allowing existing command
 * callbacks to work transparently with message-triggered invocations.
 *
 * Validation checks performed:
 * - devOnly: Only developers can trigger
 * - permissionsRequired: User must have required permissions
 * - botPermissions: Bot must have required permissions
 */
async function handleCommand(
  client: Client,
  message: Message,
  group: ResponseGroup,
  matchResult: PatternMatchResult
): Promise<void> {
  if (!group.commandName) {
    console.warn(`[ResponseManager] Group ${group.name} has command type but no command name`);
    return;
  }

  // Find the command callback
  const commands = getLocalCommands();
  const commandObject = commands.find(cmd => cmd.name === group.commandName);

  if (!commandObject) {
    console.warn(`[ResponseManager] Command not found: /${group.commandName}`);
    return;
  }

  if (!commandObject.callback) {
    console.warn(`[ResponseManager] Command has no callback: /${group.commandName}`);
    return;
  }

  // Check developer-only condition
  if (commandObject.devOnly) {
    const devs = getConfigProperty<(string | number)[]>('DEVS') || [];
    const userId = String(message.author.id);
    const isDevUser = devs.some(dev => String(dev) === userId);

    if (!isDevUser) {
      // Silently ignore - user doesn't have dev access
      return;
    }
  }

  // Check if the user has required permissions
  if (commandObject.permissionsRequired?.length && message.member) {
    for (const permission of commandObject.permissionsRequired) {
      const permKey = permission as keyof typeof PermissionsBitField.Flags;
      if (!message.member.permissions.has(PermissionsBitField.Flags[permKey])) {
        // Silently ignore - user doesn't have required permissions
        return;
      }
    }
  }

  // Check if the bot has required permissions
  if (commandObject.botPermissions?.length && message.guild) {
    const bot = message.guild.members.me;
    if (bot) {
      for (const permission of commandObject.botPermissions) {
        const permKey = permission as keyof typeof PermissionsBitField.Flags;
        if (!bot.permissions.has(PermissionsBitField.Flags[permKey])) {
          // Silently ignore - bot doesn't have required permissions
          return;
        }
      }
    }
  }

  // Create the interaction proxy
  const proxy = createCommandProxy(
    client,
    message,
    group,
    matchResult.variables || {}
  );

  if (!proxy) {
    console.error(`[ResponseManager] Failed to create command proxy for /${group.commandName}`);
    return;
  }

  try {
    // Execute the command callback with the proxy as if it were a CommandInteraction
    await commandObject.callback(client, proxy as unknown as CommandInteraction);
  } catch (error) {
    console.error(`[ResponseManager] Error executing command /${group.commandName}:`, error);

    // Try to send error feedback
    try {
      if (!proxy.replied && !proxy.deferred) {
        await message.reply({
          content: `❌ Error executing command \`/${group.commandName}\``,
        });
      }
    } catch {
      // Ignore reply errors
    }
  }
}

/**
 * Check if a group's responses can be satisfied given message context
 * Returns false if responses use history variables but message isn't a valid reply
 */
function canSatisfyGroupResponses(
  group: ResponseGroup,
  message: Message,
  historyEntry: ResponseHistoryEntry | null
): boolean {
  // Only check for reply/respond types (they use text templates)
  if (group.responseType !== 'reply' && group.responseType !== 'respond') {
    return true;
  }

  // Check if any response can be satisfied
  for (const response of group.responses) {
    if (canSatisfyVariables(response.value, message, historyEntry)) {
      return true;
    }
  }

  // No responses can be satisfied
  return group.responses.length === 0;
}

/**
 * Main message handler
 */
export default async function handler(client: Client, message: Message): Promise<void> {
  // Ignore bots
  if (message.author.bot) return;

  // Only handle guild messages
  if (!message.guildId) return;

  // Get enabled groups for this guild
  const groups = getEnabledGroups(message.guildId);
  if (groups.length === 0) return;

  // Pre-resolve history entry if message is a reply (used for variable injection)
  const historyEntry = resolveHistoryForReply(message, message.guildId);

  // Find matching group that can satisfy variable requirements
  let matchResult: PatternMatchResult = { matched: false };

  for (const group of groups) {
    if (!group.enabled) continue;

    // Check if group's responses can be satisfied
    if (!canSatisfyGroupResponses(group, message, historyEntry)) {
      continue; // Skip groups that require history but don't have it
    }

    const result = findMatchingGroup([group], message.content, message.channelId);
    if (result.matched) {
      matchResult = result;
      break;
    }
  }

  if (!matchResult.matched || !matchResult.group || !matchResult.pattern) return;

  const group = matchResult.group;
  const keywordPattern = matchResult.pattern.pattern;

  // Check cooldown
  if (!canTrigger(message.guildId, group, keywordPattern)) {
    return; // On cooldown, silently ignore
  }

  // Record the trigger for cooldown tracking
  recordTrigger(message.guildId, group, keywordPattern);

  // Create variable context for injection
  const variableContext: VariableContext = {
    message,
    guildId: message.guildId,
    historyEntry,
  };

  // Handle based on response type and collect response for history
  let responseValue: string | null = null;

  switch (group.responseType) {
    case 'react':
      responseValue = await handleReact(client, message, group);
      break;

    case 'reply':
      responseValue = await handleReply(message, group, variableContext);
      break;

    case 'respond':
      responseValue = await handleRespond(message, group, variableContext);
      break;

    case 'command':
      await handleCommand(client, message, group, matchResult);
      responseValue = group.commandName || null;
      break;
  }

  // Record in history if enabled (default: true)
  const shouldTrackHistory = group.trackHistory !== false;
  if (shouldTrackHistory && responseValue) {
    recordResponse(message.guildId, {
      channelId: message.channelId,
      messageId: message.id,
      userId: message.author.id,
      groupId: group.id,
      groupName: group.name,
      keyword: keywordPattern,
      responseType: group.responseType,
      response: responseValue,
    });
  }
}
