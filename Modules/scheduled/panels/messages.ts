/**
 * Scheduled Messages - Messages Panel
 *
 * List and edit individual messages in a group.
 * Uses ONE SectionBuilder per message to maximize capacity.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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
  addMessage,
  updateMessage,
  deleteMessage,
  updateGroup,
  setMessageQueueStatus,
  resetAllCounters,
  updateMessageSentCount,
} from '../utils/storage';
import {
  getPendingGroup,
  setPendingGroup,
  getMessagesPage,
  setMessagesPage,
  getSelectedMessageIndex,
  setSelectedMessageIndex,
  getEditingGroup,
  getEditingGroupId,
  getMessagesViewMode,
  toggleMessagesViewMode,
} from '../utils/pageState';
import { ScheduledGroup, ScheduledMessage } from '../types/scheduled';
import { isMessageOnCooldown } from '../manager/selection';
import {
  MESSAGES_PANEL_ID,
  EDITOR_PANEL_ID,
  MESSAGES_PER_PAGE,
  BTN,
  MODAL,
  DROPDOWN,
  STATUS_ICONS,
} from './constants';


/**
 * Format message status
 */
function getMessageStatus(msg: ScheduledMessage, index: number, currentIndex: number, isSequential: boolean): string {
  const parts: string[] = [];

  // Queue status (highest priority in display)
  if (msg.forceNext) {
    parts.push('⚡ FORCE NEXT');
  } else if (msg.queuePosition && msg.queuePosition > 0) {
    parts.push(`📋 Queued #${msg.queuePosition}`);
  } else if (isSequential && index === currentIndex) {
    parts.push(`${STATUS_ICONS.NEXT} next`);
  }

  // Image indicator
  if (msg.image) {
    parts.push('🖼️');
  }

  // Sent status
  if (msg.sentCount > 0) {
    const time = msg.lastSentAt ? ` <t:${Math.floor(msg.lastSentAt / 1000)}:d>` : '';
    parts.push(`${STATUS_ICONS.SENT} ${msg.sentCount}x${time}`);
  } else if (parts.length === 0) {
    parts.push(`${STATUS_ICONS.NEVER} never sent`);
  }

  return parts.join(' • ');
}

// Compact view shows more messages per page
const COMPACT_MESSAGES_PER_PAGE = 15;

/**
 * Format a compact message line (short status icons)
 */
function formatCompactLine(msg: ScheduledMessage, index: number, currentIndex: number, isSequential: boolean, onCooldown: boolean, guild: any, client: any): string {
  const numStr = String(index + 1).padStart(2, '0');

  // Cooldown prefix (clock emoji for messages not in selection pool)
  const cooldownPrefix = onCooldown ? '🕒 ' : '';

  // Build compact status icons
  let icons = '';
  if (msg.forceNext) icons += '⚡';
  else if (msg.queuePosition && msg.queuePosition > 0) icons += '📋';
  else if (isSequential && index === currentIndex) icons += '→';
  if (msg.image) icons += '🖼️';
  if (msg.sentCount > 0) icons += '✓';

  // Truncate content more aggressively for compact view
  let preview = msg.content.substring(0, 35);
  if (msg.content.length > 35) preview += '...';
  preview = resolveEmojisInText(preview, client, guild);
  // Escape any newlines
  preview = preview.replace(/\n/g, ' ');

  const iconSuffix = icons ? ` ${icons}` : '';
  return `${cooldownPrefix}\`${numStr}\` ${preview}${iconSuffix}`;
}

/**
 * Build messages panel container
 */
