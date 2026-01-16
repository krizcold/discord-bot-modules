/**
 * Scheduled Messages - Editor Panel
 *
 * Edit a single scheduled message group's settings.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
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
import { resolveEmojisInText } from '@internal/utils/emojiHandler';

import {
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  toggleGroup,
  toggleAutoPin,
  groupNameExists,
  clearLastPinnedMessage,
} from '../utils/storage';
import {
  getPanelState,
  updatePanelState,
  getPendingGroup,
  setPendingGroup,
  clearPanelState,
  getEditingGroup,
} from '../utils/pageState';
import { ScheduledGroup } from '../types/scheduled';
import { previewNextMessage, isGroupComplete, getCompletionProgress } from '../manager/selection';
import { scheduleGroup, cancelGroup, calculateNextSend, verifyAndUnpinMessage } from '../manager/scheduler';
import {
  EDITOR_PANEL_ID,
  LIST_PANEL_ID,
  BTN,
  MODAL,
  STATUS_ICONS,
  SCHEDULE_TYPE_LABELS,
  WEEKDAY_LABELS,
} from './constants';

/**
 * Format schedule description
 */
function formatScheduleDesc(group: Partial<ScheduledGroup>): string {
  const schedule = group.schedule;
  if (!schedule) return 'Not configured';

  // Don't show fixed time strings - the "Next send" timestamp shows the actual time
  switch (schedule.type) {
    case 'hourly':
      return `Every ${schedule.intervalHours || 1} hour(s)`;
    case 'daily':
      return 'Daily';
    case 'weekly':
      const days = (schedule.weekdays || [0]).map(d => WEEKDAY_LABELS[d]).join(', ');
      return days;
    case 'monthly':
      return `Day ${schedule.dayOfMonth || 1} of each month`;
    case 'custom':
      return `Every ${schedule.intervalDays || 1}d ${schedule.intervalHours || 0}h`;
    default:
      return SCHEDULE_TYPE_LABELS[schedule.type] || schedule.type;
  }
}


/**
 * Build editor container
 */
