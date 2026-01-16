/**
 * Scheduled Messages - List Panel
 *
 * Main panel showing all scheduled message groups with pagination.
 * Uses ONE SectionBuilder per item to maximize capacity (40 component limit).
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

import { getAllGroups, getUserTimezone } from '../utils/storage';
import { getPanelState, updatePanelState, setEditingGroupId, setPendingGroup } from '../utils/pageState';
import { ScheduledGroup } from '../types/scheduled';
import { isGroupComplete, getCompletionProgress } from '../manager/selection';
import { calculateNextSend } from '../manager/scheduler';
import {
  LIST_PANEL_ID,
  GROUPS_PER_PAGE,
  BTN,
  STATUS_ICONS,
} from './constants';

/**
 * Get status icon and info line
 */
function getStatusLine(group: ScheduledGroup): string {
  const parts: string[] = [];

  if (!group.enabled) {
    parts.push(`${STATUS_ICONS.PAUSED} Paused`);
  } else if (isGroupComplete(group)) {
    parts.push(`${STATUS_ICONS.COMPLETE} Complete`);
  } else {
    // Always show next send time for active groups
    const nextSend = group.nextSendAt || calculateNextSend(group.schedule);
    if (nextSend) {
      parts.push(`${STATUS_ICONS.ACTIVE} <t:${Math.floor(nextSend / 1000)}:R>`);
    } else {
      parts.push(`${STATUS_ICONS.ACTIVE} Active`);
    }
  }

  if (group.autoPin) {
    parts.push(STATUS_ICONS.PIN);
  }

  return parts.join(' • ');
}

/**
 * Format group summary for list display
 */
function formatGroupSummary(group: ScheduledGroup): { line1: string; line2: string } {
  const msgCount = group.messages.length;
  const selectionMode = group.selectionMode === 'random'
    ? `Random ${group.randomOldestPercent}%`
    : 'Sequential';

  let progressStr = '';
  if (!group.loop) {
    const { sent, total } = getCompletionProgress(group);
    progressStr = ` ${sent}/${total}`;
  }

  const line1 = `**${group.name}** (${msgCount})${progressStr} • ${selectionMode}`;
  const line2 = getStatusLine(group);

  return { line1, line2 };
}

/**
 * Build the list panel container
 */
