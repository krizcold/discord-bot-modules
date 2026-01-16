/**
 * Response Manager - Response Variables
 *
 * Parses and injects special variables into response messages.
 *
 * Available variables:
 * - {messageId}        - Current message ID
 * - {userId}           - User who triggered (ID)
 * - {userMention}      - User mention (<@id>)
 * - {userName}         - User display name
 * - {channelId}        - Current channel ID
 * - {channelMention}   - Channel mention (<#id>)
 * - {replyId}          - Replied-to message ID (requires reply)
 * - {history:keyword}  - Keyword from history (requires reply + history match)
 * - {history:groupName} - Group name from history
 * - {history:response} - Original response value from history
 * - {history:userId}   - Original user who triggered (ID)
 * - {history:userMention} - Original user mention
 */

import { Message } from 'discord.js';
import { ResponseHistoryEntry } from '../types/responseManager';
import { lookupByMessageId } from './historyManager';

/**
 * Variable context for injection
 */
export interface VariableContext {
  message: Message;
  guildId: string;
  historyEntry?: ResponseHistoryEntry | null;
}

/**
 * Check if a response template uses history variables
 */
export function usesHistoryVariables(template: string): boolean {
  return /\{history:\w+\}/.test(template);
}

/**
 * Check if a response template uses reply variables
 */
export function usesReplyVariables(template: string): boolean {
  return /\{replyId\}/.test(template) || usesHistoryVariables(template);
}

/**
 * Check if message is a reply and get the replied message ID
 */
export function getReplyMessageId(message: Message): string | null {
  return message.reference?.messageId || null;
}

/**
 * Try to resolve history entry for a reply
 * Returns null if message is not a reply or replied message not in history
 */
export function resolveHistoryForReply(
  message: Message,
  guildId: string
): ResponseHistoryEntry | null {
  const replyId = getReplyMessageId(message);
  if (!replyId) return null;

  return lookupByMessageId(guildId, replyId);
}

/**
 * Check if all required variables can be satisfied
 * Returns false if template uses history vars but no history entry available
 */
export function canSatisfyVariables(
  template: string,
  message: Message,
  historyEntry: ResponseHistoryEntry | null
): boolean {
  // If uses reply variables, must be a reply
  if (usesReplyVariables(template) && !getReplyMessageId(message)) {
    return false;
  }

  // If uses history variables, must have history entry
  if (usesHistoryVariables(template) && !historyEntry) {
    return false;
  }

  return true;
}

/**
 * Inject variables into a response template
 */
export function injectVariables(
  template: string,
  context: VariableContext
): string {
  const { message, historyEntry } = context;
  let result = template;

  // Basic message variables
  result = result.replace(/\{messageId\}/g, message.id);
  result = result.replace(/\{userId\}/g, message.author.id);
  result = result.replace(/\{userTag\}/g, message.author.username);
  result = result.replace(/\{userMention\}/g, `<@${message.author.id}>`);
  result = result.replace(/\{userName\}/g, message.member?.displayName || message.author.displayName || message.author.username);
  result = result.replace(/\{channelId\}/g, message.channelId);
  result = result.replace(/\{channelMention\}/g, `<#${message.channelId}>`);

  // Reply variables
  const replyId = getReplyMessageId(message);
  result = result.replace(/\{replyId\}/g, replyId || '');

  // History variables
  if (historyEntry) {
    result = result.replace(/\{history:keyword\}/g, historyEntry.keyword);
    result = result.replace(/\{history:groupName\}/g, historyEntry.groupName);
    result = result.replace(/\{history:response\}/g, historyEntry.response);
    result = result.replace(/\{history:userId\}/g, historyEntry.userId);
    result = result.replace(/\{history:userMention\}/g, `<@${historyEntry.userId}>`);
  } else {
    // Clear history variables if no entry (shouldn't happen if canSatisfyVariables was checked)
    result = result.replace(/\{history:\w+\}/g, '');
  }

  return result;
}

/**
 * Get list of all available variables with descriptions and examples
 */
export function getAvailableVariables(): Array<{ name: string; description: string; example: string; requires?: string }> {
  return [
    { name: '{messageId}', description: 'ID of the triggering message', example: '1234567890123456789' },
    { name: '{userId}', description: 'ID of the user who triggered', example: '9876543210987654321' },
    { name: '{userTag}', description: 'Username (the @ handle)', example: 'johndoe' },
    { name: '{userName}', description: 'Display name (nickname or global name)', example: 'John Doe' },
    { name: '{userMention}', description: 'Clickable user mention', example: '@John Doe' },
    { name: '{channelId}', description: 'ID of the current channel', example: '1111222233334444555' },
    { name: '{channelMention}', description: 'Clickable channel mention', example: '#general' },
    { name: '{replyId}', description: 'ID of the replied-to message', example: '1234567890123456789', requires: 'reply' },
    { name: '{history:keyword}', description: 'Keyword that triggered', example: 'pizza', requires: 'history' },
    { name: '{history:groupName}', description: 'Group name that matched', example: 'Food Reactions', requires: 'history' },
    { name: '{history:response}', description: 'What the bot responded with', example: '🍕', requires: 'history' },
    { name: '{history:userId}', description: 'Original trigger user ID', example: '9876543210987654321', requires: 'history' },
    { name: '{history:userMention}', description: 'Mention the original user', example: '@Jane', requires: 'history' },
  ];
}

/**
 * Format variables help text for display in panel
 */
export function formatVariablesHelp(): string {
  const vars = getAvailableVariables();
  const lines: string[] = [];

  lines.push('**Basic Variables:**');
  for (const v of vars.filter(x => !x.requires)) {
    lines.push(`\`${v.name}\` → *${v.example}*`);
  }

  lines.push('');
  lines.push('**Reply Variables:**');
  lines.push('-# *Only work when message is a reply*');
  for (const v of vars.filter(x => x.requires === 'reply')) {
    lines.push(`\`${v.name}\` → *${v.example}*`);
  }

  lines.push('');
  lines.push('**History Variables:**');
  lines.push('-# *Only work when replying to a tracked bot response*');
  for (const v of vars.filter(x => x.requires === 'history')) {
    lines.push(`\`${v.name}\` → *${v.example}*`);
  }

  lines.push('');
  lines.push('**Example Response:**');
  lines.push('`Hey {userMention}, I reacted to "{history:keyword}"!`');
  lines.push('-# → *Hey @John Doe, I reacted to "pizza"!*');

  return lines.join('\n');
}

/**
 * Format a response for preview display (replaces variables with bold names)
 * e.g., "I reacted to {history:keyword}" → "I reacted to **keyword**"
 */
export function formatResponsePreview(response: string, maxLength: number = 50): string {
  // Replace {history:name} with **name**
  let preview = response.replace(/\{history:(\w+)\}/g, '**$1**');

  // Replace {name} with **name**
  preview = preview.replace(/\{(\w+)\}/g, '**$1**');

  // Truncate if too long, but handle bold markers properly
  if (preview.length > maxLength) {
    let truncated = preview.substring(0, maxLength - 3);

    // Count unclosed bold markers (odd number of ** means one is unclosed)
    const boldMarkers = truncated.match(/\*\*/g) || [];
    if (boldMarkers.length % 2 !== 0) {
      // Find the last ** and truncate before it to avoid broken formatting
      const lastBoldStart = truncated.lastIndexOf('**');
      if (lastBoldStart > 0) {
        truncated = truncated.substring(0, lastBoldStart).trimEnd();
      }
    }

    preview = truncated + '...';
  }

  return preview;
}