function buildMessagesContainer(
  context: PanelContext,
  group: Partial<ScheduledGroup>,
  isNew: boolean,
  currentPage: number,
  totalPages: number,
  viewMode: 'detailed' | 'compact'
): ContainerBuilder {
  const container = createContainer(V2Colors.primary);
  const messages = group.messages || [];
  const isSequential = group.selectionMode === 'sequential';
  const currentIndex = group.currentIndex || 0;

  // Title
  const groupName = group.name || 'Group';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${groupName} - Messages`)
  );

  container.addSeparatorComponents(createSeparator());

  // Empty state
  if (messages.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**No messages yet**\n\n' +
        'Add messages to be sent on schedule.'
      )
    );
  } else if (viewMode === 'compact') {
    // === COMPACT VIEW ===
    const perPage = COMPACT_MESSAGES_PER_PAGE;
    const startIdx = (currentPage - 1) * perPage;
    const endIdx = Math.min(startIdx + perPage, messages.length);
    const pageMessages = messages.slice(startIdx, endIdx);
    const guild = context.guildId ? context.client.guilds.cache.get(context.guildId) : null;

    // Build text block with all messages
    const lines = pageMessages.map((msg, i) => {
      const globalIndex = startIdx + i;
      // Check if message is on cooldown (not in selection pool)
      const onCooldown = group.id ? isMessageOnCooldown(group as ScheduledGroup, globalIndex) : false;
      return formatCompactLine(msg, globalIndex, currentIndex, isSequential, onCooldown, guild, context.client);
    });

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n'))
    );

    // Dropdown to select message for editing
    const selectOptions = pageMessages.map((msg, i) => {
      const globalIndex = startIdx + i;
      const numStr = String(globalIndex + 1).padStart(2, '0');
      let label = msg.content.substring(0, 50);
      if (msg.content.length > 50) label += '...';
      // Remove newlines for label
      label = label.replace(/\n/g, ' ');

      return new StringSelectMenuOptionBuilder()
        .setLabel(`#${numStr}: ${label.substring(0, 90)}`)
        .setValue(String(globalIndex))
        .setDescription(msg.sentCount > 0 ? `Sent ${msg.sentCount}x` : 'Never sent');
    });

    const msgSelect = new StringSelectMenuBuilder()
      .setCustomId(`sched_msg_select`)  // Bypass panel system for modal
      .setPlaceholder('Select a message to edit...')
      .addOptions(selectOptions);

    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(msgSelect)
    );

    // Page indicator
    const compactTotalPages = Math.max(1, Math.ceil(messages.length / perPage));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Page ${currentPage} of ${compactTotalPages} • Compact view`)
    );
  } else {
    // === DETAILED VIEW ===
    const startIdx = (currentPage - 1) * MESSAGES_PER_PAGE;
    const endIdx = Math.min(startIdx + MESSAGES_PER_PAGE, messages.length);
    const pageMessages = messages.slice(startIdx, endIdx);
    const guild = context.guildId ? context.client.guilds.cache.get(context.guildId) : null;

    // Show messages as sections with Edit button (ONE section per message)
    pageMessages.forEach((msg, i) => {
      const globalIndex = startIdx + i;
      let preview = msg.content.length > 40
        ? msg.content.substring(0, 40) + '...'
        : msg.content;
      preview = resolveEmojisInText(preview, context.client, guild);
      const status = getMessageStatus(msg, globalIndex, currentIndex, isSequential);
      const numStr = String(globalIndex + 1).padStart(2, '0');

      // Check if message is on cooldown (not in selection pool)
      const onCooldown = group.id ? isMessageOnCooldown(group as ScheduledGroup, globalIndex) : false;
      const cooldownPrefix = onCooldown ? '🕒 ' : '';

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${cooldownPrefix}**${numStr}.** ${preview}`),
            new TextDisplayBuilder().setContent(`-# ${status}`)
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`sched_edit_msg_${globalIndex}`)  // Bypass panel system for modal
              .setLabel('Edit')
              .setStyle(ButtonStyle.Secondary)
          )
      );
    });

    // Page indicator
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Page ${currentPage} of ${totalPages}`)
    );
  }

  container.addSeparatorComponents(createSeparator());

  // Pagination buttons with view toggle
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${MESSAGES_PANEL_ID}_btn_${BTN.MSG_PREV}`, '◀', ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      createButton(`panel_${MESSAGES_PANEL_ID}_btn_${BTN.MSG_PAGE}`, `${currentPage}/${totalPages}`, ButtonStyle.Secondary)
        .setDisabled(true),
      createButton(`panel_${MESSAGES_PANEL_ID}_btn_${BTN.MSG_NEXT}`, '▶', ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages),
      createButton(`panel_${MESSAGES_PANEL_ID}_btn_${BTN.TOGGLE_VIEW}`, 'Switch View', ButtonStyle.Secondary)
    )
  );

  // Action buttons - Row 1
  container.addActionRowComponents(
    createButtonRow(
      createButton('sched_add_msg', '+ Add Message', ButtonStyle.Primary),  // Bypass for modal
      createButton(`panel_${MESSAGES_PANEL_ID}_btn_${BTN.BULK_EDIT}`, 'Bulk Edit', ButtonStyle.Secondary),
      createButton('sched_reset_counters', 'Reset Counters', ButtonStyle.Danger)  // Bypass for modal
        .setDisabled(messages.length === 0),
      createButton(`panel_${MESSAGES_PANEL_ID}_btn_${BTN.BACK}`, 'Back', ButtonStyle.Secondary)
    )
  );

  return container;
}