function buildListContainer(
  context: PanelContext,
  groups: ScheduledGroup[],
  currentPage: number,
  totalPages: number
): ContainerBuilder {
  const container = createContainer(V2Colors.primary);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Scheduled Messages')
  );

  container.addSeparatorComponents(createSeparator());

  // Empty state
  if (groups.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**No scheduled message groups**\n\n' +
        'Create a group to automatically send messages on a schedule.'
      )
    );
  } else {
    // Calculate pagination
    const startIdx = (currentPage - 1) * GROUPS_PER_PAGE;
    const endIdx = Math.min(startIdx + GROUPS_PER_PAGE, groups.length);
    const pageGroups = groups.slice(startIdx, endIdx);

    // Show groups as sections with Edit button (ONE section per group)
    for (const group of pageGroups) {
      const { line1, line2 } = formatGroupSummary(group);

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(line1),
            new TextDisplayBuilder().setContent(`-# ${line2}`)
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

  // Action buttons
  const actionButtons: ButtonBuilder[] = [];

  // Pagination buttons (always show, disable at boundaries)
  actionButtons.push(
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.PREV}`, '◀', ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.PAGE}`, `${currentPage}/${totalPages}`, ButtonStyle.Secondary)
      .setDisabled(true),
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.NEXT}`, '▶', ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );

  container.addActionRowComponents(createButtonRow(...actionButtons));

  // Second row: New Group + Bulk Edit
  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.NEW}`, '+ New Group', ButtonStyle.Primary),
      createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.BULK_ALL}`, 'Bulk Edit All', ButtonStyle.Secondary)
        .setDisabled(groups.length === 0)
    )
  );

  return container;
}

/**
 * Build the list panel response
 */
function buildListResponse(context: PanelContext): PanelResponse {
  const guildId = context.guildId!;
  const userId = context.userId;

  const groups = getAllGroups(guildId);
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));

  // Get current page from state
  let currentPage = getPanelState(guildId, userId).currentPage;
  if (currentPage > totalPages) {
    currentPage = totalPages;
    updatePanelState(guildId, userId, { currentPage });
  }

  const container = buildListContainer(context, groups, currentPage, totalPages);
  return createV2Response([container]);
}

/**
 * Build group selection view for bulk edit
 */
function buildGroupSelectionView(context: PanelContext, groups: ScheduledGroup[]): PanelResponse {
  const container = createContainer(V2Colors.primary);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Select Group to Bulk Edit')
  );

  container.addSeparatorComponents(createSeparator());

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('Choose which group\'s messages you want to edit:')
  );

  // Show up to 5 groups as buttons
  const displayGroups = groups.slice(0, 5);

  for (const group of displayGroups) {
    const msgCount = group.messages.length;
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${group.name}**`),
          new TextDisplayBuilder().setContent(`-# ${msgCount} message${msgCount !== 1 ? 's' : ''}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`panel_${LIST_PANEL_ID}_btn_${BTN.BULK_SELECT}_${group.id}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Primary)
        )
    );
  }

  if (groups.length > 5) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ... and ${groups.length - 5} more groups`)
    );
  }

  container.addSeparatorComponents(createSeparator());

  container.addActionRowComponents(
    createButtonRow(
      createButton(`panel_${LIST_PANEL_ID}_btn_${BTN.CLOSE}`, 'Cancel', ButtonStyle.Secondary)
    )
  );

  return createV2Response([container]);
}

const listPanel: PanelOptions = {
  id: LIST_PANEL_ID,
  name: 'Scheduled Messages',
  description: 'Manage scheduled messages and announcements',
  category: 'Chat',

  showInAdminPanel: true,
  adminPanelOrder: 60,
  adminPanelIcon: '⏰',

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
      const totalPages = Math.ceil(groups.length / GROUPS_PER_PAGE);
      updatePanelState(guildId, userId, { currentPage: Math.min(totalPages, state.currentPage + 1) });
      return buildListResponse(context);
    }

    // Handle new group
    if (buttonId === BTN.NEW) {
      setEditingGroupId(guildId, userId, undefined);

      // Get user's timezone from timestamp module (if available)
      const userTz = getUserTimezone(userId);

      // Default to current channel
      const currentChannelId = context.interaction?.channelId || '';

      setPendingGroup(guildId, userId, {
        name: '',
        enabled: true,
        channelId: currentChannelId,
        messages: [],
        selectionMode: 'sequential',
        randomOldestPercent: 30,
        loop: true,
        currentIndex: 0,
        autoPin: false,
        schedule: {
          type: 'daily',
          timeHour: 9,
          timeMinute: 0,
          startDate: Date.now(),
          utcOffset: userTz.utcOffset,
          minuteModifier: userTz.minuteModifier,
        },
      });

      // Navigate to editor panel
      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    // Handle edit group
    if (buttonId.startsWith(`${BTN.EDIT}_`)) {
      const groupId = buttonId.replace(`${BTN.EDIT}_`, '');
      setEditingGroupId(guildId, userId, groupId);
      setPendingGroup(guildId, userId, undefined);

      const editorPanel = await import('./editor');
      return editorPanel.default.callback(context);
    }

    // Handle bulk edit all - show group selection first
    if (buttonId === BTN.BULK_ALL) {
      const groups = getAllGroups(guildId);
      if (groups.length === 1) {
        // Only one group, go directly to it
        const groupId = groups[0].id;
        setEditingGroupId(guildId, userId, groupId);  // Set page state as backup
        context.data = { groupId, isNew: false, source: 'list' };
        const bulkPanel = await import('./bulkEdit');
        return bulkPanel.default.callback(context);
      } else if (groups.length > 1) {
        // Multiple groups - show selection view
        return buildGroupSelectionView(context, groups);
      }
      // No groups - shouldn't happen since button is disabled when empty
      return buildListResponse(context);
    }

    // Handle group selection for bulk edit
    if (buttonId.startsWith(`${BTN.BULK_SELECT}_`)) {
      const groupId = buttonId.replace(`${BTN.BULK_SELECT}_`, '');
      setEditingGroupId(guildId, userId, groupId);  // Set page state as backup
      context.data = { groupId, isNew: false, source: 'list' };
      const bulkPanel = await import('./bulkEdit');
      return bulkPanel.default.callback(context);
    }

    // Handle close/cancel
    if (buttonId === BTN.CLOSE) {
      return buildListResponse(context);
    }

    return buildListResponse(context);
  },
};

export default listPanel;
