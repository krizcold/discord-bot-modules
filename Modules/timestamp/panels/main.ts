// Main Timestamp Generator Panel

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { loadUserPrefs, hasCompletedSetup } from '../utils/storage';
import {
  calculateUnixTimestampFromPrefs,
  getUserAdjustedDateFromPrefs,
  getTimezoneDisplayFromPrefs,
  formatDateTimeWithANSI,
  formatTimeOnlyWithANSI,
  getTimeIsLink,
  getFormatFromOptions,
  getTimeOptionStatus,
  getDateOptionStatus,
  isComboFormat,
  formatTimestampResult,
} from '../utils/timeUtils';
import {
  TimestampInput,
  TimestampSessionState,
  TimeFormatOption,
  DateFormatOption,
} from '../types/timestamp';
import { storePanelState, getPanelState } from '../utils/panelState';

const PANEL_ID = 'timestamp_main';

/**
 * Get session state from context or initialize defaults
 */
function getSessionState(context: PanelContext): TimestampSessionState {
  // First check context data (for within-request state)
  if (context.data?.state) {
    return context.data.state;
  }

  // Then check persisted state (for cross-request state like relative toggle)
  const persistedState = getPanelState(context.userId);
  if (persistedState) {
    return persistedState;
  }

  // Initialize new state
  const input: TimestampInput = context.data?.input || {};

  // If no input, use current time
  if (Object.keys(input).length === 0) {
    const now = new Date();
    input.hour = now.getHours();
    input.minute = now.getMinutes();
    input.second = 0;
  }

  // Determine smart defaults based on input
  const hasDate = input.day !== undefined || input.month !== undefined || input.year !== undefined;
  const hasSeconds = input.second !== undefined && input.second !== 0;

  return {
    input,
    timeFormat: hasSeconds ? 'long' : 'short',
    dateFormat: hasDate ? 'long' : 'none',
    relative: false,
  };
}

/**
 * Check if date is being used (any date field set)
 */
function isUsingDate(input: TimestampInput): boolean {
  return input.day !== undefined || input.month !== undefined || input.year !== undefined;
}

/**
 * Build the main panel V2 container
 */
function buildMainContainer(context: PanelContext, state: TimestampSessionState, userId: string): ContainerBuilder {
  const prefs = loadUserPrefs(userId);
  const tzDisplay = getTimezoneDisplayFromPrefs(prefs);

  // Get user's current time
  const userAdjustedTime = getUserAdjustedDateFromPrefs(prefs);
  const userTimeStr = userAdjustedTime.toLocaleTimeString('en-GB', { hour12: true });
  const timeLink = getTimeIsLink(userAdjustedTime);

  // Build input date from state
  const now = new Date();
  const inputDate = new Date(
    state.input.year ?? now.getFullYear(),
    (state.input.month ?? (now.getMonth() + 1)) - 1,
    state.input.day ?? now.getDate(),
    state.input.hour ?? now.getHours(),
    state.input.minute ?? now.getMinutes(),
    state.input.second ?? 0
  );

  // Calculate timestamp using unified function
  const timestamp = calculateUnixTimestampFromPrefs(state.input, prefs);

  // Format raw input with ANSI
  const timeText = inputDate.toLocaleTimeString('en-GB', { hour12: false });
  let formattedInput: string;
  if (isUsingDate(state.input)) {
    formattedInput = formatDateTimeWithANSI(
      inputDate.getDate(),
      inputDate.getMonth() + 1,
      inputDate.getFullYear(),
      timeText
    );
  } else {
    formattedInput = formatTimeOnlyWithANSI(timeText);
  }

  // Get format code from options
  const format = getFormatFromOptions(state.timeFormat, state.dateFormat, state.relative);

  // Build copy-pasteable result
  const copyPasteable = format
    ? `**Timestamp Result (Copy this!):**\n\`\`\`${formatTimestampResult(timestamp, format)}\`\`\``
    : `**Timestamp Result (Copy this!):**\n\`\`\`Invalid format\`\`\``;

  // Build V2 container
  const container = new ContainerBuilder()
    .setAccentColor(format ? V2Colors.primary : V2Colors.warning);

  // Title with Settings button on the right
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## Timestamp Generator')
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${PANEL_ID}_btn_settings`)
          .setLabel('\u2699\uFE0F')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // User time info
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**User Time [[${userTimeStr}](${timeLink})]** *(${tzDisplay})*\n` +
      `*Make sure it syncs with YOUR time!*`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Raw input
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Raw Input**\n${formattedInput}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Preview
  const comboNote = format && isComboFormat(format) ? ' 🔗' : '';
  const previewValue = format ? formatTimestampResult(timestamp, format) : '⚠️ Invalid format combination';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Timestamp Preview:**${comboNote}\n${previewValue}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Copy-pasteable result
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(copyPasteable)
  );

  return container;
}