/**
 * Build messages panel response
 */
function buildMessagesResponse(context: PanelContext): PanelResponse {
  const guildId = context.guildId!;
  const userId = context.userId;

  const { group, isNew } = getEditingGroup(guildId, userId);
  const messages = group.messages || [];
  const viewMode = getMessagesViewMode(guildId, userId);

  // Calculate total pages based on view mode
  const perPage = viewMode === 'compact' ? COMPACT_MESSAGES_PER_PAGE : MESSAGES_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(messages.length / perPage));

  let currentPage = getMessagesPage(guildId, userId);
  if (currentPage > totalPages) {
    currentPage = totalPages;
    setMessagesPage(guildId, userId, currentPage);
  }

  const container = buildMessagesContainer(context, group, isNew, currentPage, totalPages, viewMode);
  return createV2Response([container]);
}

const messagesPanel: PanelOptions = {
  id: MESSAGES_PANEL_ID,
  name: 'Edit Messages',
  description: 'Manage messages in a scheduled group',
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

    return buildMessagesResponse(context);
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

    // Toggle view mode
    if (buttonId === BTN.TOGGLE_VIEW) {
      toggleMessagesViewMode(guildId, userId);
      setMessagesPage(guildId, userId, 1); // Reset to page 1 when switching views
      return buildMessagesResponse(context);
    }

    // Pagination
    if (buttonId === BTN.MSG_PREV) {
      const currentPage = getMessagesPage(guildId, userId);
      setMessagesPage(guildId, userId, Math.max(1, currentPage - 1));
      return buildMessagesResponse(context);
    }

    if (buttonId === BTN.MSG_NEXT) {
      const messages = group.messages || [];
      const viewMode = getMessagesViewMode(guildId, userId);
      const perPage = viewMode === 'compact' ? COMPACT_MESSAGES_PER_PAGE : MESSAGES_PER_PAGE;
      const totalPages = Math.ceil(messages.length / perPage);
      const currentPage = getMessagesPage(guildId, userId);
      setMessagesPage(guildId, userId, Math.min(totalPages, currentPage + 1));
      return buildMessagesResponse(context);
    }

    // Add message - return null to let panel system show modal
    if (buttonId === BTN.ADD_MSG) {
      return null as any; // Modal will be shown
    }

    // Edit message
    if (buttonId.startsWith(`${BTN.EDIT_MSG}_`)) {
      const index = parseInt(buttonId.replace(`${BTN.EDIT_MSG}_`, ''), 10);
      setSelectedMessageIndex(guildId, userId, index);
      return null as any; // Modal will be shown
    }

    // Bulk edit - pass group ID through context.data
    if (buttonId === BTN.BULK_EDIT) {
      const editingId = getEditingGroupId(guildId, userId);
      context.data = { groupId: editingId, isNew: isNew, source: 'messages' };
      const bulkPanel = await import('./bulkEdit');
      return bulkPanel.default.callback(context);
    }

    return buildMessagesResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(guildId, userId);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return buildMessagesResponse(context);
    }

    // Add new message
    if (modalId === MODAL.ADD_MESSAGE) {
      const content = interaction.fields.getTextInputValue('content').trim();
      let image: string | undefined;
      try {
        image = interaction.fields.getTextInputValue('image').trim() || undefined;
      } catch {
        // Image field might not be present
      }

      if (content) {
        if (isNew) {
          const pending = getPendingGroup(guildId, userId) || {};
          const messages = [...(pending.messages || [])];
          messages.push({
            id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
            content,
            sentCount: 0,
            lastSentAt: null,
            createdAt: Date.now(),
            image,
          });
          setPendingGroup(guildId, userId, { ...pending, messages });
        } else if (group.id) {
          addMessage(guildId, group.id, content, image);
        }
      }
    }

    // Edit existing message (empty content = delete)
    if (modalId === MODAL.EDIT_MESSAGE) {
      const content = interaction.fields.getTextInputValue('content').trim();
      const index = getSelectedMessageIndex(guildId, userId);

      // Get image URL
      let image: string | undefined;
      try {
        image = interaction.fields.getTextInputValue('image').trim() || undefined;
      } catch {
        // Image field might not be present
      }

      // Get queue mode from dropdown (Components V2 modal)
      let queueMode: 'none' | 'force' | 'queue' = 'none';
      try {
        const queueValues = interaction.fields.getStringSelectValues('queue_mode');
        if (queueValues && queueValues.length > 0) {
          queueMode = queueValues[0] as 'none' | 'force' | 'queue';
        }
      } catch {
        // Dropdown might not be present or accessible
      }

      // Get sent count
      let newSentCount: number | undefined;
      try {
        const sentCountStr = interaction.fields.getTextInputValue('sent_count').trim();
        if (sentCountStr !== '') {
          const parsed = parseInt(sentCountStr, 10);
          if (!isNaN(parsed)) {
            newSentCount = Math.max(0, parsed);
          }
        }
      } catch {
        // Field might not be present
      }

      if (index !== undefined) {
        const messages = group.messages || [];
        const msg = messages[index];

        if (msg) {
          if (content) {
            // Update message content and image
            if (isNew) {
              const pending = getPendingGroup(guildId, userId) || {};
              const newMessages = [...(pending.messages || [])];
              if (newMessages[index]) {
                newMessages[index] = {
                  ...newMessages[index],
                  content,
                  image,
                  sentCount: newSentCount !== undefined ? newSentCount : newMessages[index].sentCount,
                  forceNext: queueMode === 'force' ? true : undefined,
                  queuePosition: queueMode === 'queue' ? (newMessages[index].queuePosition || Date.now()) : undefined,
                };
                // If force, clear forceNext from other messages
                if (queueMode === 'force') {
                  newMessages.forEach((m, i) => {
                    if (i !== index) m.forceNext = undefined;
                  });
                }
                setPendingGroup(guildId, userId, { ...pending, messages: newMessages });
              }
            } else if (group.id) {
              updateMessage(guildId, group.id, msg.id, content, image);
              // Update queue status
              setMessageQueueStatus(guildId, group.id, msg.id, queueMode);
              // Update sent count if changed
              if (newSentCount !== undefined && newSentCount !== msg.sentCount) {
                updateMessageSentCount(guildId, group.id, msg.id, newSentCount);
              }
            }
          } else {
            // Empty content = delete message
            if (isNew) {
              const pending = getPendingGroup(guildId, userId) || {};
              const newMessages = [...(pending.messages || [])];
              newMessages.splice(index, 1);
              setPendingGroup(guildId, userId, { ...pending, messages: newMessages });
            } else if (group.id) {
              deleteMessage(guildId, group.id, msg.id);
            }
          }
        }
      }

      setSelectedMessageIndex(guildId, userId, undefined);
    }

    // Reset all counters
    if (modalId === MODAL.RESET_COUNTERS) {
      let confirmed = false;
      try {
        const confirmValues = interaction.fields.getStringSelectValues('confirm_reset');
        if (confirmValues && confirmValues.length > 0 && confirmValues[0] === 'confirm') {
          confirmed = true;
        }
      } catch {
        // Dropdown not interacted with - treat as cancel
      }

      if (confirmed && !isNew && group.id) {
        resetAllCounters(guildId, group.id);
      } else if (confirmed && isNew) {
        // Reset counters for pending group
        const pending = getPendingGroup(guildId, userId) || {};
        const newMessages = (pending.messages || []).map(m => ({
          ...m,
          sentCount: 0,
          lastSentAt: null,
        }));
        setPendingGroup(guildId, userId, { ...pending, messages: newMessages, currentIndex: 0 });
      }
    }

    return buildMessagesResponse(context);
  },
};

export default messagesPanel;
