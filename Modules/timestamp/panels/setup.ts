// Timezone Setup Panel - Multi-Step Flow

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
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { loadUserPrefs, saveUserPrefs, markSetupComplete } from '../utils/storage';
import { generateUtcOptions, generateMinuteOptions, getUserCurrentTimeFromPrefs, getTimezoneDisplayFromPrefs } from '../utils/timeUtils';
import { TIMEZONE_REGIONS, buildTimezoneOptions, getCurrentTimeInTimezone, getTimezoneOffsetString, getTimezoneDisplayName, getRegionFromTimezone } from '../utils/timezoneUtils';
import { TimezoneMethod, TimezoneRegion, UserTimestampPrefs } from '../types/timestamp';

const PANEL_ID = 'timestamp_setup';

type SetupStep = 'method' | 'utc' | 'region' | 'city';

interface SetupState {
  step: SetupStep;
  selectedMethod?: TimezoneMethod;
  selectedRegion?: TimezoneRegion;
  fromMainPanel: boolean;
}

function getSetupState(context: PanelContext): SetupState {
  return {
    step: (context.data?.step as SetupStep) || 'method',
    selectedMethod: context.data?.selectedMethod as TimezoneMethod | undefined,
    selectedRegion: context.data?.selectedRegion as TimezoneRegion | undefined,
    fromMainPanel: context.data?.fromMainPanel === true,
  };
}

// ============================================================================
// Step 1: Method Selection
// ============================================================================

function buildMethodContainer(prefs: UserTimestampPrefs, state: SetupState): ContainerBuilder {
  const currentTime = getUserCurrentTimeFromPrefs(prefs);
  const tzDisplay = getTimezoneDisplayFromPrefs(prefs);

  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.primary);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Timestamp Setup')
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Your Time: [[${currentTime}](https://time.is/)]**\n` +
      `-# \`${tzDisplay}\`\n\n` +
      `Choose how you want to set your timezone:`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Method selection dropdown
  const methodDropdown = new StringSelectMenuBuilder()
    .setCustomId(`panel_${PANEL_ID}_dropdown_method`)
    .setPlaceholder('Select timezone method')
    .addOptions([
      {
        label: 'Custom UTC',
        value: 'utc',
        description: 'Manual UTC offset (you manage DST)',
        emoji: '\u231A',
        default: prefs.timezoneMethod === 'utc',
      },
      {
        label: 'Region/City',
        value: 'region',
        description: 'Select by location (automatic DST)',
        emoji: '\uD83C\uDF0D',
        default: prefs.timezoneMethod === 'region',
      },
    ]);

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(methodDropdown)
  );

  // Buttons
  const buttons: ButtonBuilder[] = [];

  // Add Next button if user already has a selection (setupComplete or has a valid method set)
  if (prefs.setupComplete) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_next_method`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (state.fromMainPanel) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_back_main`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)
  );

  return container;
}

// ============================================================================
// Step 2a: UTC Offset Selection
// ============================================================================

function buildUtcContainer(prefs: UserTimestampPrefs, state: SetupState): ContainerBuilder {
  const currentTime = getUserCurrentTimeFromPrefs({ ...prefs, timezoneMethod: 'utc' });
  const sign = prefs.utcOffset >= 0 ? '+' : '';
  const offsetDisplay = prefs.minuteModifier > 0
    ? `UTC${sign}${prefs.utcOffset}:${String(prefs.minuteModifier).padStart(2, '0')}`
    : `UTC${sign}${prefs.utcOffset}`;

  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.primary);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Custom UTC Setup')
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Your Time: [[${currentTime}](https://time.is/)]**\n\n` +
      `*If this isn't your current time, adjust the UTC offset below*`
    )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# \`${offsetDisplay}\``)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // UTC dropdown
  const utcOptions = generateUtcOptions().slice(0, 25);
  const utcDropdown = new StringSelectMenuBuilder()
    .setCustomId(`panel_${PANEL_ID}_dropdown_utc`)
    .setPlaceholder('Select UTC timezone')
    .addOptions(
      utcOptions.map(opt => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        default: opt.value === String(prefs.utcOffset),
      }))
    );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(utcDropdown)
  );

  // Minute offset dropdown
  const minuteOptions = generateMinuteOptions();
  const minuteDropdown = new StringSelectMenuBuilder()
    .setCustomId(`panel_${PANEL_ID}_dropdown_minute`)
    .setPlaceholder('Minute offset (optional)')
    .addOptions(
      minuteOptions.map(opt => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        default: opt.value === String(prefs.minuteModifier),
      }))
    );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(minuteDropdown)
  );

  // Buttons
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_confirm_utc`)
        .setLabel('Save & Continue')
        .setStyle(ButtonStyle.Success)
        .setEmoji('\u2705'),
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_back_method`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

