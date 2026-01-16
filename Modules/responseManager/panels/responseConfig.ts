/**
 * Response Manager - Response Config Panel
 *
 * Configure responses for react/reply/respond types.
 * Features pagination and edit buttons for each response.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
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
  createButton,
  createButtonRow,
  V2Colors,
} from '@internal/utils/panel/v2';
import { paginate } from '@internal/utils/panel/paginationUtils';
import { getMergedConfig } from '@internal/utils/configManager';

import { getGroup, updateGroup } from '../utils/storage';
import {
  getPanelState,
  updatePanelState,
  getEditingGroupId,
} from '../utils/pageState';
import { parseEmoji } from '@internal/utils/emojiHandler';
import { formatVariablesHelp, formatResponsePreview } from '../utils/responseVariables';
import { ResponseGroup, ResponseItem, SelectionMode } from '../types/responseManager';
import {
  RESPONSE_CONFIG_PANEL_ID,
  BTN,
  MODAL,
  RESPONSES_PER_PAGE,
  DEFAULT_MAX_RESPONSE_LENGTH,
} from './constants';

const MODULE_NAME = 'response-manager';
const CONFIG_FILE = 'response-manager-config.json';

/**
 * Get max response length from config
 */
function getMaxResponseLength(guildId: string): number {
  const config = getMergedConfig(CONFIG_FILE, guildId);
  return config.properties?.maxResponseLength?.value ?? DEFAULT_MAX_RESPONSE_LENGTH;
}

/**
 * Get response type label with emoji
 */
function getResponseTypeLabel(type: string): string {
  switch (type) {
    case 'react': return '😀 Emoji Reactions';
    case 'reply': return '💬 Reply Messages';
    case 'respond': return '📤 Response Messages';
    default: return 'Responses';
  }
}

/**
 * Get response type help text
 */
function getResponseTypeHelp(type: string): string {
  switch (type) {
    case 'react':
      return 'Add emoji reactions to matching messages.';
    case 'reply':
      return 'Reply directly to matching messages.';
    case 'respond':
      return 'Send a new message in the channel.';
    default:
      return 'Configure responses for this trigger.';
  }
}

/**
 * Get the group being edited
 */
function getEditingGroup(context: PanelContext): ResponseGroup | null {
  const guildId = context.guildId!;
  const userId = context.userId;

  const editingId = getEditingGroupId(guildId, userId);
  if (!editingId) {
    const state = getPanelState(guildId, userId);
    if (state.pendingGroup) {
      return state.pendingGroup as ResponseGroup;
    }
    return null;
  }

  return getGroup(guildId, editingId) || null;
}

/**
 * Check if editing a pending (unsaved) group
 */
function isPendingGroup(context: PanelContext): boolean {
  const guildId = context.guildId!;
  const userId = context.userId;
  return !getEditingGroupId(guildId, userId);
}

/**
 * Calculate total character length of all responses
 */
function getTotalResponseLength(responses: ResponseItem[] | undefined): number {
  if (!responses || responses.length === 0) return 0;
  return responses.reduce((sum, r) => sum + r.value.length, 0);
}

/**
 * Create small separator
 */
function createSmallSeparator(): SeparatorBuilder {
  return new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
}

/**
 * Build response config container
 */
