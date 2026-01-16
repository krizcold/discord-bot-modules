/**
 * Button Handlers for Modals
 *
 * Handles buttons that need to show modals (bypassing panel system's deferUpdate).
 */

import {
  Client,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  LabelBuilder,
} from 'discord.js';
import { registerButtonHandler } from '@internal/events/interactionCreate/buttonHandler';
import { registerDropdownHandler } from '@internal/events/interactionCreate/dropdownHandler';
import { getMessageQueueMode } from '../utils/storage';
import {
  setSelectedMessageIndex,
  getEditingGroup,
} from '../utils/pageState';
import {
  EDITOR_PANEL_ID,
  MESSAGES_PANEL_ID,
  SCHEDULE_PANEL_ID,
  DESIGN_PANEL_ID,
  MODAL,
} from '../panels/constants';

/**
 * Initialize button handlers for modals
 */
export function initialize(client: Client): void {
  // All panel button handlers should never expire (timeoutMs: null)
  const noExpire = { timeoutMs: null };

  // Editor: Rename group
  registerButtonHandler(client, 'sched_rename', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);

    const modal = new ModalBuilder()
      .setCustomId(`panel_${EDITOR_PANEL_ID}_modal_${MODAL.GROUP_NAME}`)
      .setTitle('Rename Group')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Group Name')
            .setStyle(TextInputStyle.Short)
            .setValue(group.name || '')
            .setMaxLength(50)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Messages: Add message
  registerButtonHandler(client, 'sched_add_msg', async (client: Client, interaction: ButtonInteraction) => {
    const modal = new ModalBuilder()
      .setCustomId(`panel_${MESSAGES_PANEL_ID}_modal_${MODAL.ADD_MESSAGE}`)
      .setTitle('Add Message')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('content')
            .setLabel('Message Content')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(2000)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image URL (optional, for embed mode)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(500)
            .setRequired(false)
            .setPlaceholder('https://example.com/image.png')
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Schedule: Edit time
  registerButtonHandler(client, 'sched_edit_time', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const schedule = group.schedule || { timeHour: 9, timeMinute: 0 };

    const modal = new ModalBuilder()
      .setCustomId(`panel_${SCHEDULE_PANEL_ID}_modal_${MODAL.EDIT_TIME}`)
      .setTitle('Set Time')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('hour')
            .setLabel('Hour (0-23)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(schedule.timeHour))
            .setMaxLength(2)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('minute')
            .setLabel('Minute (0-59)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(schedule.timeMinute))
            .setMaxLength(2)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }, noExpire);


  // Schedule: Edit interval (hourly/custom)
  registerButtonHandler(client, 'sched_edit_interval', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const schedule = group.schedule || { type: 'daily', intervalHours: 1, intervalDays: 1 };

    const modal = new ModalBuilder()
      .setCustomId(`panel_${SCHEDULE_PANEL_ID}_modal_${MODAL.EDIT_INTERVAL}`)
      .setTitle('Set Interval');

    if (schedule.type === 'hourly') {
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('hours')
            .setLabel('Hours between sends (1-24)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(schedule.intervalHours || 1))
            .setMaxLength(2)
            .setRequired(true)
        )
      );
    } else if (schedule.type === 'custom') {
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('days')
            .setLabel('Days (0-365)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(schedule.intervalDays || 0))
            .setMaxLength(3)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('hours')
            .setLabel('Hours (0-23)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(schedule.intervalHours || 0))
            .setMaxLength(2)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('minutes')
            .setLabel('Minutes (0-59)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(schedule.intervalMinutes || 0))
            .setMaxLength(2)
            .setRequired(true)
        )
      );
    }

    await interaction.showModal(modal);
  }, noExpire);

  // Schedule: Edit day of month
  registerButtonHandler(client, 'sched_edit_day', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const schedule = group.schedule || { dayOfMonth: 1 };

    const modal = new ModalBuilder()
      .setCustomId(`panel_${SCHEDULE_PANEL_ID}_modal_${MODAL.EDIT_DAY_OF_MONTH}`)
      .setTitle('Set Day of Month')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('day')
            .setLabel('Day of month (1-31)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(schedule.dayOfMonth || 1))
            .setMaxLength(2)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Schedule: Edit random percentage
  registerButtonHandler(client, 'sched_edit_random_percent', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);

    const modal = new ModalBuilder()
      .setCustomId(`panel_${SCHEDULE_PANEL_ID}_modal_${MODAL.EDIT_RANDOM_PERCENT}`)
      .setTitle('Set Random Pool Size')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('percent')
            .setLabel('Percentage of oldest messages (0-100)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(group.randomOldestPercent || 30))
            .setMaxLength(3)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Design: Edit title
  registerButtonHandler(client, 'sched_edit_title', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const currentTitle = group.design?.title || '';

    const modal = new ModalBuilder()
      .setCustomId(`panel_${DESIGN_PANEL_ID}_modal_${MODAL.EDIT_TITLE}`)
      .setTitle('Edit Message Title')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title (prepended to each message)')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(currentTitle)
            .setMaxLength(500)
            .setRequired(false)
            .setPlaceholder('Leave empty to remove title')
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Design: Edit footer
  registerButtonHandler(client, 'sched_edit_footer', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const currentFooter = group.design?.footer || '';

    const modal = new ModalBuilder()
      .setCustomId(`panel_${DESIGN_PANEL_ID}_modal_${MODAL.EDIT_FOOTER}`)
      .setTitle('Edit Message Footer')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer (appended to each message)')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(currentFooter)
            .setMaxLength(500)
            .setRequired(false)
            .setPlaceholder('Leave empty to remove footer')
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Design: Edit prefix
  registerButtonHandler(client, 'sched_edit_prefix', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const currentPrefix = group.design?.prefix || '';

    const modal = new ModalBuilder()
      .setCustomId(`panel_${DESIGN_PANEL_ID}_modal_${MODAL.EDIT_PREFIX}`)
      .setTitle('Edit Message Prefix')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('prefix')
            .setLabel('Prefix (before each message)')
            .setStyle(TextInputStyle.Short)
            .setValue(currentPrefix)
            .setMaxLength(100)
            .setRequired(false)
            .setPlaceholder('e.g., 📢 or "Tip: "')
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Design: Edit color (Embed only)
  registerButtonHandler(client, 'sched_edit_color', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const currentColor = group.design?.color;
    const colorStr = currentColor !== undefined
      ? `#${currentColor.toString(16).padStart(6, '0').toUpperCase()}`
      : '';

    const modal = new ModalBuilder()
      .setCustomId(`panel_${DESIGN_PANEL_ID}_modal_${MODAL.EDIT_COLOR}`)
      .setTitle('Edit Embed Color')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color (hex code)')
            .setStyle(TextInputStyle.Short)
            .setValue(colorStr)
            .setMaxLength(7)
            .setRequired(false)
            .setPlaceholder('#FF5733 or FF5733')
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Design: Edit image (Embed only)
  registerButtonHandler(client, 'sched_edit_image', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);
    const currentImage = group.design?.image || '';

    const modal = new ModalBuilder()
      .setCustomId(`panel_${DESIGN_PANEL_ID}_modal_${MODAL.EDIT_IMAGE}`)
      .setTitle('Edit Embed Image')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image URL')
            .setStyle(TextInputStyle.Short)
            .setValue(currentImage)
            .setMaxLength(500)
            .setRequired(false)
            .setPlaceholder('https://example.com/image.png')
        )
      );

    await interaction.showModal(modal);
  }, noExpire);

  // Editor: Send Now (shows modal with skip option)
  registerButtonHandler(client, 'sched_send_now', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);

    // Get current next send time and calculate what skip would produce
    // Skip calculates from the CURRENT nextSendAt, not from now (otherwise it's the same time)
    const { calculateNextSend } = require('../manager/scheduler');
    const currentNextSend = group.nextSendAt;
    const skipNextTime = group.schedule
      ? calculateNextSend(group.schedule, currentNextSend || Date.now())
      : null;

    // Format date as readable string (descriptions don't support Discord timestamps)
    const formatDate = (timestamp: number): string => {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      }) + ' UTC';
    };

    // Build description with actual dates
    let dontSkipDesc = 'Keep the original scheduled time';
    let skipDesc = 'Recalculate next time from now';

    if (currentNextSend) {
      dontSkipDesc = `Next: ${formatDate(currentNextSend)}`;
    }
    if (skipNextTime) {
      skipDesc = `Next: ${formatDate(skipNextTime)}`;
    }

    const skipSelect = new StringSelectMenuBuilder()
      .setCustomId('skip_option')
      .setPlaceholder('Choose an option...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Don't Skip")
          .setValue('keep')
          .setDescription(dontSkipDesc.replace(/<[^>]+>/g, '').substring(0, 100)) // Strip markdown for description
          .setEmoji('📨')
          .setDefault(true),
        new StringSelectMenuOptionBuilder()
          .setLabel('Skip Next')
          .setValue('skip')
          .setDescription(skipDesc.replace(/<[^>]+>/g, '').substring(0, 100))
          .setEmoji('⏭️'),
      );

    const skipLabel = new LabelBuilder()
      .setLabel('Send Behavior')
      .setDescription('Choose whether to keep or skip the next scheduled send')
      .setStringSelectMenuComponent(skipSelect);

    const modal = new ModalBuilder()
      .setCustomId(`panel_${EDITOR_PANEL_ID}_modal_${MODAL.SEND_NOW}`)
      .setTitle('Send Now');

    modal.addLabelComponents(skipLabel);

    await interaction.showModal(modal);
  }, noExpire);

  // Messages: Edit message (using prefix matching)
  // The button handler system expects prefix WITHOUT trailing underscore, then checks for underscore after
  registerButtonHandler(client, 'sched_edit_msg', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);

    // Parse the index from the customId (e.g., "sched_edit_msg_5" -> 5)
    const indexStr = interaction.customId.replace('sched_edit_msg_', '');
    const i = parseInt(indexStr, 10);

    if (isNaN(i) || i < 0) {
      return;
    }

    // Store the selected index for the modal handler
    setSelectedMessageIndex(guildId, userId, i);

    let currentContent = '';
    let currentImage = '';
    let currentSentCount = 0;
    let currentQueueMode: 'none' | 'force' | 'queue' = 'none';
    if (group.messages && group.messages[i]) {
      currentContent = group.messages[i].content;
      currentImage = group.messages[i].image || '';
      currentSentCount = group.messages[i].sentCount || 0;
      currentQueueMode = getMessageQueueMode(group.messages[i]);
    }

    // Build the queue mode dropdown using LabelBuilder (Components V2)
    const queueSelect = new StringSelectMenuBuilder()
      .setCustomId('queue_mode')
      .setPlaceholder('Select queue priority...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Normal')
          .setValue('none')
          .setDescription('Use normal selection order')
          .setDefault(currentQueueMode === 'none'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Force Next')
          .setValue('force')
          .setDescription('Send this message next (only one at a time)')
          .setDefault(currentQueueMode === 'force'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Queue Next')
          .setValue('queue')
          .setDescription('Add to priority queue (stackable)')
          .setDefault(currentQueueMode === 'queue'),
      );

    const queueLabel = new LabelBuilder()
      .setLabel('Queue Priority')
      .setDescription('Control when this message is sent')
      .setStringSelectMenuComponent(queueSelect);

    const modal = new ModalBuilder()
      .setCustomId(`panel_${MESSAGES_PANEL_ID}_modal_${MODAL.EDIT_MESSAGE}`)
      .setTitle(`Edit Message #${i + 1}`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('content')
          .setLabel('Message Content (empty to delete)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentContent)
          .setMaxLength(2000)
          .setRequired(false)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('image')
          .setLabel('Image URL (optional, for embed mode)')
          .setStyle(TextInputStyle.Short)
          .setValue(currentImage)
          .setMaxLength(500)
          .setRequired(false)
          .setPlaceholder('https://example.com/image.png')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('sent_count')
          .setLabel('Times Sent')
          .setStyle(TextInputStyle.Short)
          .setValue(String(currentSentCount))
          .setMaxLength(10)
          .setRequired(false)
          .setPlaceholder('0')
      )
    );

    modal.addLabelComponents(queueLabel);

    await interaction.showModal(modal);
  }, noExpire);

  // Messages: Reset Counters (confirmation modal with dropdown)
  registerButtonHandler(client, 'sched_reset_counters', async (client: Client, interaction: ButtonInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);

    const messageCount = group.messages?.length || 0;
    const totalSent = group.messages?.reduce((sum, m) => sum + m.sentCount, 0) || 0;

    // Build confirmation dropdown using LabelBuilder (Components V2)
    const confirmSelect = new StringSelectMenuBuilder()
      .setCustomId('confirm_reset')
      .setPlaceholder('Select to confirm...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Cancel')
          .setValue('cancel')
          .setDescription('Do not reset counters')
          .setEmoji('❌')
          .setDefault(true),
        new StringSelectMenuOptionBuilder()
          .setLabel('Confirm Reset')
          .setValue('confirm')
          .setDescription(`Reset ${messageCount} messages (${totalSent} total sends)`)
          .setEmoji('🔄'),
      );

    const confirmLabel = new LabelBuilder()
      .setLabel('Reset Confirmation')
      .setDescription('This will reset all sent counts and the sequential index to 0')
      .setStringSelectMenuComponent(confirmSelect);

    const modal = new ModalBuilder()
      .setCustomId(`panel_${MESSAGES_PANEL_ID}_modal_${MODAL.RESET_COUNTERS}`)
      .setTitle('Reset All Counters');

    modal.addLabelComponents(confirmLabel);

    await interaction.showModal(modal);
  }, noExpire);

  // Messages: Dropdown select (compact view) - shows edit modal directly
  registerDropdownHandler<StringSelectMenuInteraction>(client, 'sched_msg_select', async (client: Client, interaction: StringSelectMenuInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const { group } = getEditingGroup(guildId, userId);

    // Parse the selected index
    const selectedValue = interaction.values[0];
    const i = parseInt(selectedValue, 10);

    if (isNaN(i) || i < 0) {
      return;
    }

    // Store the selected index for the modal handler
    setSelectedMessageIndex(guildId, userId, i);

    let currentContent = '';
    let currentImage = '';
    let currentSentCount = 0;
    let currentQueueMode: 'none' | 'force' | 'queue' = 'none';
    if (group.messages && group.messages[i]) {
      currentContent = group.messages[i].content;
      currentImage = group.messages[i].image || '';
      currentSentCount = group.messages[i].sentCount || 0;
      currentQueueMode = getMessageQueueMode(group.messages[i]);
    }

    // Build the queue mode dropdown using LabelBuilder (Components V2)
    const queueSelect = new StringSelectMenuBuilder()
      .setCustomId('queue_mode')
      .setPlaceholder('Select queue priority...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Normal')
          .setValue('none')
          .setDescription('Use normal selection order')
          .setDefault(currentQueueMode === 'none'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Force Next')
          .setValue('force')
          .setDescription('Send this message next (only one at a time)')
          .setDefault(currentQueueMode === 'force'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Queue Next')
          .setValue('queue')
          .setDescription('Add to priority queue (stackable)')
          .setDefault(currentQueueMode === 'queue'),
      );

    const queueLabel = new LabelBuilder()
      .setLabel('Queue Priority')
      .setDescription('Control when this message is sent')
      .setStringSelectMenuComponent(queueSelect);

    const modal = new ModalBuilder()
      .setCustomId(`panel_${MESSAGES_PANEL_ID}_modal_${MODAL.EDIT_MESSAGE}`)
      .setTitle(`Edit Message #${i + 1}`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('content')
          .setLabel('Message Content (empty to delete)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentContent)
          .setMaxLength(2000)
          .setRequired(false)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('image')
          .setLabel('Image URL (optional, for embed mode)')
          .setStyle(TextInputStyle.Short)
          .setValue(currentImage)
          .setMaxLength(500)
          .setRequired(false)
          .setPlaceholder('https://example.com/image.png')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('sent_count')
          .setLabel('Times Sent')
          .setStyle(TextInputStyle.Short)
          .setValue(String(currentSentCount))
          .setMaxLength(10)
          .setRequired(false)
          .setPlaceholder('0')
      )
    );

    modal.addLabelComponents(queueLabel);

    await interaction.showModal(modal);
  }, null);  // null = never expires
}
