/**
 * Scheduled Messages - Schedule Configuration Panel
 *
 * Configure when messages are sent (frequency, time, etc.)
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  GatewayIntentBits,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import {
  createV2Response,
  createContainer,
  createText,
  createSeparator,
  createButton,
  createButtonRow,
  V2Colors,
} from '@internal/utils/panel/v2';

import { getGroup, updateGroup } from '../utils/storage';
import {
  getPendingGroup,
  setPendingGroup,
  getEditingGroup,
} from '../utils/pageState';
import { ScheduledGroup, ScheduleConfig } from '../types/scheduled';
import { calculateNextSend, scheduleGroup, cancelGroup } from '../manager/scheduler';
import {
  SCHEDULE_PANEL_ID,
  EDITOR_PANEL_ID,
  BTN,
  DROPDOWN,
  MODAL,
  SCHEDULE_TYPE_LABELS,
  WEEKDAY_LABELS,
} from './constants';


/**
 * Reschedule the timer after schedule changes
 */
function rescheduleTimer(context: PanelContext, groupId: string): void {
  const guildId = context.guildId!;
  const updatedGroup = getGroup(guildId, groupId);
  if (updatedGroup && updatedGroup.enabled) {
    cancelGroup(groupId);
    scheduleGroup(context.client, updatedGroup);
    console.log(`[Scheduled] Rescheduled timer for group ${groupId}, next send: ${updatedGroup.nextSendAt}`);
  }
}

/**
 * Build schedule panel container
 */