/**
 * Build time format dropdown options with status emojis
 */
function buildTimeFormatOptions(state: TimestampSessionState) {
  const options: Array<{ label: string; value: TimeFormatOption; description: string; default: boolean }> = [
    { label: 'None', value: 'none', description: 'No time display', default: state.timeFormat === 'none' },
    { label: 'Short', value: 'short', description: '16:20', default: state.timeFormat === 'short' },
    { label: 'Long', value: 'long', description: '16:20:30', default: state.timeFormat === 'long' },
  ];

  return options.map(opt => {
    const status = getTimeOptionStatus(opt.value, state.dateFormat);
    const emoji = status === 'invalid' ? '⚠️' : status === 'combo' ? '🔗' : '🕐';
    return {
      label: `${emoji} Time: ${opt.label}`,
      value: opt.value,
      description: opt.description,
      default: opt.default,
    };
  });
}

/**
 * Build date format dropdown options with status emojis
 */
function buildDateFormatOptions(state: TimestampSessionState) {
  const options: Array<{ label: string; value: DateFormatOption; description: string; default: boolean }> = [
    { label: 'None', value: 'none', description: 'No date display', default: state.dateFormat === 'none' },
    { label: 'Short', value: 'short', description: '20/04/2021', default: state.dateFormat === 'short' },
    { label: 'Long', value: 'long', description: '20 April 2021', default: state.dateFormat === 'long' },
    { label: 'Full', value: 'full', description: 'Tuesday, 20 April 2021', default: state.dateFormat === 'full' },
  ];

  return options.map(opt => {
    const status = getDateOptionStatus(opt.value, state.timeFormat);
    const emoji = status === 'invalid' ? '⚠️' : status === 'combo' ? '🔗' : '📅';
    return {
      label: `${emoji} Date: ${opt.label}`,
      value: opt.value,
      description: opt.description,
      default: opt.default,
    };
  });
}

/**
 * Add components to the container based on state
 */
function addComponentsToContainer(container: ContainerBuilder, state: TimestampSessionState, context: PanelContext): void {
  const prefs = loadUserPrefs(context.userId);
  const tzDisplay = getTimezoneDisplayFromPrefs(prefs);
  const userAdjustedTime = getUserAdjustedDateFromPrefs(prefs);
  const userTimeStr = userAdjustedTime.toLocaleTimeString('en-GB', { hour12: true });

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Edit buttons + Relative toggle
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ts_edit_time')
        .setLabel('Edit Time')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🕐'),
      new ButtonBuilder()
        .setCustomId('ts_edit_date')
        .setLabel('Edit Date')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📅'),
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_relative`)
        .setLabel(state.relative ? 'Relative: ON' : 'Relative: OFF')
        .setStyle(state.relative ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('🔄')
    )
  );

  // Only show format dropdowns if not in relative mode
  if (!state.relative) {
    // Format current selection for placeholder
    const timeLabels: Record<TimeFormatOption, string> = { none: 'None', short: 'Short', long: 'Long' };
    const dateLabels: Record<DateFormatOption, string> = { none: 'None', short: 'Short', long: 'Long', full: 'Full' };

    // Time format dropdown
    const timeDropdown = new StringSelectMenuBuilder()
      .setCustomId(`panel_${PANEL_ID}_dropdown_time_format`)
      .setPlaceholder(`🕐 Time: ${timeLabels[state.timeFormat]}`)
      .addOptions(buildTimeFormatOptions(state));
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeDropdown)
    );

    // Date format dropdown
    const dateDropdown = new StringSelectMenuBuilder()
      .setCustomId(`panel_${PANEL_ID}_dropdown_date_format`)
      .setPlaceholder(`📅 Date: ${dateLabels[state.dateFormat]}`)
      .addOptions(buildDateFormatOptions(state));
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dateDropdown)
    );
  }

  // Print Result + Cancel buttons
  const format = getFormatFromOptions(state.timeFormat, state.dateFormat, state.relative);
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ts_print_result')
        .setLabel('Print Result')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
        .setDisabled(!format),
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    )
  );

  // Footer at the very bottom
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${tzDisplay} · ${userTimeStr}`)
  );
}

