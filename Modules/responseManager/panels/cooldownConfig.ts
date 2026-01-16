/**
 * Response Manager - Cooldown Config Panel
 *
 * Configure group and per-keyword cooldowns with charges system.
 * - Group cooldown: applies to all triggers (default 1s, infinite charges)
 * - Keyword cooldown: per-keyword rate limit (only if >1 keyword)
 * - 0 charges = infinite (no limit)
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  createSeparator,
  createButton,
  createButtonRow,
  V2Colors,
} from '@internal/utils/panel/v2';

import { getGroup, updateGroup } from '../utils/storage';
import {
  getPanelState,
  updatePanelState,
  getEditingGroupId,
} from '../utils/pageState';
import { ResponseGroup, CooldownConfig } from '../types/responseManager';
import {
  COOLDOWN_PANEL_ID,
  BTN,
  MODAL,
} from './constants';

/**
 * Get the group being edited
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
 * Format cooldown for display
 */
function formatCooldown(config: CooldownConfig | undefined): string {
  if (!config) {
    return '`∞ charges` `1s reload`';
  }

  const chargesText = config.charges === 0 ? '∞' : config.charges.toString();
  const reloadText = formatTime(config.reloadSeconds);

  return `\`${chargesText} charges\` \`${reloadText} reload\``;
}

/**
 * Format seconds to human readable
 */
function formatTime(seconds: number): string {
  if (seconds === 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Parse time string to seconds (e.g., "1m", "30s", "1h30m", "90")
 */
function parseTime(input: string): number {
  input = input.trim().toLowerCase();

  // If just a number, treat as seconds
  if (/^\d+$/.test(input)) {
    return parseInt(input, 10);
  }

  let totalSeconds = 0;
  const hourMatch = input.match(/(\d+)\s*h/);
  const minMatch = input.match(/(\d+)\s*m(?!s)/);
  const secMatch = input.match(/(\d+)\s*s/);

  if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600;
  if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1], 10);

  return totalSeconds;
}

/**
 * Build cooldown config container
 */
function buildCooldownContainer(
  context: PanelContext,
  group: ResponseGroup | Partial<ResponseGroup>
): ContainerBuilder {
  const container = createContainer(V2Colors.info);
  const hasMultipleKeywords = (group.keywords?.length || 0) > 1;

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ⏱️ Cooldown Configuration`)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Rate limiting for response triggers`)
  );

  container.addSeparatorComponents(createSeparator());

  // Group Cooldown Section
  const groupCooldown = group.groupCooldown || { charges: 0, reloadSeconds: 1 };
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**🔷 Group Cooldown**`),
        new TextDisplayBuilder().setContent(`-# ${formatCooldown(groupCooldown)}`),
        new TextDisplayBuilder().setContent(`-# *Applies to all triggers from this group*`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${COOLDOWN_PANEL_ID}_btn_${BTN.EDIT_GROUP_COOLDOWN}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary)
      )
  );

  // Keyword Cooldown Section (always visible, disabled if only 1 keyword)
  const keywordCooldown = group.keywordCooldown || { charges: 0, reloadSeconds: 0 };
  const keywordDisabled = keywordCooldown.charges === 0 && keywordCooldown.reloadSeconds === 0;
  const keywordStatusText = hasMultipleKeywords
    ? (keywordDisabled ? '`Disabled`' : formatCooldown(keywordCooldown))
    : '`Requires >1 keyword`';

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**🔹 Per-Keyword Cooldown**`),
        new TextDisplayBuilder().setContent(`-# ${keywordStatusText}`),
        new TextDisplayBuilder().setContent(`-# *Independent cooldown for each keyword*`)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${COOLDOWN_PANEL_ID}_btn_${BTN.EDIT_KEYWORD_COOLDOWN}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!hasMultipleKeywords)
      )
  );

  container.addSeparatorComponents(createSeparator());

  // Help text
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# *Charges: Number of uses before cooldown (0 = unlimited)*\n` +
      `-# *Reload: Time to restore 1 charge*`
    )
  );

  // Back button
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${COOLDOWN_PANEL_ID}_btn_${BTN.BACK}`, '◀ Back', ButtonStyle.Secondary)
    )
  );

  return container;
}

/**
 * Build cooldown config response
 */
function buildCooldownResponse(context: PanelContext): PanelResponse {
  const { group } = getEditingGroup(context);
  const container = buildCooldownContainer(context, group);
  return createV2Response([container]);
}

/**
 * Create cooldown edit modal
 */
function createCooldownModal(type: 'group' | 'keyword', currentConfig: CooldownConfig | undefined): ModalBuilder {
  const config = currentConfig || { charges: 0, reloadSeconds: type === 'group' ? 1 : 0 };
  const title = type === 'group' ? 'Group Cooldown' : 'Per-Keyword Cooldown';
  const modalId = type === 'group' ? MODAL.GROUP_COOLDOWN : MODAL.KEYWORD_COOLDOWN;

  return new ModalBuilder()
    .setCustomId(`panel_${COOLDOWN_PANEL_ID}_modal_${modalId}`)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('charges')
          .setLabel('Max Charges (0 = unlimited)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(10)
          .setValue(config.charges.toString())
          .setPlaceholder('0')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reload')
          .setLabel('Reload Time (e.g., 30s, 1m, 1h30m)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setValue(formatTime(config.reloadSeconds))
          .setPlaceholder('1s')
      )
    );
}

const cooldownConfigPanel: PanelOptions = {
  id: COOLDOWN_PANEL_ID,
  name: 'Cooldown Configuration',
  description: 'Configure rate limiting for response triggers',
  category: 'Settings',

  showInAdminPanel: false,
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    return buildCooldownResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse | null> => {
    const { group } = getEditingGroup(context);

    // Edit group cooldown
    if (buttonId === BTN.EDIT_GROUP_COOLDOWN) {
      const modal = createCooldownModal('group', group.groupCooldown);
      if (context.interaction && 'showModal' in context.interaction) {
        await context.interaction.showModal(modal);
      }
      return null;
    }

    // Edit keyword cooldown
    if (buttonId === BTN.EDIT_KEYWORD_COOLDOWN) {
      const modal = createCooldownModal('keyword', group.keywordCooldown);
      if (context.interaction && 'showModal' in context.interaction) {
        await context.interaction.showModal(modal);
      }
      return null;
    }

    // Back - return to editor
    if (buttonId === BTN.BACK) {
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    return buildCooldownResponse(context);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const { group, isNew } = getEditingGroup(context);
    const state = getPanelState(guildId, userId);
    const interaction = context.interaction;

    if (!interaction || !('fields' in interaction)) {
      return buildCooldownResponse(context);
    }

    const chargesInput = interaction.fields.getTextInputValue('charges').trim();
    const reloadInput = interaction.fields.getTextInputValue('reload').trim();

    const charges = Math.max(0, parseInt(chargesInput, 10) || 0);
    const reloadSeconds = Math.max(0, parseTime(reloadInput));

    const newConfig: CooldownConfig = { charges, reloadSeconds };

    if (modalId === MODAL.GROUP_COOLDOWN) {
      if (isNew) {
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, groupCooldown: newConfig }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { groupCooldown: newConfig });
      }
    }

    if (modalId === MODAL.KEYWORD_COOLDOWN) {
      if (isNew) {
        updatePanelState(guildId, userId, {
          pendingGroup: { ...state.pendingGroup, keywordCooldown: newConfig }
        });
      } else {
        updateGroup(guildId, (group as ResponseGroup).id, { keywordCooldown: newConfig });
      }
    }

    return buildCooldownResponse(context);
  },
};

export default cooldownConfigPanel;
