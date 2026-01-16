/**
 * Response Manager - List Panel
 *
 * Main panel showing all response groups with pagination.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
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

import { getAllGroups } from '../utils/storage';
import { detectOverlaps, formatOverlapWarning } from '../utils/overlapDetector';
import { getPanelState, updatePanelState, setEditingGroupId } from '../utils/pageState';
import { ResponseGroup } from '../types/responseManager';
import {
  LIST_PANEL_ID,
  ITEMS_PER_PAGE,
  BTN,
} from './constants';

/**
 * Get response type display with emoji
 */
function getResponseTypeDisplay(type: string): string {
  switch (type) {
    case 'react': return '😀 React';
    case 'reply': return '💬 Reply';
    case 'respond': return '📤 Respond';
    case 'command': return '⚡ Command';
    default: return type;
  }
}

/**
 * Get status display
 */
function getStatusDisplay(enabled: boolean): string {
  return enabled ? '✅' : '⏸️';
}

/**
 * Format group summary for list display
 */
function formatGroupSummary(group: ResponseGroup): string {
  const parts: string[] = [];

  // Response type
  parts.push(getResponseTypeDisplay(group.responseType));

  // Selection mode
  parts.push(group.selectionMode);

  // Channel count or "all"
  if (group.enabledChannels.length === 0) {
    parts.push('all channels');
  } else {
    parts.push(`${group.enabledChannels.length} channel(s)`);
  }

  // Keyword count
  parts.push(`${group.keywords.length} keyword(s)`);

  return parts.join(' · ');
}

/**
 * Build the list panel container
 */
function buildListContainer(
  context: PanelContext,
  groups: ResponseGroup[],
  currentPage: number,
  totalPages: number
): ContainerBuilder {
  const container = createContainer(V2Colors.primary);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Response Manager')
  );

  // Check for overlaps
  const overlaps = detectOverlaps(groups);
  if (overlaps.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${formatOverlapWarning(overlaps)}`)
    );
  }

  container.addSeparatorComponents(createSeparator());

  // Empty state
  if (groups.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**No response groups configured**\n\n' +
        'Create a response group to automatically react, reply, or trigger commands ' +
        'when specific keywords are detected in messages.'
      )
    );
  } else {
    // Calculate pagination
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, groups.length);
    const pageGroups = groups.slice(startIdx, endIdx);

    // Show groups as sections with Edit button
    for (const group of pageGroups) {
      const status = getStatusDisplay(group.enabled);
      const summary = formatGroupSummary(group);

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${status} **${group.name}**`),
            new TextDisplayBuilder().setContent(`-# ${summary}`)
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`panel_${LIST_PANEL_ID}_btn_${BTN.EDIT}_${group.id}`)
              .setLabel('Edit')
              .setStyle(ButtonStyle.Secondary)
          )
      );
    }

    // Page indicator (always show for consistency)
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Page ${currentPage} of ${totalPages}`)
    );
  }

  container.addSeparatorComponents(createSeparator());

  // Action buttons - pagination always visible, disabled at boundaries
  const actionButtons: ButtonBuilder[] = [];

  // Pagination buttons (always show, disable at boundaries per DEV.md)
  actionButtons.push(
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.PREV}`, '◀', ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.PAGE}`, `${currentPage}/${totalPages}`, ButtonStyle.Secondary)
      .setDisabled(true),
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.NEXT}`, '▶', ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );

  // New group button
  actionButtons.push(
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.NEW}`, '➕ New Group', ButtonStyle.Primary)
  );

  container.addActionRowComponents(createButtonRow(...actionButtons));

  return container;
}

/**
 * Build the list panel response
 */
function buildListResponse(context: PanelContext): PanelResponse {
  const guildId = context.guildId!;
  const userId = context.userId;

  const groups = getAllGroups(guildId);
  const totalPages = Math.max(1, Math.ceil(groups.length / ITEMS_PER_PAGE));

  // Get current page from state
  let currentPage = getPanelState(guildId, userId).currentPage;
  if (currentPage > totalPages) {
    currentPage = totalPages;
    updatePanelState(guildId, userId, { currentPage });
  }

  const container = buildListContainer(context, groups, currentPage, totalPages);
  return createV2Response([container]);
}

const listPanel: PanelOptions = {
  id: LIST_PANEL_ID,
  name: 'Response Manager',
  description: 'Configure automatic message responses',
  category: 'Chat',

  showInAdminPanel: true,
  adminPanelOrder: 50,
  adminPanelIcon: '💬',

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

    return buildListResponse(context);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;
    const state = getPanelState(guildId, userId);

    // Handle pagination
    if (buttonId === BTN.PREV) {
      updatePanelState(guildId, userId, { currentPage: Math.max(1, state.currentPage - 1) });
      return buildListResponse(context);
    }

    if (buttonId === BTN.NEXT) {
      const groups = getAllGroups(guildId);
      const totalPages = Math.ceil(groups.length / ITEMS_PER_PAGE);
      updatePanelState(guildId, userId, { currentPage: Math.min(totalPages, state.currentPage + 1) });
      return buildListResponse(context);
    }

    // Handle new group
    if (buttonId === BTN.NEW) {
      // Clear any previous editing state and set up for new group
      setEditingGroupId(guildId, userId, undefined);
      updatePanelState(guildId, userId, {
        pendingGroup: {
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
        }
      });

      // Navigate to editor panel
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    // Handle edit group (buttonId format: edit_<groupId>)
    if (buttonId.startsWith(`${BTN.EDIT}_`)) {
      const groupId = buttonId.replace(`${BTN.EDIT}_`, '');
      setEditingGroupId(guildId, userId, groupId);

      // Navigate to editor panel
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    return buildListResponse(context);
  },
};

export default listPanel;
