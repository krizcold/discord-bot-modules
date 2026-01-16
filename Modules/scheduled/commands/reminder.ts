/**
 * Reminder Command
 * Allows users to set personal reminders
 */

import {
  Client,
  CommandInteraction,
  ChatInputCommandInteraction,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  MessageFlags,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { getModuleSetting } from '@internal/utils/settings/settingsStorage';
import type { SettingValue } from '@bot/types/settingsTypes';
import {
  createReminder,
  getUserReminders,
  getMaxRemindersPerUser,
  getMaxReminderDuration,
  getBypassRoles,
} from '../utils/storage';
import { scheduleReminder } from '../manager/scheduler';

const MODULE_NAME = 'scheduled';
const CATEGORY = 'misc';

function getSetting<T extends SettingValue>(key: string, guildId: string, defaultValue: T): T {
  const value = getModuleSetting<T>(MODULE_NAME, key, guildId, CATEGORY);
  return value !== undefined ? value : defaultValue;
}

const reminderCommand: CommandOptions = {
  name: 'reminder',
  description: 'Set a personal reminder',
  testOnly: true,
  dm_permission: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  options: [
    {
      name: 'message',
      description: 'What to remind you about',
      type: ApplicationCommandOptionType.String,
      required: true,
      maxLength: 1000,
    },
    {
      name: 'hours',
      description: 'Hours from now (0-24)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 0,
      maxValue: 24,
    },
    {
      name: 'minutes',
      description: 'Minutes from now (0-59)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 0,
      maxValue: 59,
    },
  ],

  callback: async (client: Client, interaction: CommandInteraction) => {
    const chatInteraction = interaction as ChatInputCommandInteraction;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const message = chatInteraction.options.getString('message', true);
    const hours = chatInteraction.options.getInteger('hours') ?? 0;
    const minutes = chatInteraction.options.getInteger('minutes') ?? 0;

    // Validate at least one time value
    if (hours === 0 && minutes === 0) {
      await interaction.reply({
        content: 'Please specify at least `hours` or `minutes` for your reminder.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const totalMinutes = hours * 60 + minutes;
    const maxDuration = getMaxReminderDuration(guildId);

    // Check duration limit
    if (totalMinutes > maxDuration) {
      const maxHours = Math.floor(maxDuration / 60);
      const maxMins = maxDuration % 60;
      await interaction.reply({
        content: `Reminder duration cannot exceed ${maxHours}h ${maxMins}m.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check user limit (unless bypassed)
    const member = interaction.member as GuildMember;
    const bypassRoles = getBypassRoles(guildId);
    const canBypass = member.permissions.has(PermissionFlagsBits.ManageMessages) ||
      member.roles.cache.some(role => bypassRoles.includes(role.id));

    if (!canBypass) {
      const maxPerUser = getMaxRemindersPerUser(guildId);
      if (maxPerUser > 0) {
        const userReminders = getUserReminders(guildId, userId);
        if (userReminders.length >= maxPerUser) {
          await interaction.reply({
            content: `You can only have ${maxPerUser} active reminder${maxPerUser === 1 ? '' : 's'} at a time.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
    }

    // Calculate trigger time
    const triggerAt = Date.now() + totalMinutes * 60 * 1000;
    const relativeTimestamp = `<t:${Math.floor(triggerAt / 1000)}:R>`;

    // Get confirmation message template
    const confirmTemplate = getSetting('reminder.confirmMessage', guildId, '⏰ Got it! I\'ll remind you {time}');
    const confirmMessage = confirmTemplate.replace('{time}', relativeTimestamp);

    // Reply first (we need the message ID)
    await interaction.reply({
      content: confirmMessage,
    });

    // Get the reply message
    const reply = await interaction.fetchReply();

    // Create reminder in storage
    const reminder = createReminder(guildId, {
      guildId,
      channelId,
      userId,
      messageId: reply.id,
      message,
      createdAt: Date.now(),
      triggerAt,
    });

    // Schedule the reminder
    scheduleReminder(client, reminder);
  },
};

export = reminderCommand;
