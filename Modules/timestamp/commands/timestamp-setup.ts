// Timestamp Setup Slash Command - Opens the visual panel for timezone config and timestamp generation

import {
  Client,
  CommandInteraction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { registerButtonHandler } from '@internal/events/interactionCreate/buttonHandler';
import { getPanelManager } from '@internal/utils/panelManager';
import { hasCompletedSetup, loadUserPrefs } from '../utils/storage';
import { determineSmartFormat, calculateUnixTimestamp, getFormatFromOptions, formatTimestampResult } from '../utils/timeUtils';
import { getPanelInput, getPanelState } from '../utils/panelState';
import { TimestampInput, MONTH_MAP, MONTH_NAMES } from '../types/timestamp';

const TS_EDIT_TIME = 'ts_edit_time';
const TS_EDIT_DATE = 'ts_edit_date';
const TS_PRINT_RESULT = 'ts_print_result';
const PANEL_ID = 'timestamp_main';

// Panel IDs
const SETUP_PANEL_ID = 'timestamp_setup';
const MAIN_PANEL_ID = 'timestamp_main';

const timestampSetupCommand: CommandOptions = {
  name: 'timestamp-setup',
  description: 'Configure your timezone and generate timestamps with a visual panel',
  testOnly: true,
  requiredIntents: [GatewayIntentBits.Guilds],

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

  initialize: (client: Client) => {
    // Edit Time button - shows modal (bypasses panel system to avoid deferUpdate)
    registerButtonHandler(client, TS_EDIT_TIME, async (client: Client, interaction: ButtonInteraction) => {
      const now = new Date();
      const state = getPanelInput(interaction.user.id);

      const modal = new ModalBuilder()
        .setCustomId(`panel_${PANEL_ID}_modal_time`)
        .setTitle('Edit Time');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('hour')
            .setLabel('Hour (0-23)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(state?.hour ?? now.getHours()))
            .setRequired(true)
            .setMaxLength(2)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('minute')
            .setLabel('Minute (0-59)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(state?.minute ?? now.getMinutes()))
            .setRequired(true)
            .setMaxLength(2)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('second')
            .setLabel('Second (0-59)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(state?.second ?? 0))
            .setRequired(false)
            .setMaxLength(2)
        )
      );

      await interaction.showModal(modal);
    }, { timeoutMs: null });

    // Edit Date button - shows modal (bypasses panel system to avoid deferUpdate)
    registerButtonHandler(client, TS_EDIT_DATE, async (client: Client, interaction: ButtonInteraction) => {
      const now = new Date();
      const state = getPanelInput(interaction.user.id);

      const modal = new ModalBuilder()
        .setCustomId(`panel_${PANEL_ID}_modal_date`)
        .setTitle('Edit Date');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('day')
            .setLabel('Day (1-31)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(state?.day ?? now.getDate()))
            .setRequired(true)
            .setMaxLength(2)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('month')
            .setLabel('Month (1-12)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(state?.month ?? now.getMonth() + 1))
            .setRequired(true)
            .setMaxLength(2)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('year')
            .setLabel('Year')
            .setStyle(TextInputStyle.Short)
            .setValue(String(state?.year ?? now.getFullYear()))
            .setRequired(true)
            .setMaxLength(4)
        )
      );

      await interaction.showModal(modal);
    }, { timeoutMs: null });

    // Print Result button - sends new ephemeral message with just the timestamp
    registerButtonHandler(client, TS_PRINT_RESULT, async (client: Client, interaction: ButtonInteraction) => {
      const state = getPanelState(interaction.user.id);
      if (!state) {
        await interaction.reply({ content: 'No timestamp data found', flags: MessageFlags.Ephemeral });
        return;
      }

      const prefs = loadUserPrefs(interaction.user.id);
      const timestamp = calculateUnixTimestamp(state.input, prefs.utcOffset, prefs.minuteModifier);
      const format = getFormatFromOptions(state.timeFormat, state.dateFormat, state.relative);

      if (format) {
        await interaction.reply({ content: formatTimestampResult(timestamp, format), flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: 'Invalid format combination', flags: MessageFlags.Ephemeral });
      }
    }, { timeoutMs: null });
  },

  callback: async (client: Client, interaction: CommandInteraction) => {
    const userId = interaction.user.id;

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

    // Get the panel manager
    const panelManager = getPanelManager(client);

    // Check if user has completed setup
    if (!hasCompletedSetup(userId)) {
      // Show setup panel
      const context = panelManager.createDirectCommandContext(
        SETUP_PANEL_ID,
        interaction,
        client
      );

      // Store input for after setup
      context.data = { storedInput: input };

      const response = await panelManager.handlePanelInteraction(context);
      await interaction.reply(response);
      return;
    }

    // User has setup, show main panel with input
    const context = panelManager.createDirectCommandContext(
      MAIN_PANEL_ID,
      interaction,
      client
    );

    // Pass input to panel
    context.data = {
      input,
      format: determineSmartFormat(input),
    };

    const response = await panelManager.handlePanelInteraction(context);
    await interaction.reply(response);
  },
};

export default timestampSetupCommand;
