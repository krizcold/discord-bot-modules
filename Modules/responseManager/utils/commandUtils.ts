/**
 * Command Utilities
 *
 * Helpers for working with registered slash commands.
 */

import { Client, ApplicationCommand, ApplicationCommandOptionType } from 'discord.js';
import getLocalCommands from '@internal/utils/getLocalCommands';

/**
 * Command option info
 */
export interface CommandOptionInfo {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  required: boolean;
}

/**
 * Command info
 */
export interface CommandInfo {
  name: string;
  description: string;
  options: CommandOptionInfo[];
  /** Whether this command is safe to trigger from message responses */
  messageTriggerSafe: boolean;
}

/**
 * Get all registered commands for a guild (or global)
 * Only returns commands that are marked as messageTriggerSafe
 */
export async function getAvailableCommands(client: Client, guildId?: string): Promise<CommandInfo[]> {
  try {
    let commands: ApplicationCommand[] = [];

    // Get guild commands
    if (guildId) {
      const guild = await client.guilds.fetch(guildId);
      const guildCommands = await guild.commands.fetch();
      commands = [...guildCommands.values()];
    }

    // Also get global commands
    if (client.application) {
      const globalCommands = await client.application.commands.fetch();
      commands = [...commands, ...globalCommands.values()];
    }

    // Get local command definitions to check messageTriggerSafe flag
    const localCommands = getLocalCommands();
    const localCommandMap = new Map<string, any>();
    for (const cmd of localCommands) {
      localCommandMap.set(cmd.name, cmd);
    }

    // Remove duplicates (prefer guild version)
    const seen = new Set<string>();
    const uniqueCommands: CommandInfo[] = [];

    for (const cmd of commands) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);

      // Get the local command to check messageTriggerSafe
      const localCmd = localCommandMap.get(cmd.name);
      const messageTriggerSafe = localCmd?.messageTriggerSafe === true;

      uniqueCommands.push({
        name: cmd.name,
        description: cmd.description,
        messageTriggerSafe,
        options: (cmd.options || [])
          .filter(opt =>
            opt.type !== ApplicationCommandOptionType.Subcommand &&
            opt.type !== ApplicationCommandOptionType.SubcommandGroup
          )
          .map(opt => ({
            name: opt.name,
            description: opt.description,
            type: opt.type,
            required: opt.required || false,
          })),
      });
    }

    // Sort alphabetically
    return uniqueCommands.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('[ResponseManager] Error fetching commands:', error);
    return [];
  }
}

/**
 * Get command info by name
 */
export async function getCommandInfo(client: Client, commandName: string, guildId?: string): Promise<CommandInfo | null> {
  const commands = await getAvailableCommands(client, guildId);
  return commands.find(c => c.name === commandName) || null;
}

/**
 * Get option type display name
 */
export function getOptionTypeDisplay(type: ApplicationCommandOptionType): string {
  switch (type) {
    case ApplicationCommandOptionType.String: return 'Text';
    case ApplicationCommandOptionType.Integer: return 'Integer';
    case ApplicationCommandOptionType.Boolean: return 'True/False';
    case ApplicationCommandOptionType.User: return 'User';
    case ApplicationCommandOptionType.Channel: return 'Channel';
    case ApplicationCommandOptionType.Role: return 'Role';
    case ApplicationCommandOptionType.Mentionable: return 'Mentionable';
    case ApplicationCommandOptionType.Number: return 'Number';
    case ApplicationCommandOptionType.Attachment: return 'Attachment';
    default: return 'Unknown';
  }
}

/**
 * Check if option type can be mapped from text
 */
export function canMapFromText(type: ApplicationCommandOptionType): boolean {
  // Only these types can be reasonably parsed from text
  return [
    ApplicationCommandOptionType.String,
    ApplicationCommandOptionType.Integer,
    ApplicationCommandOptionType.Number,
    ApplicationCommandOptionType.Boolean,
  ].includes(type);
}

/**
 * Filter commands to only those that can work with text triggers
 * - Must have messageTriggerSafe: true
 * - Required options must be mappable from text (string/number/boolean)
 */
export function filterMappableCommands(commands: CommandInfo[]): CommandInfo[] {
  return commands.filter(cmd => {
    // Must be marked as safe for message triggers
    if (!cmd.messageTriggerSafe) return false;

    // Allow commands with no options
    if (cmd.options.length === 0) return true;

    // Check if all required options can be mapped from text
    const requiredOptions = cmd.options.filter(o => o.required);
    return requiredOptions.every(o => canMapFromText(o.type));
  });
}