function buildResponseConfigContainer(context: PanelContext, group: ResponseGroup): ContainerBuilder {
  const guildId = context.guildId!;
  const userId = context.userId;
  const state = getPanelState(guildId, userId);
  const maxLength = getMaxResponseLength(guildId);

  const container = createContainer(V2Colors.info);
  const responses = group.responses || [];
  const totalLength = getTotalResponseLength(responses);

  // Pagination using standard utility
  const currentPage = state.responsesPage || 0;
  const paginated = paginate(responses, currentPage, {
    itemsPerPage: RESPONSES_PER_PAGE,
    buttonPrefix: `panel_${RESPONSE_CONFIG_PANEL_ID}_resp`,
  });

  // Title with Add button as accessory
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${getResponseTypeLabel(group.responseType)}`),
        new TextDisplayBuilder().setContent(`-# ${getResponseTypeHelp(group.responseType)}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.ADD_RESPONSE}`)
          .setLabel('Add')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(totalLength >= maxLength)
      )
  );

  container.addSeparatorComponents(createSmallSeparator());

  // Selection mode dropdown
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`panel_${RESPONSE_CONFIG_PANEL_ID}_dropdown_selection_mode`)
        .setPlaceholder(`Mode: ${group.selectionMode === 'random' ? 'Random' : 'Sequential'}`)
        .addOptions([
          { label: '🎲 Random', value: 'random', description: 'Pick a random response each time', default: group.selectionMode === 'random' },
          { label: '📋 Sequential', value: 'sequential', description: 'Cycle through responses in order', default: group.selectionMode === 'sequential' },
        ])
    )
  );

  container.addSeparatorComponents(createSmallSeparator());

  // Response list with edit buttons
  if (responses.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Responses** (${responses.length}) — ${totalLength}/${maxLength} chars`)
    );

    paginated.items.forEach((response, idx) => {
      const globalIdx = paginated.currentPage * RESPONSES_PER_PAGE + idx;
      // Use displayValue for emojis, formatted preview for messages (highlights variables)
      const displayText = group.responseType === 'react'
        ? (response.displayValue || response.value)
        : formatResponsePreview(response.value, 60);

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`\`${globalIdx + 1}.\` ${displayText}`)
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.EDIT_RESPONSE}_${globalIdx}`)
              .setLabel('Edit')
              .setStyle(ButtonStyle.Secondary)
          )
      );
    });

    // Tip about removing
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# *Submit empty to remove*`)
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**No responses configured**')
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# *Add at least one response to activate this trigger.*`)
    );
  }

  container.addSeparatorComponents(createSmallSeparator());

  // History tracking toggle (default: true)
  const trackHistory = group.trackHistory !== false;
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`📜 **Track History:** ${trackHistory ? 'Enabled' : 'Disabled'}`),
        new TextDisplayBuilder().setContent(`-# *Enable to record triggers for reply-based lookups*`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.TOGGLE_HISTORY}`)
          .setLabel(trackHistory ? 'Disable' : 'Enable')
          .setStyle(trackHistory ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
  );

  // Variables help button (only for reply/respond types)
  if (group.responseType === 'reply' || group.responseType === 'respond') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# 💡 *Use \\{variables\\} in your messages for dynamic content*`)
    );
  }

  // Pagination and action controls
  const actionButtons: ButtonBuilder[] = [
    createButton(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.RESP_PREV}`, '◀️', ButtonStyle.Secondary)
      .setDisabled(!paginated.hasPrev),
    createButton(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_resp_page`, `${paginated.currentPage + 1}/${paginated.totalPages}`, ButtonStyle.Secondary)
      .setDisabled(true),
    createButton(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.RESP_NEXT}`, '▶️', ButtonStyle.Secondary)
      .setDisabled(!paginated.hasNext),
  ];

  // Add Variables Help button for text response types
  if (group.responseType === 'reply' || group.responseType === 'respond') {
    actionButtons.push(
      createButton(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.VARS_HELP}`, '❓ Variables', ButtonStyle.Secondary)
    );
  }

  actionButtons.push(
    createButton(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.BACK}`, '◀ Back', ButtonStyle.Secondary)
  );

  container.addActionRowComponents(createButtonRow(...actionButtons));

  return container;
}

/**
 * Build response config response
 */
function buildResponseConfigResponse(context: PanelContext): PanelResponse {
  const group = getEditingGroup(context);

  if (!group) {
    return createV2Response([
      createContainer(V2Colors.danger)
        .addTextDisplayComponents(createText('## Error'))
        .addTextDisplayComponents(createText('No group selected for editing.'))
    ]);
  }

  const container = buildResponseConfigContainer(context, group);
  return createV2Response([container]);
}

const responseConfigPanel: PanelOptions = {
  id: RESPONSE_CONFIG_PANEL_ID,
  name: 'Response Configuration',
  description: 'Configure response messages or reactions',
  category: 'Settings',

  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    return buildResponseConfigResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse | null> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const group = getEditingGroup(context);
    const state = getPanelState(guildId, userId);

    if (!group) {
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    // Pagination - Previous
    if (buttonId === BTN.RESP_PREV) {
      const currentPage = state.responsesPage || 0;
      const paginated = paginate(group.responses || [], currentPage, {
        itemsPerPage: RESPONSES_PER_PAGE,
        buttonPrefix: '',
      });
      if (paginated.hasPrev) {
        updatePanelState(guildId, userId, { responsesPage: paginated.currentPage - 1 });
      }
      return buildResponseConfigResponse(context);
    }

    // Pagination - Next
    if (buttonId === BTN.RESP_NEXT) {
      const currentPage = state.responsesPage || 0;
      const paginated = paginate(group.responses || [], currentPage, {
        itemsPerPage: RESPONSES_PER_PAGE,
        buttonPrefix: '',
      });
      if (paginated.hasNext) {
        updatePanelState(guildId, userId, { responsesPage: paginated.currentPage + 1 });
      }
      return buildResponseConfigResponse(context);
    }

    // Edit response - show modal
    if (buttonId.startsWith(BTN.EDIT_RESPONSE + '_')) {
      const idx = parseInt(buttonId.replace(BTN.EDIT_RESPONSE + '_', ''), 10);
      const responses = group.responses || [];

      if (idx >= 0 && idx < responses.length) {
        const responseItem = responses[idx];
        const label = group.responseType === 'react' ? 'Emoji' : 'Message';

        // For emojis, show inputValue (what user typed); for messages, show value
        const modalValue = group.responseType === 'react'
          ? (responseItem.inputValue || responseItem.displayValue || responseItem.value)
          : responseItem.value;

        const modal = new ModalBuilder()
          .setCustomId(`panel_${RESPONSE_CONFIG_PANEL_ID}_modal_${MODAL.EDIT_RESPONSE}_${idx}`)
          .setTitle(`Edit ${label} #${idx + 1}`)
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('response')
                .setLabel(`${label} (empty to remove)`)
                .setStyle(group.responseType === 'react' ? TextInputStyle.Short : TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(group.responseType === 'react' ? 100 : 2000)
                .setValue(modalValue)
            )
          );

        if (context.interaction && 'showModal' in context.interaction) {
          await context.interaction.showModal(modal);
        }
        return null;
      }
    }

    // Add response - show modal
    if (buttonId === BTN.ADD_RESPONSE) {
      const placeholder = group.responseType === 'react'
        ? '👍 or :thumbsup: or custom emoji ID'
        : 'Enter your response message...';

      const label = group.responseType === 'react' ? 'Emoji' : 'Message';

      const modal = new ModalBuilder()
        .setCustomId(`panel_${RESPONSE_CONFIG_PANEL_ID}_modal_${MODAL.ADD_RESPONSE}`)
        .setTitle(`Add ${label}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('response')
              .setLabel(label)
              .setStyle(group.responseType === 'react' ? TextInputStyle.Short : TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(group.responseType === 'react' ? 100 : 2000)
              .setPlaceholder(placeholder)
          )
        );

      if (context.interaction && 'showModal' in context.interaction) {
        await context.interaction.showModal(modal);
      }
      return null;
    }

    // Toggle history tracking
    if (buttonId === BTN.TOGGLE_HISTORY) {
      const currentValue = group.trackHistory !== false;
      const newValue = !currentValue;

      if (isPendingGroup(context)) {
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, trackHistory: newValue }
        });
      } else {
        updateGroup(guildId, group.id, { trackHistory: newValue });
      }
      return buildResponseConfigResponse(context);
    }

    // Variables help - show help panel
    if (buttonId === BTN.VARS_HELP) {
      const helpText = formatVariablesHelp();
      const helpContainer = createContainer(V2Colors.info)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('## Available Variables')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(helpText)
        )
        .addActionRowComponents(
          createButtonRow(
            createButton(`panel_${RESPONSE_CONFIG_PANEL_ID}_btn_${BTN.VARS_BACK}`, '◀ Back', ButtonStyle.Secondary)
          )
        );

      return createV2Response([helpContainer]);
    }

    // Back from variables help - return to response config
    if (buttonId === BTN.VARS_BACK) {
      return buildResponseConfigResponse(context);
    }

    // Back - return to editor
    if (buttonId === BTN.BACK) {
      updatePanelState(guildId, userId, { responsesPage: 0 });
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    return buildResponseConfigResponse(context);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const group = getEditingGroup(context);
    const state = getPanelState(guildId, userId);

    if (!group) {
      return buildResponseConfigResponse(context);
    }

    if (dropdownId === 'selection_mode') {
      const newMode = values[0] as SelectionMode;

      if (isPendingGroup(context)) {
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, selectionMode: newMode }
        });
      } else {
        updateGroup(guildId, group.id, { selectionMode: newMode });
      }
    }

    return buildResponseConfigResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const group = getEditingGroup(context);
    const state = getPanelState(guildId, userId);
    const maxLength = getMaxResponseLength(guildId);

    if (!group) {
      return buildResponseConfigResponse(context);
    }

    const interaction = context.interaction;
    if (!interaction || !('fields' in interaction)) {
      return buildResponseConfigResponse(context);
    }

    // Edit existing response (or delete if empty)
    if (modalId.startsWith(MODAL.EDIT_RESPONSE + '_')) {
      const idx = parseInt(modalId.replace(MODAL.EDIT_RESPONSE + '_', ''), 10);
      const responses = [...(group.responses || [])];

      if (idx >= 0 && idx < responses.length) {
        const inputValue = interaction.fields.getTextInputValue('response').trim();

        // If empty, delete the response
        if (!inputValue) {
          responses.splice(idx, 1);

          if (isPendingGroup(context)) {
            updatePanelState(guildId, userId, {
              pendingGroup: { ...state.pendingGroup, responses }
            });
          } else {
            updateGroup(guildId, group.id, { responses });
          }

          // Adjust page if needed
          const totalPages = Math.max(1, Math.ceil(responses.length / RESPONSES_PER_PAGE));
          const currentPage = state.responsesPage || 0;
          if (currentPage >= totalPages) {
            updatePanelState(guildId, userId, { responsesPage: Math.max(0, totalPages - 1) });
          }

          return buildResponseConfigResponse(context);
        }

        let newItem: ResponseItem;

        // For react type, validate and parse emoji
        if (group.responseType === 'react' && context.client) {
          const guild = context.interaction && 'guild' in context.interaction
            ? (context.interaction as any).guild
            : null;

          const result = parseEmoji(inputValue, context.client, guild);
          if (!result.success) {
            return buildResponseConfigResponse(context);
          }
          newItem = {
            value: result.identifier!,
            displayValue: result.displayEmoji!,
            inputValue: inputValue,
          };
        } else {
          newItem = { value: inputValue };
        }

        // Check total length
        const oldLength = responses[idx].value.length;
        const newTotalLength = getTotalResponseLength(responses) - oldLength + newItem.value.length;
        if (newTotalLength > maxLength) {
          return buildResponseConfigResponse(context);
        }

        responses[idx] = newItem;

        if (isPendingGroup(context)) {
          updatePanelState(guildId, userId, {
            pendingGroup: { ...state.pendingGroup, responses }
          });
        } else {
          updateGroup(guildId, group.id, { responses });
        }
      }
    }

    // Add new response
    if (modalId === MODAL.ADD_RESPONSE) {
      const inputValue = interaction.fields.getTextInputValue('response').trim();
      const currentLength = getTotalResponseLength(group.responses);

      if (inputValue && (currentLength + inputValue.length) <= maxLength) {
        let newItem: ResponseItem;

        // For react type, validate and parse emoji
        if (group.responseType === 'react' && context.client) {
          const guild = context.interaction && 'guild' in context.interaction
            ? (context.interaction as any).guild
            : null;

          const result = parseEmoji(inputValue, context.client, guild);
          if (!result.success) {
            return buildResponseConfigResponse(context);
          }
          newItem = {
            value: result.identifier!,
            displayValue: result.displayEmoji!,
            inputValue: inputValue,
          };
        } else {
          newItem = { value: inputValue };
        }

        const responses = [...(group.responses || []), newItem];

        if (isPendingGroup(context)) {
          updatePanelState(guildId, userId, {
            pendingGroup: { ...state.pendingGroup, responses }
          });
        } else {
          updateGroup(guildId, group.id, { responses });
        }
      }
    }

    return buildResponseConfigResponse(context);
  },
};

export default responseConfigPanel;