function buildEditorContainer(
  context: PanelContext,
  group: Partial<ScheduledGroup>,
  isNew: boolean,
  confirmDelete: boolean = false
): ContainerBuilder {
  const guildId = context.guildId!;
  const accentColor = group.enabled !== false ? V2Colors.primary : V2Colors.secondary;
  const container = createContainer(accentColor);

  // Title with Rename button
  const groupName = group.name?.trim();
  const title = groupName
    ? (isNew ? `New: ${groupName}` : groupName)
    : (isNew ? 'New Scheduled Group' : 'Unnamed Group');

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${title}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId('sched_rename')  // Bypass panel system for modal
          .setLabel('Rename')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(createSeparator());

  // Status line
  const statusParts: string[] = [];
  if (!group.enabled) {
    statusParts.push(`${STATUS_ICONS.PAUSED} Paused`);
  } else if (group.id && isGroupComplete(group as ScheduledGroup)) {
    statusParts.push(`${STATUS_ICONS.COMPLETE} Complete`);
  } else {
    statusParts.push(`${STATUS_ICONS.ACTIVE} Active`);
  }
  if (group.autoPin) {
    statusParts.push(`${STATUS_ICONS.PIN} Auto-pin`);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Status**: ${statusParts.join(' • ')}`)
  );

  // Messages count
  const msgCount = group.messages?.length || 0;
  const selectionMode = group.selectionMode === 'random'
    ? `Random ${group.randomOldestPercent || 30}%`
    : 'Sequential';

  let msgLine = `**Messages**: ${msgCount} total • ${selectionMode}`;
  // Loop disabled = sendOnce true (will stop after all sent)
  if (!group.loop && group.id) {
    const { sent, total } = getCompletionProgress(group as ScheduledGroup);
    msgLine += ` (${sent}/${total} sent)`;
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(msgLine)
  );

  // Schedule
  let scheduleText = `**Schedule**: ${formatScheduleDesc(group)}`;
  // Show next send time as Discord timestamp if available
  if (group.enabled !== false) {
    // For saved groups, use stored nextSendAt; for new groups, calculate preview
    const nextSendAt = (group as ScheduledGroup).nextSendAt || (group.schedule ? calculateNextSend(group.schedule) : null);
    if (nextSendAt) {
      const label = isNew ? '**First send**' : '**Next send**';
      scheduleText += `\n${label}: <t:${Math.floor(nextSendAt / 1000)}:f> (<t:${Math.floor(nextSendAt / 1000)}:R>)`;
    }
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(scheduleText)
  );

  // Channel
  const channelDisplay = group.channelId
    ? `<#${group.channelId}>`
    : '_Not set_';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Channel**: ${channelDisplay}`)
  );

  // Channel selector
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`panel_${EDITOR_PANEL_ID}_dropdown_channel_select`)
    .setPlaceholder('Select a channel')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

  // Set default channel if one is selected
  if (group.channelId) {
    channelSelect.setDefaultChannels([group.channelId]);
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect)
  );

  // Next message preview
  if (msgCount > 0 && group.id) {
    const nextMsg = previewNextMessage(group as ScheduledGroup);
    if (nextMsg) {
      container.addSeparatorComponents(createSeparator());
      // Truncate first, then resolve emojis for display
      let preview = nextMsg.content.length > 100
        ? nextMsg.content.substring(0, 100) + '...'
        : nextMsg.content;
      // Resolve :emoji: shortcodes for display (translation layer)
      const guild = context.guildId ? context.client.guilds.cache.get(context.guildId) : null;
      preview = resolveEmojisInText(preview, context.client, guild);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Next message:**\n> ${preview}`)
      );
    }
  }

  container.addSeparatorComponents(createSeparator());

  // Delete confirmation
  if (confirmDelete) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Are you sure you want to delete this group?**')
    );
    container.addActionRowComponents(
      createButtonRow(
        createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.CONFIRM_DELETE}`, 'Yes, Delete', ButtonStyle.Danger),
        createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.CANCEL_DELETE}`, 'Cancel', ButtonStyle.Secondary)
      )
    );
    return container;
  }

  // Action buttons - Row 1: Edit options
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.EDIT_SCHEDULE}`, 'Schedule', ButtonStyle.Primary).setEmoji('📅'),
      createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.EDIT_MESSAGES}`, 'Messages', ButtonStyle.Secondary).setEmoji('💬'),
      createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.EDIT_DESIGN}`, 'Design', ButtonStyle.Secondary).setEmoji('🎨')
    )
  );

  // Row 2: Actions
  const actionButtons: ButtonBuilder[] = [];

  // Send Now - always visible for saved groups, disabled when paused or no messages
  // Uses bypass ID to show modal directly
  if (!isNew) {
    const canSendNow = group.enabled && group.channelId && msgCount > 0;
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId('sched_send_now')
        .setLabel('Send Now')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📨')
        .setDisabled(!canSendNow)
    );
  }

  // Pause/Enable with emoji
  const toggleEmoji = group.enabled ? '⏸️' : '▶️';
  actionButtons.push(
    createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.TOGGLE}`, group.enabled ? 'Pause' : 'Enable', ButtonStyle.Secondary)
      .setEmoji(toggleEmoji)
  );

  // Pin toggle with emoji
  actionButtons.push(
    createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.TOGGLE_PIN}`, group.autoPin ? 'Pin: ON' : 'Pin: OFF', ButtonStyle.Secondary)
      .setEmoji('📌')
  );

  container.addActionRowComponents(createButtonRow(...actionButtons));

  // Row 3: Back/Delete/Save
  const navButtons: ButtonBuilder[] = [
    createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.BACK}`, 'Back', ButtonStyle.Secondary)
  ];

  if (!isNew) {
    navButtons.push(
      createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.DELETE}`, 'Delete', ButtonStyle.Danger)
    );
  }

  if (isNew) {
    const canSave = groupName && group.channelId;
    navButtons.push(
      createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.SAVE}`, 'Create Group', ButtonStyle.Primary)
        .setDisabled(!canSave)
    );
  }

  container.addActionRowComponents(createButtonRow(...navButtons));

  return container;
}

/**
 * Build editor response
 */
function buildEditorResponse(
  context: PanelContext,
  confirmDelete: boolean = false
): PanelResponse {
  const guildId = context.guildId!;
  const userId = context.userId;

  const { group, isNew } = getEditingGroup(guildId, userId);
  const container = buildEditorContainer(context, group, isNew, confirmDelete);

  return createV2Response([container]);
}

