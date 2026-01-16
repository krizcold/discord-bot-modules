/**
 * Role Assignment - List Panel
 *
 * Main panel showing all role assignment groups with pagination.
 * Entry point for Role Assignment management.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  GatewayIntentBits,
  Client,
  TextChannel,
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
import { getMergedConfig } from '@internal/utils/configManager';

import { getAllGroups } from '../manager/data';
import { RoleAssignmentGroup } from '../types/roleAssign';
import {
  LIST_PANEL_ID,
  MODULE_NAME,
  BTN_LIST_NEW,
  BTN_LIST_EDIT,
  BTN_LIST_PREV,
  BTN_LIST_NEXT,
  BTN_LIST_PAGE,
  GROUPS_PER_PAGE,
} from '../constants/prefixes';
import {
  createPendingAssignment,
  updatePendingAssignment,
} from '../state';

// Settings schema ID
const SETTINGS_SCHEMA_ID = 'role-assign-settings';

// Default max groups per guild
const DEFAULT_MAX_GROUPS = 8;

// State storage for list panel pagination
const listPanelState = new Map<string, { currentPage: number }>();

function getListState(guildId: string, userId: string): { currentPage: number } {
  const key = `${guildId}:${userId}`;
  return listPanelState.get(key) || { currentPage: 1 };
}

function updateListState(guildId: string, userId: string, updates: Partial<{ currentPage: number }>): void {
  const key = `${guildId}:${userId}`;
  const current = getListState(guildId, userId);
  listPanelState.set(key, { ...current, ...updates });
}

/**
 * Get display mode icon
 */
function getDisplayModeIcon(mode: string): string {
  switch (mode) {
    case 'embed-inside': return '📦';
    case 'embed-outside': return '📋';
    case 'text-only': return '📝';
    default: return '📦';
  }
}

/**
 * Get interaction mode icon
 */
function getInteractionModeIcon(mode: string): string {
  return mode === 'reaction' ? '😀' : '🔘';
}

/**
 * Format group summary for list display
 */
function formatGroupSummary(group: RoleAssignmentGroup): string {
  const parts: string[] = [];

  // Display mode
  parts.push(getDisplayModeIcon(group.displayMode));

  // Interaction mode
  parts.push(getInteractionModeIcon(group.interactionMode));

  // Selection mode
  const selLabel = group.selectionMode === 'single' ? 'Single' :
                   group.selectionMode === 'exclusive' ? 'Exclusive' : 'Multiple';
  parts.push(selLabel);

  // Role count
  parts.push(`${group.roles.length} role(s)`);

  return parts.join(' \u00B7 ');
}

/**
 * Check if a message exists in the channel
 */
