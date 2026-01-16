/**
 * Bot Chat History Panel
 *
 * View history of messages sent as the bot.
 * Uses the unified list system with 'both' view mode (detailed + compact).
 */

import {
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalSubmitInteraction,
  MessageFlags,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2/v2Builders';
import {
  buildListView,
  handleListButton,
  handleListDropdown,
  createListState,
  ListConfig,
  ListState,
} from '@internal/utils/panel/listUtils';
import { registerButtonHandler } from '@internal/events/interactionCreate/buttonHandler';
import { registerModalHandler } from '@internal/events/interactionCreate/modalSubmitHandler';
import { updatePanelState } from '@internal/utils/panel/panelButtonHandler';
import { truncateWithEmojis } from '@internal/utils/emojiHandler';
import { getMessageRecords, clearHistory, deleteMessageRecord } from '../utils/historyManager';
import { SentMessageRecord } from '../types/botChat';

const PANEL_ID = 'bot-chat-history';
const CLEAR_ALL_BTN_ID = 'bot_chat_history_clear_all';
const CLEAR_ALL_MODAL_ID = 'bot_chat_history_clear_modal';
const DELETE_CONFIRM_MODAL_ID = 'bot_chat_history_delete_confirm';

// Delete action options (single message)
const DELETE_ACTION_BOTH = 'delete_both';
const DELETE_ACTION_REGISTRY_ONLY = 'delete_registry';

// Clear all action options
const CLEAR_ACTION_HISTORY_ONLY = 'clear_history';
const CLEAR_ACTION_BOTH = 'clear_both';

// PanelState only extends ListState - no inline confirmation states
type PanelState = ListState;

function getState(context: PanelContext): PanelState {
  return context.data?.state || createListState('detailed');
}

function formatTimestamp(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

/**
 * Format timestamp for plain text contexts (dropdowns, etc.)
 */
function formatTimestampPlain(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Items per page constants
const DETAILED_PER_PAGE = 5;
const COMPACT_PER_PAGE = 12;

// Cache for message existence checks (cleared on each panel render)
const messageExistsCache = new Map<string, boolean>();

/**
 * Check if a message exists
 */
async function checkMessageExists(client: Client, channelId: string, messageId: string): Promise<boolean> {
  const cacheKey = `${channelId}_${messageId}`;
  if (messageExistsCache.has(cacheKey)) {
    return messageExistsCache.get(cacheKey)!;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !('messages' in channel)) {
      messageExistsCache.set(cacheKey, false);
      return false;
    }
    await (channel as TextChannel).messages.fetch(messageId);
    messageExistsCache.set(cacheKey, true);
    return true;
  } catch {
    messageExistsCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Pre-check message existence for records on current page
 */
async function preCheckMessages(client: Client, records: SentMessageRecord[], state: PanelState): Promise<void> {
  const itemsPerPage = state.activeView === 'compact' ? COMPACT_PER_PAGE : DETAILED_PER_PAGE;
  const startIdx = state.currentPage * itemsPerPage;
  const pageRecords = records.slice(startIdx, startIdx + itemsPerPage);

  await Promise.all(
    pageRecords.map(record => checkMessageExists(client, record.channelId, record.messageId))
  );
}

/**
 * Get message link or deleted indicator
 */
function getMessageLinkOrDeleted(item: SentMessageRecord): string {
  const cacheKey = `${item.channelId}_${item.messageId}`;
  const exists = messageExistsCache.get(cacheKey);

  if (exists === false) {
    return '\u274C Deleted';
  }

  return `[Jump to Message](https://discord.com/channels/${item.guildId}/${item.channelId}/${item.messageId})`;
}

/**
 * Create list configuration for history panel
 */
function createListConfig(context: PanelContext): ListConfig<SentMessageRecord> {
  const { client, guildId } = context;
  const guild = guildId ? client.guilds.cache.get(guildId) : null;

  return {
    panelId: PANEL_ID,
    viewMode: 'both',
    defaultView: 'detailed',
    detailedPerPage: DETAILED_PER_PAGE,
    compactPerPage: COMPACT_PER_PAGE,

    // Required for emoji resolution (handled by list system)
    client,
    guild,

    // Delete button config
    editButtonLabel: 'Delete',
    editButtonStyle: ButtonStyle.Danger,

    formatDetailed: (item, index) => {
      const replyIndicator = item.isReply ? ' :leftwards_arrow_with_hook:' : '';
      const contentOneLine = item.content.replace(/\n/g, ' ');
      const truncatedContent = truncateWithEmojis(contentOneLine, 80);
      const messageLinkOrStatus = getMessageLinkOrDeleted(item);

      return {
        lines: [
          `**${index + 1}.** ${formatTimestamp(item.sentAt)} ${messageLinkOrStatus}${replyIndicator}`,
          `> ${truncatedContent}`,
          `-# by <@${item.sentBy}> in <#${item.channelId}>`,
        ],
      };
    },

    formatCompact: (item, index) => {
      const numStr = String(index + 1).padStart(2, '0');
      const replyIcon = item.isReply ? ' :leftwards_arrow_with_hook:' : '';
      const messageLinkOrStatus = getMessageLinkOrDeleted(item);
      const contentOneLine = item.content.replace(/\n/g, ' ');
      const preview = truncateWithEmojis(contentOneLine, 45);

      return `\`${numStr}\` ${formatTimestamp(item.sentAt)} ${messageLinkOrStatus}${replyIcon}\n> ${preview}`;
    },

    formatDropdownOption: (item, index) => {
      const numStr = String(index + 1).padStart(2, '0');
      const contentOneLine = item.content.replace(/\n/g, ' ');
      // Dropdown labels max 100 chars, account for prefix "#XX: " (5 chars)
      const label = truncateWithEmojis(contentOneLine, 90);

      const cacheKey = `${item.channelId}_${item.messageId}`;
      const exists = messageExistsCache.get(cacheKey);
      const deletedTag = exists === false ? ' [Deleted]' : '';
      const replyTag = item.isReply ? ' (Reply)' : '';

      return {
        label: `#${numStr}: ${label}`,
        value: String(index),
        description: `${formatTimestampPlain(item.sentAt)}${replyTag}${deletedTag}`,
      };
    },

    dropdownPlaceholder: 'Select a message to delete...',
    emptyMessage: 'No messages have been sent yet.',
    viewToggleLabel: 'Switch View',
  };
}

/**
 * Adjust current page after deletion if needed
 */
function adjustPageAfterDelete(state: PanelState, guildId: string): void {
  const newRecords = getMessageRecords(guildId);
  const itemsPerPage = state.activeView === 'compact' ? COMPACT_PER_PAGE : DETAILED_PER_PAGE;
  const maxPage = Math.max(0, Math.ceil(newRecords.length / itemsPerPage) - 1);
  if (state.currentPage > maxPage) {
    state.currentPage = maxPage;
  }
}

/**
 * Create delete confirmation modal with dropdown
 * @param guildId Guild ID
 * @param index Index of the record to delete
 * @param record The record being deleted (for preview in title)
 * @param activeView Current view mode to restore after deletion
 * @param currentPage Current page to restore after deletion
 */
function createDeleteConfirmModal(
  guildId: string,
  index: number,
  record: SentMessageRecord,
  activeView: 'detailed' | 'compact',
  currentPage: number
): ModalBuilder {
  const preview = truncateWithEmojis(record.content.replace(/\n/g, ' '), 30);

  const select = new StringSelectMenuBuilder()
    .setCustomId('delete_action')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Delete Message + Registry')
        .setDescription('Remove the Discord message and the history entry')
        .setValue(DELETE_ACTION_BOTH)
        .setDefault(true),
      new StringSelectMenuOptionBuilder()
        .setLabel('Delete Registry Only')
        .setDescription('Keep the Discord message, only remove from history')
        .setValue(DELETE_ACTION_REGISTRY_ONLY),
    );

  const label = new LabelBuilder()
    .setLabel('Select delete action')
    .setDescription(`Message: "${preview}"`)
    .setStringSelectMenuComponent(select);

  // Encode view and page in customId: {prefix}_{guildId}_{index}_{view}_{page}
  const modal = new ModalBuilder()
    .setCustomId(`${DELETE_CONFIRM_MODAL_ID}_${guildId}_${index}_${activeView}_${currentPage}`)
    .setTitle('Delete Message')
    .addLabelComponents(label);

  return modal;
}

/**
 * Initialize button and modal handlers
 */
function initializeHandlers(client: Client): void {
  // Delete confirmation modal handler
  registerModalHandler(client, DELETE_CONFIRM_MODAL_ID, async (client, interaction: ModalSubmitInteraction) => {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Parse customId: bot_chat_history_delete_confirm_{guildId}_{index}_{view}_{page}
    const parts = interaction.customId.split('_');
    // Parts: [bot, chat, history, delete, confirm, guildId, index, view, page]
    const page = parseInt(parts[parts.length - 1], 10);
    const view = parts[parts.length - 2] as 'detailed' | 'compact';
    const index = parseInt(parts[parts.length - 3], 10);
    const records = getMessageRecords(guildId);

    if (isNaN(index) || index < 0 || index >= records.length) {
      await interaction.reply({
        content: 'Invalid selection. The message may have already been deleted.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const record = records[index];

    // Get dropdown selection
    let selectedAction = DELETE_ACTION_BOTH; // Default
    try {
      const values = interaction.fields.getStringSelectValues('delete_action');
      if (values?.length > 0) {
        selectedAction = values[0];
      }
    } catch {
      // Dropdown not interacted with, use default
    }

    if (selectedAction === DELETE_ACTION_BOTH) {
      // Delete Message + Registry
      try {
        const channel = await client.channels.fetch(record.channelId);
        if (channel && channel.isTextBased() && 'messages' in channel) {
          const textChannel = channel as TextChannel;

          // Check bot permissions
          const botMember = textChannel.guild?.members.me;
          if (botMember && !textChannel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)) {
            await interaction.reply({
              content: 'Bot lacks permission to delete messages in that channel.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          try {
            const message = await textChannel.messages.fetch(record.messageId);
            await message.delete();
          } catch (fetchError: any) {
            // Message doesn't exist (404) - continue to delete registry
            if (fetchError.code !== 10008) {
              throw fetchError;
            }
          }
        }
      } catch (error: any) {
        // If it's not a "message not found" error, report it
        if (error.code !== 10008) {
          await interaction.reply({
            content: `Failed to delete Discord message: ${error.message}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // Delete from registry
      deleteMessageRecord(guildId, index);
    } else if (selectedAction === DELETE_ACTION_REGISTRY_ONLY) {
      // Delete Registry Only
      deleteMessageRecord(guildId, index);
    }

    // Update panel in-place after deletion, preserving view mode and page
    if (interaction.message) {
      await interaction.deferUpdate();
      const state = createListState(view || 'detailed');
      state.currentPage = isNaN(page) ? 0 : page;
      adjustPageAfterDelete(state, guildId);
      const context: PanelContext = {
        client,
        interaction,
        panelId: PANEL_ID,
        userId: interaction.user.id,
        guildId,
        accessMethod: 'direct_command',
        data: { state },
      };
      const container = await buildHistoryContainer(context, state);
      await interaction.editReply(createV2Response([container]));
      // Store state so next interaction preserves view mode
      updatePanelState(interaction.message.id, state);
    } else {
      await interaction.deferUpdate();
    }
  });

  // Clear All button - uses direct handler (bypasses panel system for modal from button)
  registerButtonHandler(client, CLEAR_ALL_BTN_ID, async (client, interaction) => {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const recordCount = getMessageRecords(guildId).length;
    if (recordCount === 0) {
      await interaction.reply({
        content: 'No messages to clear.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Dropdown for clear action selection
    const select = new StringSelectMenuBuilder()
      .setCustomId('clear_action')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Clear History Only')
          .setDescription('Keep Discord messages, only remove from history')
          .setValue(CLEAR_ACTION_HISTORY_ONLY)
          .setDefault(true),
        new StringSelectMenuOptionBuilder()
          .setLabel('Clear History + Delete Messages')
          .setDescription('Remove history AND delete all Discord messages')
          .setValue(CLEAR_ACTION_BOTH),
      );

    const label = new LabelBuilder()
      .setLabel('Select clear action')
      .setDescription(`This will affect ${recordCount} message(s)`)
      .setStringSelectMenuComponent(select);

    // Text confirmation input
    const confirmInput = new TextInputBuilder()
      .setCustomId('confirm_text')
      .setLabel('Type "CLEAR" to confirm')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('CLEAR')
      .setRequired(true)
      .setMaxLength(10);

    const modal = new ModalBuilder()
      .setCustomId(`${CLEAR_ALL_MODAL_ID}_${guildId}`)
      .setTitle('Clear All History')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(confirmInput)
      )
      .addLabelComponents(label);

    await interaction.showModal(modal);
  });

  // Clear All modal submission
  registerModalHandler(client, CLEAR_ALL_MODAL_ID, async (client, interaction: ModalSubmitInteraction) => {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const confirmText = interaction.fields.getTextInputValue('confirm_text');
    if (confirmText.toUpperCase() !== 'CLEAR') {
      await interaction.reply({
        content: 'Confirmation text did not match. History was not cleared.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get dropdown selection
    let selectedAction = CLEAR_ACTION_HISTORY_ONLY; // Default
    try {
      const values = interaction.fields.getStringSelectValues('clear_action');
      if (values?.length > 0) {
        selectedAction = values[0];
      }
    } catch {
      // Dropdown not interacted with, use default
    }

    const records = getMessageRecords(guildId);
    let deletedCount = 0;
    let failedCount = 0;

    // If user wants to delete Discord messages too
    if (selectedAction === CLEAR_ACTION_BOTH) {
      for (const record of records) {
        try {
          const channel = await client.channels.fetch(record.channelId);
          if (channel && channel.isTextBased() && 'messages' in channel) {
            const textChannel = channel as TextChannel;
            const botMember = textChannel.guild?.members.me;

            // Check permissions
            if (botMember && textChannel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)) {
              try {
                const message = await textChannel.messages.fetch(record.messageId);
                await message.delete();
                deletedCount++;
              } catch (fetchError: any) {
                // Message doesn't exist (404) - count as already deleted
                if (fetchError.code === 10008) {
                  deletedCount++;
                } else {
                  failedCount++;
                }
              }
            } else {
              failedCount++;
            }
          }
        } catch {
          failedCount++;
        }
      }
    }

    // Clear the history registry
    clearHistory(guildId);

    // Build result message
    let resultMessage = 'History cleared successfully.';
    if (selectedAction === CLEAR_ACTION_BOTH) {
      if (failedCount > 0) {
        resultMessage = `History cleared. Deleted ${deletedCount} message(s), ${failedCount} failed (missing permissions or already deleted).`;
      } else {
        resultMessage = `History cleared and ${deletedCount} Discord message(s) deleted.`;
      }
    }

    // Update the panel in-place
    if (interaction.message) {
      await interaction.deferUpdate();
      const container = new ContainerBuilder().setAccentColor(V2Colors.primary);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Bot Chat History\n\n${resultMessage}`)
      );
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('No messages have been sent yet.')
      );
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`panel_${PANEL_ID}_btn_refresh`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(CLEAR_ALL_BTN_ID)
            .setLabel('Clear All')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true),
        )
      );
      await interaction.editReply(createV2Response([container]));
    } else {
      await interaction.reply({
        content: resultMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}

/**
 * Build the history panel container
 */
async function buildHistoryContainer(context: PanelContext, state: PanelState): Promise<ContainerBuilder> {
  const guildId = context.guildId;

  if (!guildId) {
    const container = new ContainerBuilder().setAccentColor(V2Colors.warning);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## Bot Chat History\n\nNo guild context available.')
    );
    return container;
  }

  const allRecords = getMessageRecords(guildId);

  // Pre-check message existence for current page
  await preCheckMessages(context.client, allRecords, state);

  const container = new ContainerBuilder().setAccentColor(V2Colors.primary);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Bot Chat History')
  );

  // Show count
  if (allRecords.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${allRecords.length} message(s) recorded`)
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Build list using unified system
  const listConfig = createListConfig(context);
  buildListView(container, allRecords, state, listConfig);

  // Separator before action buttons
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Action buttons
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${PANEL_ID}_btn_refresh`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(CLEAR_ALL_BTN_ID)
        .setLabel('Clear All')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(allRecords.length === 0),
    )
  );

  return container;
}

const sendHistoryPanel: PanelOptions = {
  id: PANEL_ID,
  name: 'Bot Chat History',
  description: 'View history of messages sent as the bot',
  category: 'Moderation',

  showInAdminPanel: true,
  adminPanelOrder: 50,
  adminPanelIcon: '📜',
  panelScope: 'guild',

  requiredIntents: [GatewayIntentBits.Guilds],

  initialize: initializeHandlers,

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    const state = getState(context);
    const container = await buildHistoryContainer(context, state);
    return createV2Response([container]);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse | null> => {
    const state = getState(context);
    const guildId = context.guildId;

    // Handle list buttons (pagination, view toggle, item select)
    const allRecords = guildId ? getMessageRecords(guildId) : [];
    const listConfig = createListConfig(context);
    const listResult = handleListButton(buttonId, allRecords, state, listConfig);

    if (listResult?.handled) {
      Object.assign(state, listResult.newState);

      // item_select = Delete button clicked → show confirmation modal
      if (listResult.action === 'item_select' && listResult.selectedIndex !== undefined && guildId) {
        const record = allRecords[listResult.selectedIndex];
        if (record) {
          return { modal: createDeleteConfirmModal(guildId, listResult.selectedIndex, record, state.activeView, state.currentPage) };
        }
      }

      context.data = { ...context.data, state };
      const container = await buildHistoryContainer(context, state);
      return createV2Response([container]);
    }

    // Handle panel-specific buttons
    if (buttonId === 'refresh') {
      state.currentPage = 0;
    }
    // Note: clear_all is handled by registerButtonHandler (uses direct handler)

    context.data = { ...context.data, state };
    const container = await buildHistoryContainer(context, state);
    return createV2Response([container]);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const state = getState(context);
    const guildId = context.guildId;
    const allRecords = guildId ? getMessageRecords(guildId) : [];

    // Handle dropdown using same pattern as button handler
    if (values.length > 0 && guildId) {
      const listResult = handleListDropdown(values[0], allRecords, state);

      if (listResult?.handled) {
        Object.assign(state, listResult.newState);

        // item_select = dropdown selection → show confirmation modal
        if (listResult.action === 'item_select' && listResult.selectedIndex !== undefined) {
          const record = allRecords[listResult.selectedIndex];
          if (record) {
            return { modal: createDeleteConfirmModal(guildId, listResult.selectedIndex, record, state.activeView, state.currentPage) };
          }
        }
      }
    }

    context.data = { ...context.data, state };
    const container = await buildHistoryContainer(context, state);
    return createV2Response([container]);
  },
};

export default sendHistoryPanel;