// ============================================================================
// Step 2b: Region Selection
// ============================================================================

function buildRegionContainer(prefs: UserTimestampPrefs, state: SetupState): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.primary);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Select Your Region')
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Choose your continent/region to find your timezone.\n` +
      `*This method automatically adjusts for Daylight Saving Time*`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Region dropdown (7 options)
  const regionDropdown = new StringSelectMenuBuilder()
    .setCustomId(`panel_${PANEL_ID}_dropdown_region`)
    .setPlaceholder('Select your region')
    .addOptions(
      TIMEZONE_REGIONS.map(r => ({
        label: r.label,
        value: r.value,
        description: r.description,
        emoji: r.emoji,
      }))
    );

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(regionDropdown)
  );

  // Buttons
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_back_method`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

// ============================================================================
// Step 3b: City Selection
// ============================================================================

function buildCityContainer(prefs: UserTimestampPrefs, state: SetupState): ContainerBuilder {
  // Derive region from timezone if state.selectedRegion is undefined
  const region = state.selectedRegion || (prefs.ianaTimezone ? getRegionFromTimezone(prefs.ianaTimezone) : undefined);

  // Safety fallback - shouldn't happen but prevents crashes
  if (!region) {
    const container = new ContainerBuilder().setAccentColor(V2Colors.warning);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## Error\nRegion not found. Please go back and select a region.')
    );
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`panel_${PANEL_ID}_btn_back_method`)
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
      )
    );
    return container;
  }

  const regionLabel = TIMEZONE_REGIONS.find(r => r.value === region)?.label || region;

  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.primary);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Select City - ${regionLabel}`)
  );

  // Show current selection if any
  if (prefs.ianaTimezone) {
    const displayName = getTimezoneDisplayName(prefs.ianaTimezone);
    const currentTime = getCurrentTimeInTimezone(prefs.ianaTimezone);
    const offset = getTimezoneOffsetString(prefs.ianaTimezone);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Current: ${displayName}**\n` +
        `Time: [[${currentTime}](https://time.is/)] \`${offset}\``
      )
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Select your city/timezone below`)
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // City dropdown (max 25 options)
  const cityOptions = buildTimezoneOptions(region);
  const cityDropdown = new StringSelectMenuBuilder()
    .setCustomId(`panel_${PANEL_ID}_dropdown_city`)
    .setPlaceholder('Select your city')
    .addOptions(
      cityOptions.map(opt => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        default: opt.value === prefs.ianaTimezone,
      }))
    );

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(cityDropdown)
  );

  // Buttons
  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(`panel_${PANEL_ID}_btn_back_region`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary),
  ];

  // Only show confirm if a city is selected
  if (prefs.ianaTimezone) {
    buttons.unshift(
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_confirm_region`)
        .setLabel('Save & Continue')
        .setStyle(ButtonStyle.Success)
        .setEmoji('\u2705')
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)
  );

  return container;
}

// ============================================================================
// Panel Definition
// ============================================================================

