// Timestamp Command - Direct output without panel
// This command is designed to be triggered via message responses

import {
  Client,
  CommandInteraction,
  ChatInputCommandInteraction,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { hasCompletedSetup, loadUserPrefs } from '../utils/storage';
import { calculateUnixTimestampFromPrefs, determineSmartFormat, formatTimestamp } from '../utils/timeUtils';
import { TimestampInput, MONTH_MAP, MONTH_NAMES } from '../types/timestamp';

const timestampCommand: CommandOptions = {
  name: 'timestamp',
  description: 'Generate a Discord timestamp (use /timestamp-setup to configure timezone)',
  testOnly: true,
  requiredIntents: [GatewayIntentBits.Guilds],
  messageTriggerSafe: true,  // Safe to trigger from message responses

  integration_types: [
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
  ],

  options: [
    {
      name: 'hour',
      description: 'Hour (0-23)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 0,
      maxValue: 23,
    },
    {
      name: 'minute',
      description: 'Minute (0-59)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 0,
      maxValue: 59,
    },
    {
      name: 'second',
      description: 'Second (0-59)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 0,
      maxValue: 59,
    },
    {
      name: 'day',
      description: 'Day of month (1-31)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 31,
    },
    {
      name: 'month',
      description: 'Month',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: MONTH_NAMES.map(name => ({ name, value: name })),
    },
    {
      name: 'year',
      description: 'Year (e.g., 2024)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1970,
      maxValue: 2100,
    },
  ],

  callback: async (client: Client, interaction: CommandInteraction) => {
    const userId = interaction.user.id;

    // Check if user has completed setup
    if (!hasCompletedSetup(userId)) {
      await interaction.reply({
        content: '⚠️ You need to configure your timezone first.\nUse `/timestamp-setup` to set up your UTC offset.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Cast to ChatInputCommandInteraction to access options
    const chatInteraction = interaction as ChatInputCommandInteraction;

    // Parse command options
    const input: TimestampInput = {};

    const hour = chatInteraction.options.getInteger('hour');
    const minute = chatInteraction.options.getInteger('minute');
    const second = chatInteraction.options.getInteger('second');
    const day = chatInteraction.options.getInteger('day');
    const monthName = chatInteraction.options.getString('month');
    const year = chatInteraction.options.getInteger('year');

    if (hour !== null) input.hour = hour;
    if (minute !== null) input.minute = minute;
    if (second !== null) input.second = second;
    if (day !== null) input.day = day;
    if (monthName !== null) input.month = MONTH_MAP[monthName];
    if (year !== null) input.year = year;

    // Get user preferences
    const prefs = loadUserPrefs(userId);

    // Calculate timestamp using unified function
    const unixTimestamp = calculateUnixTimestampFromPrefs(input, prefs);

    // Determine format based on input
    const format = determineSmartFormat(input);

    // Build and send the timestamp
    const timestampStr = formatTimestamp(unixTimestamp, format);
    await interaction.reply({ content: timestampStr });
  },
};

export default timestampCommand;