/**
 * Build the complete main panel response
 */
function buildMainPanelResponse(context: PanelContext, state: TimestampSessionState): PanelResponse {
  const container = buildMainContainer(context, state, context.userId);
  addComponentsToContainer(container, state, context);
  return createV2Response([container]);
}

const mainPanel: PanelOptions = {
  id: PANEL_ID,
  name: 'Timestamp Generator',
  description: 'Generate Discord timestamps',
  category: 'Utilities',

  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    // Check if user has completed setup
    if (!hasCompletedSetup(context.userId)) {
      const setupPanel = await import('./setup');
      context.data = { ...context.data, storedInput: context.data?.input };
      return setupPanel.default.callback(context);
    }

    const state = getSessionState(context);
    context.data = { ...context.data, state };
    storePanelState(context.userId, state);

    return buildMainPanelResponse(context, state);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const state = getSessionState(context);

    if (dropdownId === 'time_format') {
      state.timeFormat = values[0] as TimeFormatOption;
    } else if (dropdownId === 'date_format') {
      state.dateFormat = values[0] as DateFormatOption;
    }

    context.data = { ...context.data, state };
    storePanelState(context.userId, state);

    return buildMainPanelResponse(context, state);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    const state = getSessionState(context);

    if (buttonId === 'settings') {
      context.data = { ...context.data, fromMainPanel: true };
      const setupPanel = await import('./setup');
      return setupPanel.default.callback(context);
    }

    if (buttonId === 'relative') {
      state.relative = !state.relative;
      context.data = { ...context.data, state };
      storePanelState(context.userId, state);

      return buildMainPanelResponse(context, state);
    }

    if (buttonId === 'cancel') {
      return { closePanel: true };
    }

    return await mainPanel.callback(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const state = getSessionState(context);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return await mainPanel.callback(context);
    }

    if (modalId === 'time') {
      const hour = parseInt(interaction.fields.getTextInputValue('hour'), 10);
      const minute = parseInt(interaction.fields.getTextInputValue('minute'), 10);
      const secondStr = interaction.fields.getTextInputValue('second');
      const second = secondStr ? parseInt(secondStr, 10) : 0;

      if (!isNaN(hour) && hour >= 0 && hour <= 23) state.input.hour = hour;
      if (!isNaN(minute) && minute >= 0 && minute <= 59) state.input.minute = minute;
      if (!isNaN(second) && second >= 0 && second <= 59) state.input.second = second;
    }

    if (modalId === 'date') {
      const day = parseInt(interaction.fields.getTextInputValue('day'), 10);
      const month = parseInt(interaction.fields.getTextInputValue('month'), 10);
      const year = parseInt(interaction.fields.getTextInputValue('year'), 10);

      if (!isNaN(day) && day >= 1 && day <= 31) state.input.day = day;
      if (!isNaN(month) && month >= 1 && month <= 12) state.input.month = month;
      if (!isNaN(year) && year >= 1970 && year <= 2100) state.input.year = year;
    }

    context.data = { ...context.data, state };
    storePanelState(context.userId, state);

    return buildMainPanelResponse(context, state);
  },
};

export default mainPanel;