const editorPanel: PanelOptions = {
  id: EDITOR_PANEL_ID,
  name: 'Edit Scheduled Group',
  description: 'Configure a scheduled message group',
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

    return buildEditorResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);

    // Back to list
    if (buttonId === BTN.BACK) {
      clearPanelState(guildId, userId);
      const listPanel = await import('./list');
      return listPanel.default.callback(context);
    }

    // Toggle enabled
    if (buttonId === BTN.TOGGLE) {
      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, enabled: !pending.enabled });
      } else {
        const newState = toggleGroup(guildId, group.id!);
        if (newState !== null) {
          const updatedGroup = getGroup(guildId, group.id!);
          if (updatedGroup) {
            if (newState) {
              // Re-calculate next send and schedule
              const nextSendAt = calculateNextSend(updatedGroup.schedule);
              updateGroup(guildId, group.id!, { nextSendAt });
              const refreshedGroup = getGroup(guildId, group.id!);
              if (refreshedGroup) scheduleGroup(context.client, refreshedGroup);
            } else {
              cancelGroup(group.id!);
            }
          }
        }
      }
      return buildEditorResponse(context);
    }

    // Toggle auto-pin
    if (buttonId === BTN.TOGGLE_PIN) {
      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, autoPin: !pending.autoPin });
      } else {
        // If turning OFF auto-pin and there's a pinned message, unpin it
        const unpinChannelId = group.lastPinnedChannelId || group.channelId;
        if (group.autoPin && group.lastPinnedMessageId && unpinChannelId) {
          await verifyAndUnpinMessage(context.client, unpinChannelId, group.lastPinnedMessageId);
          clearLastPinnedMessage(guildId, group.id!);
        }
        toggleAutoPin(guildId, group.id!);
      }
      return buildEditorResponse(context);
    }

    // Delete group
    if (buttonId === BTN.DELETE) {
      return buildEditorResponse(context, true);
    }

    if (buttonId === BTN.CONFIRM_DELETE) {
      if (!isNew && group.id) {
        // Unpin the last pinned message before deleting
        const unpinChannelId = group.lastPinnedChannelId || group.channelId;
        if (group.lastPinnedMessageId && unpinChannelId) {
          await verifyAndUnpinMessage(context.client, unpinChannelId, group.lastPinnedMessageId);
        }
        cancelGroup(group.id);
        deleteGroup(guildId, group.id);
      }
      clearPanelState(guildId, userId);
      const listPanel = await import('./list');
      return listPanel.default.callback(context);
    }

    if (buttonId === BTN.CANCEL_DELETE) {
      return buildEditorResponse(context);
    }

    // Save new group
    if (buttonId === BTN.SAVE && isNew) {
      const pending = getPendingGroup(guildId, userId);
      if (pending && pending.name && pending.channelId) {
        const nextSendAt = calculateNextSend(pending.schedule!);
        const newGroup = createGroup(guildId, { ...pending, nextSendAt });
        if (newGroup) {
          setPendingGroup(guildId, userId, undefined);
          updatePanelState(guildId, userId, { editingGroupId: newGroup.id });
          if (newGroup.enabled) {
            scheduleGroup(context.client, newGroup);
          }
        }
      }
      return buildEditorResponse(context);
    }

    // Navigate to schedule panel
    if (buttonId === BTN.EDIT_SCHEDULE) {
      const schedulePanel = await import('./schedule');
      return schedulePanel.default.callback(context);
    }

    // Navigate to messages panel
    if (buttonId === BTN.EDIT_MESSAGES) {
      const messagesPanel = await import('./messages');
      return messagesPanel.default.callback(context);
    }

    // Navigate to design panel
    if (buttonId === BTN.EDIT_DESIGN) {
      const designPanel = await import('./design');
      return designPanel.default.callback(context);
    }

    return buildEditorResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return buildEditorResponse(context);
    }

    if (modalId === MODAL.GROUP_NAME) {
      const name = interaction.fields.getTextInputValue('name').trim();

      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, name });
      } else if (group.id) {
        updateGroup(guildId, group.id, { name });
      }
    }

    // Send Now modal
    if (modalId === MODAL.SEND_NOW) {
      if (!isNew && group.id && group.channelId) {
        // Get skip option from dropdown
        let skipNext = false;
        try {
          const skipValues = interaction.fields.getStringSelectValues('skip_option');
          if (skipValues && skipValues.length > 0) {
            skipNext = skipValues[0] === 'skip';
          }
        } catch {
          // Default to not skipping
        }

        const { sendNow } = await import('../manager/scheduler');
        await sendNow(context.client, group as ScheduledGroup, skipNext);
      }
    }

    return buildEditorResponse(context);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);

    // Handle channel select
    if (dropdownId === 'channel_select' && values[0]) {
      const newChannelId = values[0];

      if (isNew) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, channelId: newChannelId });
      } else if (group.id) {
        const oldChannelId = group.channelId;
        const isChannelChanging = oldChannelId && oldChannelId !== newChannelId;

        // If channel is changing and there's a pinned message, unpin it from the old channel
        if (isChannelChanging && group.autoPin && group.lastPinnedMessageId) {
          const unpinChannelId = group.lastPinnedChannelId || oldChannelId;
          await verifyAndUnpinMessage(context.client, unpinChannelId, group.lastPinnedMessageId);
          clearLastPinnedMessage(guildId, group.id);
        }

        updateGroup(guildId, group.id, { channelId: newChannelId });
      }
    }

    return buildEditorResponse(context);
  },
};

export default editorPanel;