function buildScheduleContainer(
  context: PanelContext,
  group: Partial<ScheduledGroup>,
  isNew: boolean
): ContainerBuilder {
  const container = createContainer(V2Colors.primary);
  const schedule = group.schedule || {
    type: 'daily',
    timeHour: 9,
    timeMinute: 0,
    startDate: Date.now(),
    utcOffset: 0,
    minuteModifier: 0,
  };

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Schedule Configuration')
  );

  container.addSeparatorComponents(createSeparator());

  // Frequency type dropdown
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**Frequency**')
  );

  const freqSelect = new StringSelectMenuBuilder()
    .setCustomId(`panel_${SCHEDULE_PANEL_ID}_dropdown_${DROPDOWN.FREQ_TYPE}`)
    .setPlaceholder('Select frequency type')
    .addOptions([
      { label: 'Hourly', value: 'hourly', description: 'Every X hours', default: schedule.type === 'hourly' },
      { label: 'Daily', value: 'daily', description: 'Every day at a specific time', default: schedule.type === 'daily' },
      { label: 'Weekly', value: 'weekly', description: 'Specific days each week', default: schedule.type === 'weekly' },
      { label: 'Monthly', value: 'monthly', description: 'Specific day each month', default: schedule.type === 'monthly' },
      { label: 'Custom', value: 'custom', description: 'Custom interval in days/hours', default: schedule.type === 'custom' },
    ]);

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(freqSelect)
  );

  // Time display - show only Discord timestamp
  const nextSendPreview = calculateNextSend(schedule);
  const timeDisplay = nextSendPreview
    ? `<t:${Math.floor(nextSendPreview / 1000)}:t>`
    : 'Not set';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Time**: ${timeDisplay}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId('sched_edit_time')  // Bypass panel system for modal
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // Type-specific options
  if (schedule.type === 'hourly') {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Interval**: Every ${schedule.intervalHours || 1} hour(s)`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('sched_edit_interval')
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    );
  } else if (schedule.type === 'weekly' && schedule.weekdays) {
    const days = schedule.weekdays.map(d => WEEKDAY_LABELS[d]).join(', ');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Days**: ${days}`)
    );

    // Weekday selector
    const weekdaySelect = new StringSelectMenuBuilder()
      .setCustomId(`panel_${SCHEDULE_PANEL_ID}_dropdown_${DROPDOWN.WEEKDAYS}`)
      .setPlaceholder('Select days')
      .setMinValues(1)
      .setMaxValues(7)
      .addOptions(
        WEEKDAY_LABELS.map((label, i) => ({
          label,
          value: String(i),
          default: schedule.weekdays?.includes(i) || false,
        }))
      );

    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(weekdaySelect)
    );
  } else if (schedule.type === 'monthly') {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Day of month**: ${schedule.dayOfMonth || 1}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('sched_edit_day')
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    );
  } else if (schedule.type === 'custom') {
    // Build interval string with all non-zero parts
    const parts: string[] = [];
    if (schedule.intervalDays) parts.push(`${schedule.intervalDays}d`);
    if (schedule.intervalHours) parts.push(`${schedule.intervalHours}h`);
    if (schedule.intervalMinutes) parts.push(`${schedule.intervalMinutes}m`);
    const interval = parts.length > 0 ? parts.join(' ') : '1d';

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Interval**: ${interval}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('sched_edit_interval')
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    );
  }

  // Selection mode
  container.addSeparatorComponents(createSeparator());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**Selection Mode**')
  );

  const selectionSelect = new StringSelectMenuBuilder()
    .setCustomId(`panel_${SCHEDULE_PANEL_ID}_dropdown_${DROPDOWN.SELECTION_MODE}`)
    .setPlaceholder('Select mode')
    .addOptions([
      {
        label: 'Sequential',
        value: 'sequential',
        description: 'Send messages in order',
        default: group.selectionMode === 'sequential',
      },
      {
        label: 'Random',
        value: 'random',
        description: 'Pick randomly from oldest messages',
        default: group.selectionMode === 'random',
      },
    ]);

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectionSelect)
  );

  // Show random percentage edit when random mode is selected
  if (group.selectionMode === 'random') {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Pool size**: Oldest ${group.randomOldestPercent || 30}% of messages`
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('sched_edit_random_percent')
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    );
  }

  // Loop toggle
  const loopEnabled = group.loop !== false; // Default to true
  const loopEmoji = loopEnabled ? '🔁' : '➡️';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Loop**: ${loopEnabled ? 'Enabled (repeat forever)' : 'Disabled (stop after all sent)'}`
        )
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${SCHEDULE_PANEL_ID}_btn_${BTN.TOGGLE_ONCE}`)
          .setLabel(loopEnabled ? 'Disable' : 'Enable')
          .setEmoji(loopEmoji)
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // Show next send time preview
  const nextSendAt = calculateNextSend(schedule);
  if (nextSendAt) {
    container.addSeparatorComponents(createSeparator());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Next send**: <t:${Math.floor(nextSendAt / 1000)}:f> (<t:${Math.floor(nextSendAt / 1000)}:R>)`
      )
    );
  }

  container.addSeparatorComponents(createSeparator());

  // Back button
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${SCHEDULE_PANEL_ID}_btn_${BTN.BACK}`, 'Back', ButtonStyle.Secondary)
    )
  );

  return container;
}

/**
 * Build schedule panel response
 */
function buildScheduleResponse(context: PanelContext): PanelResponse {
  const guildId = context.guildId!;
  const userId = context.userId;

  const { group, isNew } = getEditingGroup(guildId, userId);
  const container = buildScheduleContainer(context, group, isNew);

  return createV2Response([container]);
}

const schedulePanel: PanelOptions = {
  id: SCHEDULE_PANEL_ID,
  name: 'Schedule Configuration',
  description: 'Configure message schedule',
  category: 'Chat',
  panelScope: 'guild',
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    if (!context.guildId) {
      return createV2Response([
        createContainer(V2Colors.danger)
          .addTextDisplayComponents(createText('## Error'))
          .addTextDisplayComponents(createText('This panel can only be used in a server.'))
      ]);
    }

    return buildScheduleResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);

    // Back to editor
    if (buttonId === BTN.BACK) {
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    // Edit time - modal will be shown
    if (buttonId === BTN.EDIT_TIME) {
      return null as any;
    }

    // Toggle loop
    if (buttonId === BTN.TOGGLE_ONCE) {
      const currentLoop = group.loop !== false; // Default to true
      const newValue = !currentLoop;

      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, loop: newValue });
      } else if (group.id) {
        updateGroup(guildId, group.id, { loop: newValue });
      }

      return buildScheduleResponse(context);
    }

    return buildScheduleResponse(context);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);

    // Frequency type
    if (dropdownId === DROPDOWN.FREQ_TYPE && values[0]) {
      const type = values[0] as ScheduleConfig['type'];
      const schedule = { ...(group.schedule || {}), type } as ScheduleConfig;

      // Set sensible defaults for the type
      if (type === 'hourly') {
        schedule.intervalHours = schedule.intervalHours || 1;
      } else if (type === 'weekly') {
        schedule.weekdays = schedule.weekdays || [0]; // Default Sunday
      } else if (type === 'monthly') {
        schedule.dayOfMonth = schedule.dayOfMonth || 1;
      } else if (type === 'custom') {
        schedule.intervalDays = schedule.intervalDays || 1;
        schedule.intervalHours = schedule.intervalHours || 0;
      }

      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, schedule });
      } else if (group.id) {
        const nextSendAt = calculateNextSend(schedule);
        updateGroup(guildId, group.id, { schedule, nextSendAt });
        rescheduleTimer(context, group.id);
      }
    }

    // Weekdays
    if (dropdownId === DROPDOWN.WEEKDAYS && values.length > 0) {
      const weekdays = values.map(v => parseInt(v, 10)).sort();
      const schedule = { ...(group.schedule || {}), weekdays } as ScheduleConfig;

      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, schedule });
      } else if (group.id) {
        const nextSendAt = calculateNextSend(schedule);
        updateGroup(guildId, group.id, { schedule, nextSendAt });
        rescheduleTimer(context, group.id);
      }
    }

    // Selection mode
    if (dropdownId === DROPDOWN.SELECTION_MODE && values[0]) {
      const selectionMode = values[0] as 'random' | 'sequential';

      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, selectionMode });
      } else if (group.id) {
        updateGroup(guildId, group.id, { selectionMode });
      }
    }

    return buildScheduleResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return buildScheduleResponse(context);
    }

    if (modalId === MODAL.EDIT_TIME) {
      const hourStr = interaction.fields.getTextInputValue('hour').trim();
      const minuteStr = interaction.fields.getTextInputValue('minute').trim();

      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        const schedule = {
          ...(group.schedule || {}),
          timeHour: hour,
          timeMinute: minute,
        } as ScheduleConfig;

        if (isNew) {
          const pending = getPendingGroup(guildId, userId) || {};
          setPendingGroup(guildId, userId, { ...pending, schedule });
        } else if (group.id) {
          const nextSendAt = calculateNextSend(schedule);
          updateGroup(guildId, group.id, { schedule, nextSendAt });
          rescheduleTimer(context, group.id);
        }
      }
    }

    // Handle interval editing (hourly/custom)
    if (modalId === MODAL.EDIT_INTERVAL) {
      const currentSchedule = group.schedule || { type: 'daily' };
      let schedule = { ...currentSchedule } as ScheduleConfig;

      if (currentSchedule.type === 'hourly') {
        const hoursStr = interaction.fields.getTextInputValue('hours').trim();
        const hours = parseInt(hoursStr, 10);
        if (!isNaN(hours) && hours >= 1 && hours <= 24) {
          schedule.intervalHours = hours;
        }
      } else if (currentSchedule.type === 'custom') {
        const daysStr = interaction.fields.getTextInputValue('days').trim();
        const hoursStr = interaction.fields.getTextInputValue('hours').trim();
        const minutesStr = interaction.fields.getTextInputValue('minutes').trim();
        const days = parseInt(daysStr, 10);
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        if (!isNaN(days) && days >= 0 && days <= 365) {
          schedule.intervalDays = days;
        }
        if (!isNaN(hours) && hours >= 0 && hours <= 23) {
          schedule.intervalHours = hours;
        }
        if (!isNaN(minutes) && minutes >= 0 && minutes <= 59) {
          schedule.intervalMinutes = minutes;
        }
      }

      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, schedule });
      } else if (group.id) {
        const nextSendAt = calculateNextSend(schedule);
        updateGroup(guildId, group.id, { schedule, nextSendAt });
        rescheduleTimer(context, group.id);
      }
    }

    // Handle day of month editing
    if (modalId === MODAL.EDIT_DAY_OF_MONTH) {
      const dayStr = interaction.fields.getTextInputValue('day').trim();
      const day = parseInt(dayStr, 10);

      if (!isNaN(day) && day >= 1 && day <= 31) {
        const schedule = {
          ...(group.schedule || {}),
          dayOfMonth: day,
        } as ScheduleConfig;

        if (isNew) {
          const pending = getPendingGroup(guildId, userId) || {};
          setPendingGroup(guildId, userId, { ...pending, schedule });
        } else if (group.id) {
          const nextSendAt = calculateNextSend(schedule);
          updateGroup(guildId, group.id, { schedule, nextSendAt });
          rescheduleTimer(context, group.id);
        }
      }
    }

    // Handle random percentage editing
    if (modalId === MODAL.EDIT_RANDOM_PERCENT) {
      const percentStr = interaction.fields.getTextInputValue('percent').trim();
      const percent = parseInt(percentStr, 10);

      if (!isNaN(percent) && percent >= 0 && percent <= 100) {
        if (isNew) {
          const pending = getPendingGroup(guildId, userId) || {};
          setPendingGroup(guildId, userId, { ...pending, randomOldestPercent: percent });
        } else if (group.id) {
          updateGroup(guildId, group.id, { randomOldestPercent: percent });
        }
      }
    }

    return buildScheduleResponse(context);
  },
};

export default schedulePanel;