const setupPanel: PanelOptions = {
  id: PANEL_ID,
  name: 'Timestamp Setup',
  description: 'Configure your timezone',
  category: 'Utilities',
  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    const prefs = context.data?.prefs || loadUserPrefs(context.userId);
    const state = getSetupState(context);

    let container: ContainerBuilder;

    switch (state.step) {
      case 'utc':
        container = buildUtcContainer(prefs, state);
        break;
      case 'region':
        container = buildRegionContainer(prefs, state);
        break;
      case 'city':
        container = buildCityContainer(prefs, state);
        break;
      case 'method':
      default:
        container = buildMethodContainer(prefs, state);
        break;
    }

    return createV2Response([container]);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const prefs = loadUserPrefs(context.userId);
    const state = getSetupState(context);

    switch (dropdownId) {
      case 'method': {
        const method = values[0] as TimezoneMethod;
        context.data = {
          ...context.data,
          step: method === 'utc' ? 'utc' : 'region',
          selectedMethod: method,
          fromMainPanel: state.fromMainPanel,
        };
        break;
      }

      case 'utc': {
        prefs.utcOffset = parseInt(values[0], 10);
        saveUserPrefs(context.userId, prefs);
        context.data = { ...context.data, step: 'utc', fromMainPanel: state.fromMainPanel };
        break;
      }

      case 'minute': {
        prefs.minuteModifier = parseInt(values[0], 10);
        saveUserPrefs(context.userId, prefs);
        context.data = { ...context.data, step: 'utc', fromMainPanel: state.fromMainPanel };
        break;
      }

      case 'region': {
        const region = values[0] as TimezoneRegion;
        context.data = {
          ...context.data,
          step: 'city',
          selectedRegion: region,
          fromMainPanel: state.fromMainPanel,
        };
        break;
      }

      case 'city': {
        prefs.ianaTimezone = values[0];
        saveUserPrefs(context.userId, prefs);

        // Derive region from the selected timezone as fallback
        const region = state.selectedRegion || getRegionFromTimezone(values[0]);

        context.data = {
          ...context.data,
          step: 'city',
          selectedRegion: region,
          fromMainPanel: state.fromMainPanel,
        };
        break;
      }
    }

    return await setupPanel.callback(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    const prefs = loadUserPrefs(context.userId);
    const state = getSetupState(context);

    switch (buttonId) {
      case 'confirm_utc': {
        // Save UTC method and mark complete
        prefs.timezoneMethod = 'utc';
        saveUserPrefs(context.userId, prefs);
        markSetupComplete(context.userId);

        // Redirect to main panel
        const mainPanel = await import('./main');
        return mainPanel.default.callback(context);
      }

      case 'confirm_region': {
        // Save region method and mark complete
        prefs.timezoneMethod = 'region';
        saveUserPrefs(context.userId, prefs);
        markSetupComplete(context.userId);

        // Redirect to main panel
        const mainPanel = await import('./main');
        return mainPanel.default.callback(context);
      }

      case 'next_method': {
        // Navigate to the appropriate step based on current method selection
        const nextStep = prefs.timezoneMethod === 'utc' ? 'utc' : 'region';
        context.data = {
          ...context.data,
          step: nextStep,
          selectedMethod: prefs.timezoneMethod,
          fromMainPanel: state.fromMainPanel,
        };
        return await setupPanel.callback(context);
      }

      case 'back_method': {
        context.data = { ...context.data, step: 'method', fromMainPanel: state.fromMainPanel };
        return await setupPanel.callback(context);
      }

      case 'back_region': {
        context.data = {
          ...context.data,
          step: 'region',
          selectedRegion: undefined,
          fromMainPanel: state.fromMainPanel,
        };
        return await setupPanel.callback(context);
      }

      case 'back_main': {
        // Go back to main panel
        const mainPanel = await import('./main');
        return mainPanel.default.callback(context);
      }

      case 'cancel': {
        // Close the panel
        return { closePanel: true };
      }

      default:
        return await setupPanel.callback(context);
    }
  },
};

export default setupPanel;
