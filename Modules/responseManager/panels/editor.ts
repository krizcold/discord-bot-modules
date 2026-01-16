/**
 * Response Manager - Editor Panel
 *
 * Edit a single response group's settings.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
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
  createSeparator,
  createButton,
  createButtonRow,
  V2Colors,
} from '@internal/utils/panel/v2';

import {
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  toggleGroup,
  groupNameExists,
} from '../utils/storage';
import {
  getPanelState,
  updatePanelState,
  getEditingGroupId,
  setEditingGroupId,
  clearPanelState,
} from '../utils/pageState';
import { ResponseGroup, MatchMode, ResponseType } from '../types/responseManager';
import { formatResponsePreview } from '../utils/responseVariables';
import {
  EDITOR_PANEL_ID,
  LIST_PANEL_ID,
  BTN,
  DROPDOWN,
  MODAL,
  MAX_CHANNELS,
} from './constants';

/**
 * Format keywords preview with character limit
 */
function formatKeywordsPreview(keywords: { pattern: string }[], maxChars: number = 80): string {
  if (keywords.length === 0) {
    return '-# No keywords set';
  }

  let result = '';
  let count = 0;

  for (const k of keywords) {
    const formatted = `\`${k.pattern}\``;
    const separator = count > 0 ? ', ' : '';

    // Check if adding this would exceed limit
    if (result.length + separator.length + formatted.length > maxChars) {
      const remaining = keywords.length - count;
      if (remaining > 0) {
        result += ` +${remaining} more`;
      }
      break;
    }

    result += separator + formatted;
    count++;
  }

  return result;
}

/**
 * Get match mode display
 */
function getMatchModeDisplay(mode: MatchMode): string {
  switch (mode) {
    case 'exact': return 'Exact Match';
    case 'contains': return 'Contains';
    case 'startsWith': return 'Starts With';
    case 'word': return 'Word Boundary';
    default: return mode;
  }
}

/**
 * Get response type display with emoji
 */
function getResponseTypeDisplay(type: ResponseType): string {
  switch (type) {
    case 'react': return '😀 React with Emoji';
    case 'reply': return '💬 Reply to Message';
    case 'respond': return '📤 Send Response';
    case 'command': return '⚡ Trigger Command';
    default: return type;
  }
}

/**
 * Build editor container
 */
