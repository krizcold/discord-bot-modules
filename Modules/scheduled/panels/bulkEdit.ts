/**
 * Scheduled Messages - Bulk Edit Panel
 *
 * Edit messages in JSON format using shared JSON editor component.
 * Works like Data Browser - passes group ID through context.data and button IDs.
 */

import {
  GatewayIntentBits,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import {
  createV2Response,
  createContainer,
  createText,
  V2Colors,
} from '@internal/utils/panel/v2';
import {
  buildJsonEditorView,
  handleJsonEditorButton,
  handleJsonEditorModal,
  isJsonEditorButton,
  isJsonEditorModal,
  JsonEditorConfig,
} from '@internal/utils/json';

import { getGroup, updateGroup } from '../utils/storage';
import {
  getPendingGroup,
  setPendingGroup,
  getEditingGroupId,
  setEditingGroupId,
} from '../utils/pageState';
import { ScheduledGroup, ScheduledMessage } from '../types/scheduled';
import {
  BULK_EDIT_PANEL_ID,
  BTN,
} from './constants';

/**
 * Build data key that includes group ID (so button IDs contain the group ID)
 */
function buildDataKey(groupId: string | undefined, isNew: boolean): string {
  if (isNew) return 'new';
  return groupId || 'unknown';
}

/**
 * Parse data key to extract group ID
 */
function parseDataKey(dataKey: string): { groupId: string | undefined; isNew: boolean } {
  if (dataKey === 'new') {
    return { groupId: undefined, isNew: true };
  }
  if (dataKey === 'unknown') {
    return { groupId: undefined, isNew: false };
  }
  return { groupId: dataKey, isNew: false };
}

/**
 * Panel data passed through context.data
 */
interface BulkEditPanelData {
  groupId?: string;
  isNew?: boolean;
  source?: 'list' | 'messages';  // Where the user came from
}

/**
 * Get group ID and source from context - checks context.data first, then falls back to page state
 */
function getGroupIdFromContext(context: PanelContext): { groupId: string | undefined; isNew: boolean; source: 'list' | 'messages' } {
  const panelData = context.data as BulkEditPanelData | undefined;

  // First check context.data (passed from button navigation)
  if (panelData?.groupId) {
    return { groupId: panelData.groupId, isNew: panelData.isNew ?? false, source: panelData.source ?? 'list' };
  }

  // Fall back to page state (for backwards compatibility)
  const guildId = context.guildId!;
  const userId = context.userId;
  const editingId = getEditingGroupId(guildId, userId);

  if (editingId) {
    // If we got here via page state, assume came from messages (legacy behavior)
    return { groupId: editingId, isNew: false, source: 'messages' };
  }

  // Check for pending group (new group being created)
  const pending = getPendingGroup(guildId, userId);
  if (pending) {
    return { groupId: undefined, isNew: true, source: 'messages' };
  }

  return { groupId: undefined, isNew: false, source: 'list' };
}

/**
 * Get the group being edited
 */
function getEditingGroup(
  guildId: string,
  userId: string,
  groupId: string | undefined,
  isNew: boolean
): { group: Partial<ScheduledGroup>; isNew: boolean } {
  // If we have a group ID, load from storage
  if (groupId) {
    const stored = getGroup(guildId, groupId);
    if (stored) {
      return { group: stored, isNew: false };
    }
  }

  // Check pending group for new groups
  if (isNew) {
    const pending = getPendingGroup(guildId, userId);
    if (pending) {
      return { group: pending, isNew: true };
    }
  }

  return { group: {}, isNew: true };
}

/**
 * Create JSON editor config for bulk edit
 */
function createEditorConfig(
  guildId: string,
  userId: string,
  groupId: string | undefined,
  isNew: boolean,
  source: 'list' | 'messages'
): JsonEditorConfig {
  const template = [
    { content: 'First scheduled message', image: '' },
    { content: 'Second scheduled message', image: '' },
    { content: 'Add as many as you need...', image: '' },
  ];

  // Get current group data for display
  const { group } = getEditingGroup(guildId, userId, groupId, isNew);
  const groupName = group.name || 'New Group';
  const messages = group.messages || [];

  // Use group ID as dataKey so it's embedded in all button IDs
  const dataKey = buildDataKey(groupId, isNew);

  return {
    panelId: BULK_EDIT_PANEL_ID,
    dataKey: dataKey,
    title: `Bulk Edit - ${groupName}`,
    infoLines: [
      `**Group:** ${groupName}`,
      `**Messages:** ${messages.length}`,
    ],
    getData: () => {
      // Always fetch fresh data
      const { group: currentGroup } = getEditingGroup(guildId, userId, groupId, isNew);
      const msgs = currentGroup.messages || [];
      if (msgs.length === 0) return null;
      return msgs.map(m => ({
        content: m.content,
        image: m.image || '',
        sentCount: m.sentCount,
      }));
    },
    saveData: async (data: any[]) => {
      const { group: currentGroup, isNew: isNewGroup } = getEditingGroup(guildId, userId, groupId, isNew);

      const newMessages: ScheduledMessage[] = data.map((item: any, i: number) => ({
        id: item.id || `msg_${Date.now().toString(36)}_${i}`,
        content: String(item.content || ''),
        image: typeof item.image === 'string' && item.image.trim() ? item.image.trim() : undefined,
        sentCount: typeof item.sentCount === 'number' ? item.sentCount : 0,
        lastSentAt: typeof item.lastSentAt === 'number' ? item.lastSentAt : null,
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      })).filter((m: ScheduledMessage) => m.content.length > 0);

      if (isNewGroup) {
        const pending = getPendingGroup(guildId, userId) || {};
        setPendingGroup(guildId, userId, { ...pending, messages: newMessages });
      } else if (groupId) {
        updateGroup(guildId, groupId, { messages: newMessages });
      }
    },
    validationOptions: { requiredType: 'array' },
    template,
    accentColor: V2Colors.primary,
    // Use extraButton instead of backButtonId to avoid conflict with panel system's return button
    extraButtons: [
      {
        label: source === 'messages' ? 'Messages' : 'Back',
        customId: `panel_${BULK_EDIT_PANEL_ID}_btn_${BTN.BACK}_${source}_${groupId || 'new'}`,
        style: 2, // ButtonStyle.Secondary
        row: 2,
      },
    ],
  };
}

/**
 * Show error when no group context
 */
function showNoGroupError(): PanelResponse {
  return createV2Response([
    createContainer(V2Colors.danger)
      .addTextDisplayComponents(createText('## Error'))
      .addTextDisplayComponents(createText(
        'No scheduled group selected.\n\n' +
        'Please navigate to a group first:\n' +
        '1. Go to **Scheduled Messages** list\n' +
        '2. Click **Edit** on a group\n' +
        '3. Click **Messages**\n' +
        '4. Click **Bulk Edit**'
      ))
  ]);
}

const bulkEditPanel: PanelOptions = {
  id: BULK_EDIT_PANEL_ID,
  name: 'Bulk Edit',
  description: 'Edit messages in bulk',
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

    const { groupId, isNew, source } = getGroupIdFromContext(context);

    // If no group context and not creating new, show error
    if (!groupId && !isNew) {
      return showNoGroupError();
    }

    const config = createEditorConfig(context.guildId, context.userId, groupId, isNew, source);
    return createV2Response([buildJsonEditorView(config, context)]);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;

    // Extract group ID and source from button - check multiple patterns
    let groupId: string | undefined;
    let isNew = false;
    let source: 'list' | 'messages' = 'list';

    // Pattern 1: Back button with source and group ID (e.g., "back_list_grp_xxx" or "back_messages_new")
    if (buttonId.startsWith(`${BTN.BACK}_`)) {
      const suffix = buttonId.replace(`${BTN.BACK}_`, '');
      // Parse source first (list or messages)
      if (suffix.startsWith('list_')) {
        source = 'list';
        const dataKeyPart = suffix.replace('list_', '');
        const parsed = parseDataKey(dataKeyPart);
        groupId = parsed.groupId;
        isNew = parsed.isNew;
      } else if (suffix.startsWith('messages_')) {
        source = 'messages';
        const dataKeyPart = suffix.replace('messages_', '');
        const parsed = parseDataKey(dataKeyPart);
        groupId = parsed.groupId;
        isNew = parsed.isNew;
      } else {
        // Legacy format without source - just groupId
        const parsed = parseDataKey(suffix);
        groupId = parsed.groupId;
        isNew = parsed.isNew;
      }
    }
    // Pattern 2: JSON editor buttons contain dataKey (e.g., "jsonedit_grp_xxx", "jsonupload_new")
    else if (buttonId.includes('_')) {
      const underscoreIdx = buttonId.indexOf('_');
      if (underscoreIdx > 0) {
        const potentialDataKey = buttonId.substring(underscoreIdx + 1);
        const parsed = parseDataKey(potentialDataKey);
        groupId = parsed.groupId;
        isNew = parsed.isNew;
      }
    }

    // Fall back to context.data if nothing found in button ID
    if (!groupId && !isNew) {
      const contextData = getGroupIdFromContext(context);
      groupId = contextData.groupId;
      isNew = contextData.isNew;
      source = contextData.source;
    }

    const config = createEditorConfig(guildId, userId, groupId, isNew, source);

    // Check if JSON editor button
    if (isJsonEditorButton(config, buttonId)) {
      const result = await handleJsonEditorButton(config, context, buttonId);
      if (result) return result;
    }

    // Back navigation - use source to determine destination
    if (buttonId.startsWith(BTN.BACK)) {
      if (source === 'messages') {
        // Go back to Messages panel
        if (groupId) {
          setEditingGroupId(guildId, userId, groupId);
        }
        context.data = { groupId, isNew };
        const messagesPanel = await import('./messages');
        return messagesPanel.default.callback(context);
      } else {
        // Go back to List panel
        const listPanel = await import('./list');
        return listPanel.default.callback(context);
      }
    }

    return createV2Response([buildJsonEditorView(config, context)]);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const guildId = context.guildId!;
    const userId = context.userId;

    // Extract group ID from modal ID (format: action_dataKey)
    let groupId: string | undefined;
    let isNew = false;
    let source: 'list' | 'messages' = 'list';

    if (modalId.includes('_')) {
      const underscoreIdx = modalId.indexOf('_');
      if (underscoreIdx > 0) {
        const potentialDataKey = modalId.substring(underscoreIdx + 1);
        const parsed = parseDataKey(potentialDataKey);
        groupId = parsed.groupId;
        isNew = parsed.isNew;
      }
    }

    // Fall back to context.data
    if (!groupId && !isNew) {
      const contextData = getGroupIdFromContext(context);
      groupId = contextData.groupId;
      isNew = contextData.isNew;
      source = contextData.source;
    }

    const config = createEditorConfig(guildId, userId, groupId, isNew, source);

    // Check if JSON editor modal
    if (isJsonEditorModal(config, modalId)) {
      const result = await handleJsonEditorModal(config, context, modalId);
      if (result) return result;
    }

    return createV2Response([buildJsonEditorView(config, context)]);
  },
};

export default bulkEditPanel;