async function checkMessageExists(client: Client, channelId: string, messageId: string): Promise<boolean> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !('messages' in channel)) return false;
    await (channel as TextChannel).messages.fetch(messageId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build message link or deleted indicator
 */
function buildMessageLink(guildId: string, channelId: string, messageId: string, exists: boolean): string {
  if (exists) {
    return `[View](https://discord.com/channels/${guildId}/${channelId}/${messageId})`;
  }
  return '\u274C Deleted';
}

/**
 * Get max groups setting
 */
function getMaxGroups(guildId: string): number {
  const config = getMergedConfig(SETTINGS_SCHEMA_ID, guildId);
  return config.properties?.['limits.maxGroups']?.value ?? DEFAULT_MAX_GROUPS;
}

/**
 * Get group display name
 */
function getGroupName(group: RoleAssignmentGroup): string {
  if (group.embedTitle) {
    return group.embedTitle;
  }
  if (group.textContent) {
    // Take first line, truncate if needed
    const firstLine = group.textContent.split('\n')[0];
    return firstLine.length > 30 ? firstLine.substring(0, 27) + '...' : firstLine;
  }
  return `Group ${group.id.substring(0, 8)}`;
}

/**
 * Group with message status info
 */
interface GroupWithStatus {
  group: RoleAssignmentGroup;
  messageLink: string;
}

/**
 * Build the list panel container
 */
async function buildListContainer(
  context: PanelContext,
  groups: RoleAssignmentGroup[],
  currentPage: number,
  totalPages: number,
  maxGroups: number
): Promise<ContainerBuilder> {
  const container = createContainer(V2Colors.primary);
  const guildId = context.guildId!;
  const atLimit = groups.length >= maxGroups;

  // Title with count
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Role Assignment Groups')
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${groups.length}/${maxGroups} groups \u00B7 Manage role assignment messages`)
  );

  container.addSeparatorComponents(createSeparator());

  // Empty state
  if (groups.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**No role assignment groups**\n\n' +
        'Create a role assignment group to let users self-assign roles ' +
        'via buttons or reactions.'
      )
    );
  } else {
    // Calculate pagination
    const startIdx = (currentPage - 1) * GROUPS_PER_PAGE;
    const endIdx = Math.min(startIdx + GROUPS_PER_PAGE, groups.length);
    const pageGroups = groups.slice(startIdx, endIdx);

    // Check message status for each group (first message only)
    const groupsWithStatus: GroupWithStatus[] = await Promise.all(
      pageGroups.map(async (group) => {
        const firstMessageId = group.messageIds[0];
        let messageLink = '\u274C Deleted';

        if (firstMessageId) {
          const exists = await checkMessageExists(context.client, group.channelId, firstMessageId);
          messageLink = buildMessageLink(guildId, group.channelId, firstMessageId, exists);
        }

        return { group, messageLink };
      })
    );

    // Show groups as sections with Edit button
    for (const { group, messageLink } of groupsWithStatus) {
      const name = getGroupName(group);
      const summary = formatGroupSummary(group);

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${name}**`),
            new TextDisplayBuilder().setContent(`-# ${summary} \u00B7 ${messageLink}`)
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`panel_${LIST_PANEL_ID}_btn_${BTN_LIST_EDIT}_${group.id}`)
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
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN_LIST_PREV}`, '\u25C0', ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN_LIST_PAGE}`, `${currentPage}/${totalPages}`, ButtonStyle.Secondary)
      .setDisabled(true),
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN_LIST_NEXT}`, '\u25B6', ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );

  // New group button (disabled if at limit)
  actionButtons.push(
    createButton(`panel_${LIST_PANEL_ID}_btn_${BTN_LIST_NEW}`, '+ New Group', ButtonStyle.Primary)
      .setDisabled(atLimit)
  );

  container.addActionRowComponents(createButtonRow(...actionButtons));

  return container;
}

/**
 * Build the list panel response
 */
async function buildListResponse(context: PanelContext): Promise<PanelResponse> {
  const guildId = context.guildId!;
  const userId = context.userId;

  const groups = getAllGroups(guildId);
  const maxGroups = getMaxGroups(guildId);
  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));

  // Get current page from state
  let currentPage = getListState(guildId, userId).currentPage;
  if (currentPage > totalPages) {
    currentPage = totalPages;
    updateListState(guildId, userId, { currentPage });
  }

  const container = await buildListContainer(context, groups, currentPage, totalPages, maxGroups);
  return createV2Response([container]);
}

const listPanel: PanelOptions = {
  id: LIST_PANEL_ID,
  name: 'Role Assignment',
  description: 'Create and manage role assignment messages',
  category: 'Moderation',

  showInAdminPanel: true,
  adminPanelOrder: 30,
  adminPanelIcon: '\uD83C\uDFF7\uFE0F',

  panelScope: 'guild',
  requiredIntents: [GatewayIntentBits.Guilds],
  requiredPermissions: ['ManageRoles'],

  // Web-UI requires channel selection for publishing role assignments
  requiresChannel: true,

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
    const state = getListState(guildId, userId);

    // Handle pagination
    if (buttonId === BTN_LIST_PREV) {
      updateListState(guildId, userId, { currentPage: Math.max(1, state.currentPage - 1) });
      return await buildListResponse(context);
    }

    if (buttonId === BTN_LIST_NEXT) {
      const groups = getAllGroups(guildId);
      const totalPages = Math.ceil(groups.length / GROUPS_PER_PAGE);
      updateListState(guildId, userId, { currentPage: Math.min(totalPages, state.currentPage + 1) });
      return await buildListResponse(context);
    }

    // Handle new group - create pending and navigate to create panel
    if (buttonId === BTN_LIST_NEW) {
      // Check if at limit
      const groups = getAllGroups(guildId);
      const maxGroups = getMaxGroups(guildId);
      if (groups.length >= maxGroups) {
        return createV2Response([
          createContainer(V2Colors.warning)
            .addTextDisplayComponents(createText('## Limit Reached'))
            .addTextDisplayComponents(createText(`You have reached the maximum of ${maxGroups} role assignment groups.`))
        ]);
      }

      const pending = createPendingAssignment(guildId, userId);

      // Navigate to create panel with the pending ID
      context.data = { pendingId: pending.id };

      // Import and call the create panel
      const createPanel = await import('./createPanel');
      return createPanel.default.callback(context);
    }

    // Handle edit group - load group into pending and navigate to create panel
    if (buttonId.startsWith(BTN_LIST_EDIT + '_')) {
      const groupId = buttonId.substring(BTN_LIST_EDIT.length + 1);
      const group = getAllGroups(guildId).find(g => g.id === groupId);

      if (!group) {
        return createV2Response([
          createContainer(V2Colors.danger)
            .addTextDisplayComponents(createText('## Error'))
            .addTextDisplayComponents(createText('Group not found. It may have been deleted.'))
        ]);
      }

      // Create pending from existing group for editing
      const pending = createPendingAssignment(guildId, userId);

      // Copy group data to pending
      updatePendingAssignment(guildId, pending.id, {
        displayMode: group.displayMode,
        interactionMode: group.interactionMode,
        selectionMode: group.selectionMode,
        reactionPersist: group.reactionPersist,
        embedTitle: group.embedTitle,
        embedDescription: group.embedDescription,
        embedColor: group.embedColor,
        embedThumbnail: group.embedThumbnail,
        embedFooter: group.embedFooter,
        textContent: group.textContent,
        roles: [...group.roles],
        isEditing: true,
        originalGroupId: group.id,
      });

      // Navigate to create panel with the pending ID
      context.data = { pendingId: pending.id };

      // Import and call the create panel
      const createPanel = await import('./createPanel');
      return createPanel.default.callback(context);
    }

    return await buildListResponse(context);
  },
};

export default listPanel;