function buildEditorContainer(
  context: PanelContext,
  group: ResponseGroup | Partial<ResponseGroup>,
  isNew: boolean,
  confirmDelete: boolean = false
): ContainerBuilder {
  const accentColor = group.enabled !== false ? V2Colors.success : V2Colors.secondary;
  const container = createContainer(accentColor);

  // Title section with Rename button accessory
  const groupName = group.name?.trim();
  const title = groupName
    ? (isNew ? `New: ${groupName}` : `Editing: ${groupName}`)
    : (isNew ? 'New Response Group' : 'Unnamed Group');
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${title}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${EDITOR_PANEL_ID}_btn_${BTN.EDIT_NAME}`)
          .setLabel('✏️ Rename')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(createSeparator());

  // Status section with toggle button accessory
  const statusText = group.enabled !== false ? '✅ **Enabled**' : '⏸️ ~~Disabled~~';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(statusText),
        new TextDisplayBuilder().setContent(`-# 🎯 Match: ${getMatchModeDisplay(group.matchMode || 'word')}`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${EDITOR_PANEL_ID}_btn_${BTN.TOGGLE}`)
          .setLabel('Toggle')
          .setStyle(group.enabled !== false ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
  );

  // Keywords section with edit button accessory
  const keywordsDisplay = formatKeywordsPreview(group.keywords || []);
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`📝 **Keywords** (${group.keywords?.length || 0})`),
        new TextDisplayBuilder().setContent(keywordsDisplay)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${EDITOR_PANEL_ID}_btn_${BTN.EDIT_KEYWORDS}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // Channels section with clear button accessory
  const hasChannels = group.enabledChannels && group.enabledChannels.length > 0;
  const channelsDisplay = hasChannels
    ? group.enabledChannels!.slice(0, 3).map(c => `<#${c}>`).join(' ') +
      (group.enabledChannels!.length > 3 ? ` +${group.enabledChannels!.length - 3} more` : '')
    : '-# All channels';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`📺 **Channels** (${group.enabledChannels?.length || 0})`),
        new TextDisplayBuilder().setContent(channelsDisplay)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${EDITOR_PANEL_ID}_btn_${BTN.EDIT_CHANNELS}`)
          .setLabel('Clear')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!hasChannels)
      )
  );

  // Response type section with config button accessory
  let responsePreview = '';
  if (group.responseType === 'command' && group.commandName) {
    responsePreview = `-# Command: \`/${group.commandName}\``;
  } else if (group.responses && group.responses.length > 0) {
    let preview: string;
    if (group.responseType === 'react') {
      // Use stored displayValue for emojis
      const emojis = group.responses.slice(0, 3).map(r => r.displayValue || r.value);
      preview = emojis.join(' ') + (group.responses.length > 3 ? ` +${group.responses.length - 3}` : '');
    } else {
      // Use formatted preview for reply/respond (highlights variables in bold)
      preview = group.responses.length === 1
        ? formatResponsePreview(group.responses[0].value, 50)
        : group.responses.length <= 2
          ? group.responses.map(r => formatResponsePreview(r.value, 30)).join(', ')
          : `${group.responses.length} configured`;
    }
    responsePreview = `-# Responses: ${preview}`;
  } else {
    responsePreview = '-# No responses configured';
  }
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${getResponseTypeDisplay(group.responseType || 'react')}`),
        new TextDisplayBuilder().setContent(responsePreview)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${EDITOR_PANEL_ID}_btn_${BTN.CONFIG_RESPONSE}`)
          .setLabel('Configure')
          .setStyle(ButtonStyle.Primary)
      )
  );

  // Cooldown section with edit button accessory
  const groupCd = group.groupCooldown || { charges: 0, reloadSeconds: 1 };
  const keywordCd = group.keywordCooldown || { charges: 0, reloadSeconds: 0 };
  const hasMultiKeywords = (group.keywords?.length || 0) > 1;

  let cooldownPreview: string;
  if (groupCd.charges === 0 && (!hasMultiKeywords || (keywordCd.charges === 0 && keywordCd.reloadSeconds === 0))) {
    cooldownPreview = `-# Default (${groupCd.reloadSeconds}s group reload)`;
  } else {
    const parts: string[] = [];
    const gCharges = groupCd.charges === 0 ? '∞' : groupCd.charges;
    parts.push(`Group: ${gCharges}/${groupCd.reloadSeconds}s`);
    if (hasMultiKeywords && (keywordCd.charges > 0 || keywordCd.reloadSeconds > 0)) {
      const kCharges = keywordCd.charges === 0 ? '∞' : keywordCd.charges;
      parts.push(`Keyword: ${kCharges}/${keywordCd.reloadSeconds}s`);
    }
    cooldownPreview = `-# ${parts.join(' | ')}`;
  }

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`⏱️ **Cooldown**`),
        new TextDisplayBuilder().setContent(cooldownPreview)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${EDITOR_PANEL_ID}_btn_${BTN.EDIT_COOLDOWN}`)
          .setLabel('Configure')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(createSeparator());

  // Response type dropdown
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`panel_${EDITOR_PANEL_ID}_dropdown_${DROPDOWN.RESPONSE_TYPE}`)
        .setPlaceholder('Change response type...')
        .addOptions([
          { label: '😀 React with Emoji', value: 'react', description: 'Add emoji reaction to message', default: group.responseType === 'react' },
          { label: '💬 Reply to Message', value: 'reply', description: 'Reply directly to the message', default: group.responseType === 'reply' },
          { label: '📤 Send Response', value: 'respond', description: 'Send a new message in channel', default: group.responseType === 'respond' },
          { label: '⚡ Trigger Command', value: 'command', description: 'Execute a slash command', default: group.responseType === 'command' },
        ])
    )
  );

  // Match mode dropdown
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`panel_${EDITOR_PANEL_ID}_dropdown_${DROPDOWN.MATCH_MODE}`)
        .setPlaceholder('Change match mode...')
        .addOptions([
          { label: 'Exact Match', value: 'exact', description: 'Message must match exactly', default: group.matchMode === 'exact' },
          { label: 'Contains', value: 'contains', description: 'Keyword anywhere in message', default: group.matchMode === 'contains' },
          { label: 'Starts With', value: 'startsWith', description: 'Message starts with keyword', default: group.matchMode === 'startsWith' },
          { label: 'Word Boundary', value: 'word', description: 'Keyword as whole word', default: group.matchMode === 'word' || !group.matchMode },
        ])
    )
  );

  // Channel select menu (select channels or submit empty to clear)
  container.addActionRowComponents(
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`panel_${EDITOR_PANEL_ID}_dropdown_${DROPDOWN.CHANNEL_SELECT}`)
        .setPlaceholder('📺 Select channels (empty = all)')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(0)
        .setMaxValues(5)
        .setDefaultChannels(group.enabledChannels || [])
    )
  );

  // Delete confirmation or action buttons
  if (confirmDelete) {
    container.addActionRowComponents(
      createButtonRow(
        createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.CONFIRM_DELETE}`, '🗑️ Confirm Delete', ButtonStyle.Danger),
        createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.CANCEL_DELETE}`, 'Cancel', ButtonStyle.Secondary)
      )
    );
  } else {
    const actionButtons: ButtonBuilder[] = [];

    actionButtons.push(
      createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.BACK}`, '◀ Back', ButtonStyle.Secondary)
    );

    if (!isNew) {
      actionButtons.push(
        createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.DELETE}`, '🗑️', ButtonStyle.Danger)
      );
    }

    if (isNew) {
      actionButtons.push(
        createButton(`panel_${EDITOR_PANEL_ID}_btn_${BTN.SAVE}`, '✅ Create', ButtonStyle.Success)
          .setDisabled(!group.name || group.name.trim().length === 0)
      );
    }

    container.addActionRowComponents(createButtonRow(...actionButtons));
  }

  return container;
}

/**
 * Get the group being edited (from storage or pending state)
 */
function getEditingGroup(context: PanelContext): { group: ResponseGroup | Partial<ResponseGroup>; isNew: boolean } {
  const guildId = context.guildId!;
  const userId = context.userId;
  const state = getPanelState(guildId, userId);

  const editingId = getEditingGroupId(guildId, userId);

  if (editingId) {
    const group = getGroup(guildId, editingId);
    if (group) {
      return { group, isNew: false };
    }
  }

  // New group or pending edits
  return {
    group: state.pendingGroup || {
      name: '',
      enabled: true,
      keywords: [],
      matchMode: 'word',
      responseType: 'react',
      responses: [],
      selectionMode: 'random',
      enabledChannels: [],
      groupCooldown: { charges: 0, reloadSeconds: 1 },
      keywordCooldown: { charges: 0, reloadSeconds: 0 },
    },
    isNew: true,
  };
}

/**
 * Build editor response
 */
function buildEditorResponse(context: PanelContext, confirmDelete: boolean = false): PanelResponse {
  const { group, isNew } = getEditingGroup(context);
  const container = buildEditorContainer(context, group, isNew, confirmDelete);
  return createV2Response([container]);
}

const editorPanel: PanelOptions = {
  id: EDITOR_PANEL_ID,
  name: 'Response Group Editor',
  description: 'Edit response group settings',
  category: 'Settings',

  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    return buildEditorResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse | null> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(context);

    // Toggle enabled
    if (buttonId === BTN.TOGGLE) {
      if (isNew) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, enabled: !group.enabled }
        });
      } else {
        toggleGroup(guildId, (group as ResponseGroup).id);
      }
      return buildEditorResponse(context);
    }

    // Edit name - show modal
    if (buttonId === BTN.EDIT_NAME) {
      const modal = new ModalBuilder()
        .setCustomId(`panel_${EDITOR_PANEL_ID}_modal_${MODAL.GROUP_NAME}`)
        .setTitle('Edit Group Name')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('name')
              .setLabel('Group Name')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(50)
              .setValue(group.name || '')
          )
        );

      if (context.interaction && 'showModal' in context.interaction) {
        await context.interaction.showModal(modal);
      }
      return null; // Modal shown, don't update panel
    }

    // Edit keywords - navigate to keywords panel
    if (buttonId === BTN.EDIT_KEYWORDS) {
      const keywordsPanel = await import('./keywordsConfig');
      return keywordsPanel.default.callback(context);
    }

    // Edit cooldown - navigate to cooldown panel
    if (buttonId === BTN.EDIT_COOLDOWN) {
      const cooldownPanel = await import('./cooldownConfig');
      return cooldownPanel.default.callback(context);
    }

    // Clear channels
    if (buttonId === BTN.EDIT_CHANNELS) {
      if (isNew) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, enabledChannels: [] }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { enabledChannels: [] });
      }
      return buildEditorResponse(context);
    }

    // Configure response - navigate to response config
    if (buttonId === BTN.CONFIG_RESPONSE) {
      if (group.responseType === 'command') {
        const commandConfig = await import('./commandConfig');
        return commandConfig.default.callback(context);
      } else {
        const responseConfig = await import('./responseConfig');
        return responseConfig.default.callback(context);
      }
    }

    // Delete
    if (buttonId === BTN.DELETE) {
      return buildEditorResponse(context, true); // Show confirmation
    }

    // Confirm delete
    if (buttonId === BTN.CONFIRM_DELETE) {
      if (!isNew) {
        deleteGroup(guildId, (group as ResponseGroup).id);
      }
      clearPanelState(guildId, userId);
      const listPanel = await import('./list');
      return listPanel.default.callback(context);
    }

    // Cancel delete
    if (buttonId === BTN.CANCEL_DELETE) {
      return buildEditorResponse(context);
    }

    // Back - return to list
    if (buttonId === BTN.BACK) {
      clearPanelState(guildId, userId);
      const listPanel = await import('./list');
      return listPanel.default.callback(context);
    }

    // Save new group
    if (buttonId === BTN.SAVE && isNew) {
      if (!group.name || group.name.trim().length === 0) {
        return buildEditorResponse(context);
      }

      const newGroup = createGroup(guildId, group);
      if (newGroup) {
        setEditingGroupId(guildId, userId, newGroup.id);
        updatePanelState(guildId, userId, { pendingGroup: undefined });
      }
      return buildEditorResponse(context);
    }

    return buildEditorResponse(context);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(context);

    if (dropdownId === DROPDOWN.RESPONSE_TYPE) {
      const newType = values[0] as ResponseType;

      if (isNew) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, responseType: newType }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { responseType: newType });
      }
    }

    if (dropdownId === DROPDOWN.MATCH_MODE) {
      const newMode = values[0] as MatchMode;

      if (isNew) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, matchMode: newMode }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { matchMode: newMode });
      }
    }

    // Handle channel selection - set channels to exactly what was selected
    // dropdownId may have a suffix like "channel_select_3" due to dynamic customId
    if (dropdownId?.startsWith(DROPDOWN.CHANNEL_SELECT)) {
      // Empty selection = clear all channels (all channels mode)
      // Non-empty selection = set to exactly those channels
      const newChannels = values && values.length > 0 ? values.slice(0, MAX_CHANNELS) : [];

      if (isNew) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, enabledChannels: newChannels }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { enabledChannels: newChannels });
      }
    }

    return buildEditorResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(context);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return buildEditorResponse(context);
    }

    if (modalId === MODAL.GROUP_NAME) {
      const name = interaction.fields.getTextInputValue('name').trim();

      if (isNew) {
        const state = getPanelState(guildId, userId);
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, name }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { name });
      }
    }

    return buildEditorResponse(context);
  },
};

export default editorPanel;
