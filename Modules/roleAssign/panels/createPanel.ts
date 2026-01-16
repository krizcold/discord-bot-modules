import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SectionBuilder,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RoleSelectMenuBuilder,
  LabelBuilder,
  TextChannel,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { withNotification, closePanelWithSuccess } from '@internal/utils/panel/panelResponseUtils';
import { PendingRoleAssignment, LIMITS, ReactionPersistMode, RoleAssignmentGroup } from '../types/roleAssign';
import { COLOR_PRESETS } from '@bot/types/settingsTypes';
import { addGroup, getGroup, removeGroup } from '../manager/data';
import { buildGroupMessages, toMessageCreateOptions } from '../utils/messageBuilder';
import { registerReactionHandlersForGroup } from '../handlers/registry';
import {
  createPendingAssignment,
  getPendingAssignment,
  updatePendingAssignment,
  deletePendingAssignment,
} from '../state';
import { parseEmoji } from '@internal/utils/emojiHandler';
import { botCanAssignRole } from '../utils/roleValidation';
import {
  PANEL_ID,
  BTN_BACK_LIST,
  BTN_ADD_ROLE,
  BTN_EDIT_ROLE,
  BTN_APPEARANCE,
  BTN_APPEARANCE_BACK,
  BTN_EDIT_EMBED,
  BTN_EDIT_TEXT,
  BTN_PUBLISH,
  BTN_SAVE_EDIT,
  BTN_DELETE,
  buildButtonId,
  parseButtonId,
  DROPDOWN_SELECTION_MODE,
  DROPDOWN_INTERACTION_MODE,
  DROPDOWN_DISPLAY_MODE,
  DROPDOWN_REACTION_PERSIST,
} from '../constants/prefixes';
import { paginate, buildPaginationRow, parsePageFromCustomId } from '@internal/utils/panel/paginationUtils';

const ROLES_PER_PAGE = 6;

const roleAssignPanel: PanelOptions = {
  id: PANEL_ID,
  name: 'Create Role Assignment',
  description: 'Create or edit role assignment messages',
  category: 'Moderation',
  panelScope: 'guild',
  showInAdminPanel: false, // List panel is the main entry point
  registerAsCommand: false,
  requiredPermissions: ['ManageRoles'],

  // Web-UI requires channel selection - role assignment is published to the selected channel
  requiresChannel: true,

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    const { guildId, userId, data } = context;

    if (!guildId) {
      return createV2Response(buildErrorContainer('This panel can only be used in a server.'));
    }

    let pendingId = data?.pendingId;
    let pending: PendingRoleAssignment | undefined;

    if (pendingId) {
      pending = getPendingAssignment(guildId, pendingId);
    }

    if (!pending) {
      pending = createPendingAssignment(guildId, userId);
    }

    if (data?.view === 'appearance') {
      return buildAppearancePanelResponse(context, pending);
    }

    return buildCreatePanelResponse(context, pending);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse | null> => {
    const { guildId, client, interaction } = context;
    if (!guildId) return null;

    const parsed = parseButtonId(buttonId);
    if (!parsed) return null;

    const { action, data } = parsed;

    // Handle navigation (pagination)
    if (action === 'nav') {
      const pendingId = data[0];
      const pending = getPendingAssignment(guildId, pendingId);
      if (!pending) return null;

      const navPrefix = `nav_${pendingId}`;
      const newPage = parsePageFromCustomId(buttonId, navPrefix);
      if (newPage === null) return null;

      context.data = { ...context.data, currentPage: newPage, pendingId };
      return buildCreatePanelResponse(context, pending, newPage);
    }

    // Handle Cancel - clean up state and close panel
    if (action === 'cancel') {
      const pendingId = data[0];
      if (pendingId) {
        deletePendingAssignment(guildId, pendingId);
      }
      return { closePanel: true };
    }

    // Handle Back to List - return to list panel
    if (action === 'back_list') {
      const pendingId = data[0];
      if (pendingId) {
        deletePendingAssignment(guildId, pendingId);
      }
      // Navigate back to list panel
      const listPanel = await import('./listPanel');
      return listPanel.default.callback(context);
    }

    // Handle Add Role - show modal
    if (action === 'add_role') {
      const pendingId = data[0];
      const pending = getPendingAssignment(guildId, pendingId);
      const isReactionMode = (pending?.interactionMode || 'button') === 'reaction';

      return { modal: buildAddRoleModal(pendingId, isReactionMode) };
    }

    // Handle Edit Role - show modal
    if (action === 'edit_role') {
      const pendingId = data[0];
      const roleIndex = parseInt(data[1], 10);

      const pending = getPendingAssignment(guildId, pendingId);
      if (!pending || !pending.roles || !pending.roles[roleIndex]) {
        return createV2Response(buildErrorContainer('Role not found.'));
      }

      const role = pending.roles[roleIndex];
      const isReactionMode = (pending.interactionMode || 'button') === 'reaction';

      return { modal: buildEditRoleModal(pendingId, roleIndex, role, isReactionMode) };
    }

    // Handle Edit Embed - show modal
    if (action === 'edit_embed') {
      const pendingId = data[0];
      const pending = getPendingAssignment(guildId, pendingId);
      if (!pending) {
        return createV2Response(buildErrorContainer('Assignment not found.'));
      }

      return { modal: buildEditEmbedModal(pendingId, pending) };
    }

    // Handle Edit Text - show modal
    if (action === 'edit_text') {
      const pendingId = data[0];
      const pending = getPendingAssignment(guildId, pendingId);
      if (!pending) {
        return createV2Response(buildErrorContainer('Assignment not found.'));
      }

      return { modal: buildEditTextModal(pendingId, pending) };
    }

    // Handle Appearance - navigate to appearance view
    if (action === 'appearance') {
      const pendingId = data[0];
      const pending = getPendingAssignment(guildId, pendingId);
      if (!pending) {
        return createV2Response(buildErrorContainer('Assignment not found.'));
      }

      return buildAppearancePanelResponse(context, pending);
    }

    // Handle Appearance Back - return to main create view
    if (action === 'appearance_back') {
      const pendingId = data[0];
      const pending = getPendingAssignment(guildId, pendingId);
      if (!pending) {
        return createV2Response(buildErrorContainer('Assignment not found.'));
      }

      return buildCreatePanelResponse(context, pending);
    }

    // Handle Publish - send role assignment to channel
    if (action === 'publish') {
      const pendingId = data[0];
      return await handlePublishAction(context, pendingId);
    }

    // Handle Save Edit - update existing role assignment messages
    if (action === 'save_edit') {
      const pendingId = data[0];
      return await handleSaveEditAction(context, pendingId);
    }

    // Handle Delete - delete pending/group and close panel
    if (action === 'delete') {
      const pendingId = data[0];
      return await handleDeleteAction(context, pendingId);
    }

    return null;
  },

  handleDropdown: async (
    context: PanelContext,
    values: string[],
    dropdownId?: string
  ): Promise<PanelResponse> => {
    const { guildId } = context;
    if (!guildId || !dropdownId) {
      return createV2Response(buildErrorContainer('Invalid dropdown interaction.'));
    }

    const lastUnderscore = dropdownId.lastIndexOf('_');
    if (lastUnderscore === -1) {
      return createV2Response(buildErrorContainer('Invalid dropdown format.'));
    }
    const type = dropdownId.substring(0, lastUnderscore);
    const pendingId = dropdownId.substring(lastUnderscore + 1);

    if (!pendingId) {
      return createV2Response(buildErrorContainer('Missing pending ID.'));
    }

    const value = values[0];

    if (type === DROPDOWN_SELECTION_MODE) {
      updatePendingAssignment(guildId, pendingId, {
        selectionMode: value as 'single' | 'exclusive' | 'multiple',
      });
    } else if (type === DROPDOWN_INTERACTION_MODE) {
      updatePendingAssignment(guildId, pendingId, {
        interactionMode: value as 'button' | 'reaction',
      });
    } else if (type === DROPDOWN_DISPLAY_MODE) {
      const current = getPendingAssignment(guildId, pendingId);
      const newMode = value as 'embed-inside' | 'embed-outside' | 'text-only';
      const updates: Partial<PendingRoleAssignment> = { displayMode: newMode };

      if (current) {
        const wasTextMode = current.displayMode === 'text-only';
        const isTextMode = newMode === 'text-only';

        if (wasTextMode && !isTextMode) {
          // Switching FROM text-only TO embed: migrate textContent → embedDescription
          if (current.textContent && !current.embedDescription) {
            updates.embedDescription = current.textContent;
          }
        } else if (!wasTextMode && isTextMode) {
          // Switching TO text-only FROM embed: migrate embedDescription → textContent
          if (current.embedDescription && !current.textContent) {
            updates.textContent = current.embedDescription;
          }
        }
      }

      updatePendingAssignment(guildId, pendingId, updates);
    } else if (type === DROPDOWN_REACTION_PERSIST) {
      updatePendingAssignment(guildId, pendingId, {
        reactionPersist: value as ReactionPersistMode,
      });
    }

    const updated = getPendingAssignment(guildId, pendingId);
    if (!updated) {
      return createV2Response(buildErrorContainer('Failed to update.'));
    }

    return buildAppearancePanelResponse(context, updated);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    const { guildId, interaction } = context;
    if (!guildId || !interaction) {
      return createV2Response(buildErrorContainer('Invalid modal interaction.'));
    }

    const parts = modalId.split('_');
    const action = parts[0];

    if (action === 'add' && parts[1] === 'role') {
      return handleAddRoleModal(context, parts[2]);
    }

    if (action === 'edit' && parts[1] === 'role') {
      return handleEditRoleModal(context, parts[2], parseInt(parts[3], 10));
    }

    if (action === 'edit' && parts[1] === 'embed') {
      return handleEditEmbedModal(context, parts[2]);
    }

    if (action === 'edit' && parts[1] === 'text') {
      return handleEditTextModal(context, parts[2]);
    }

    return createV2Response(buildErrorContainer('Unknown modal action.'));
  },
};

// Modal builder functions
function buildAddRoleModal(pendingId: string, isReactionMode: boolean): ModalBuilder {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('role_id')
    .setPlaceholder('Select a role...');

  const roleLabel = new LabelBuilder()
    .setLabel('Role')
    .setDescription('Select a role to add to the assignment panel')
    .setRoleSelectMenuComponent(roleSelect);

  const modal = new ModalBuilder()
    .setCustomId(`panel_${PANEL_ID}_modal_add_role_${pendingId}`)
    .setTitle('Add Role');

  modal.addLabelComponents(roleLabel);

  // For reaction mode: only emoji input (no label/text needed)
  // For button mode: label and emoji inputs (at least one required)
  if (!isReactionMode) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('label')
          .setLabel('Button Label (or use emoji-only)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Red Team')
          .setRequired(false)
          .setMaxLength(80)
      )
    );
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('emoji')
        .setLabel(isReactionMode ? 'Emoji (required for reactions)' : 'Emoji (required if no label)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Unicode or custom emoji')
        .setRequired(isReactionMode)
        .setMaxLength(50)
    )
  );

  if (!isReactionMode) {
    const styleSelect = new StringSelectMenuBuilder()
      .setCustomId('style')
      .setPlaceholder('Select button color...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Gray').setValue('Secondary').setDefault(true),
        new StringSelectMenuOptionBuilder().setLabel('Blue').setValue('Primary'),
        new StringSelectMenuOptionBuilder().setLabel('Green').setValue('Success'),
        new StringSelectMenuOptionBuilder().setLabel('Red').setValue('Danger'),
      );

    const styleLabel = new LabelBuilder()
      .setLabel('Button Color')
      .setDescription('Choose the button color')
      .setStringSelectMenuComponent(styleSelect);

    modal.addLabelComponents(styleLabel);
  }

  return modal;
}

function buildEditRoleModal(
  pendingId: string,
  roleIndex: number,
  role: { label: string; emojiInput?: string; displayEmoji?: string; style?: ButtonStyle },
  isReactionMode: boolean
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`panel_${PANEL_ID}_modal_edit_role_${pendingId}_${roleIndex}`)
    .setTitle('Edit Role');

  // For reaction mode: only emoji input (no label/text needed)
  // For button mode: label and emoji inputs (clear both to remove role)
  if (!isReactionMode) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('label')
          .setLabel('Button Label (clear both label & emoji to remove)')
          .setStyle(TextInputStyle.Short)
          .setValue(role.label)
          .setRequired(false)
          .setMaxLength(80)
      )
    );
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('emoji')
        .setLabel(isReactionMode ? 'Emoji (clear to remove role)' : 'Emoji (required if no label)')
        .setStyle(TextInputStyle.Short)
        .setValue(role.emojiInput || role.displayEmoji || '')
        .setRequired(false) // Allow clearing in edit mode
        .setMaxLength(50)
    )
  );

  if (!isReactionMode) {
    const currentStyle = role.style ? ButtonStyle[role.style] : 'Secondary';
    const styleSelect = new StringSelectMenuBuilder()
      .setCustomId('style')
      .setPlaceholder('Select button color...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Gray').setValue('Secondary').setDefault(currentStyle === 'Secondary'),
        new StringSelectMenuOptionBuilder().setLabel('Blue').setValue('Primary').setDefault(currentStyle === 'Primary'),
        new StringSelectMenuOptionBuilder().setLabel('Green').setValue('Success').setDefault(currentStyle === 'Success'),
        new StringSelectMenuOptionBuilder().setLabel('Red').setValue('Danger').setDefault(currentStyle === 'Danger'),
      );

    const styleLabel = new LabelBuilder()
      .setLabel('Button Color')
      .setDescription('Choose the button color')
      .setStringSelectMenuComponent(styleSelect);

    modal.addLabelComponents(styleLabel);
  }

  return modal;
}

function buildEditEmbedModal(pendingId: string, pending: PendingRoleAssignment): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`panel_${PANEL_ID}_modal_edit_embed_${pendingId}`)
    .setTitle('Edit Embed');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setValue(pending.embedTitle || '')
        .setRequired(false)
        .setMaxLength(256)
    )
  );

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(pending.embedDescription || '')
        .setRequired(false)
        .setMaxLength(4000)
    )
  );

  const colorOptions = COLOR_PRESETS.map(preset =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${preset.name}`)
      .setValue(preset.hex)
      .setEmoji(preset.emoji)
      .setDefault(pending.embedColor === preset.hex)
  );

  const colorSelect = new StringSelectMenuBuilder()
    .setCustomId('color')
    .setPlaceholder('Select embed color...')
    .addOptions(colorOptions);

  const colorLabel = new LabelBuilder()
    .setLabel('Embed Color')
    .setDescription('Choose a color for the embed')
    .setStringSelectMenuComponent(colorSelect);

  modal.addLabelComponents(colorLabel);

  return modal;
}

function buildEditTextModal(pendingId: string, pending: PendingRoleAssignment): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`panel_${PANEL_ID}_modal_edit_text_${pendingId}`)
    .setTitle('Edit Message Text');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('text_content')
        .setLabel('Message Content')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(pending.textContent || '')
        .setRequired(true)
        .setMaxLength(2000)
    )
  );

  return modal;
}

// Action handlers
async function handlePublishAction(
  context: PanelContext,
  pendingId: string
): Promise<PanelResponse> {
  const { guildId, client, interaction, channelId } = context;
  if (!guildId) {
    return createV2Response(buildErrorContainer('No guild context.'));
  }

  const pending = getPendingAssignment(guildId, pendingId);
  if (!pending || !pending.roles || pending.roles.length === 0) {
    return createV2Response(buildErrorContainer('Add at least one role before publishing.'));
  }

  // Get channel - prefer context.channelId, fall back to interaction.channel
  let channel: TextChannel | null = null;

  if (channelId) {
    try {
      const fetchedChannel = await client.channels.fetch(channelId);
      if (fetchedChannel && 'send' in fetchedChannel) {
        channel = fetchedChannel as TextChannel;
      }
    } catch (error) {
      console.error('[RoleAssign] Failed to fetch channel:', error);
      return createV2Response(buildErrorContainer('Could not access the selected channel. It may have been deleted.'));
    }
  } else if (interaction && 'channel' in interaction && interaction.channel && 'send' in interaction.channel) {
    channel = interaction.channel as TextChannel;
  }

  if (!channel) {
    return createV2Response(buildErrorContainer('Cannot send messages in this channel.'));
  }

  const messages = buildGroupMessages(pending, pending.id);
  const messageIds: string[] = [];

  try {
    for (let i = 0; i < messages.length; i++) {
      const payload = toMessageCreateOptions(messages[i]);
      const sent = await channel.send(payload);
      messageIds.push(sent.id);

      if (pending.interactionMode === 'reaction') {
        for (const role of messages[i].roleSubset) {
          if (role.emoji) {
            await sent.react(role.emoji);
          }
        }
      }
    }

    const group: RoleAssignmentGroup = {
      id: pending.id,
      guildId,
      channelId: channel.id,
      messageIds,
      creatorId: pending.creatorId,
      displayMode: pending.displayMode || 'embed-inside',
      interactionMode: pending.interactionMode || 'button',
      selectionMode: pending.selectionMode || 'multiple',
      reactionPersist: pending.reactionPersist,
      embedTitle: pending.embedTitle,
      embedDescription: pending.embedDescription,
      embedColor: pending.embedColor,
      embedThumbnail: pending.embedThumbnail,
      embedFooter: pending.embedFooter,
      textContent: pending.textContent,
      roles: pending.roles,
      createdAt: pending.createdAt,
      updatedAt: Date.now(),
    };

    // If editing, remove old messages
    if (pending.isEditing && pending.originalGroupId) {
      const oldGroup = getGroup(pending.originalGroupId, guildId);
      if (oldGroup) {
        for (const oldMsgId of oldGroup.messageIds) {
          try {
            const oldChannel = await client.channels.fetch(oldGroup.channelId);
            if (oldChannel && 'messages' in oldChannel) {
              const oldMsg = await (oldChannel as TextChannel).messages.fetch(oldMsgId);
              await oldMsg.delete();
            }
          } catch {}
        }
        removeGroup(pending.originalGroupId, guildId);
      }
    }

    addGroup(group);

    if (group.interactionMode === 'reaction') {
      registerReactionHandlersForGroup(client, group);
    }

    deletePendingAssignment(guildId, pendingId);

    // Close the panel with success notification
    // Silent on Discord (just defer+delete), Web-UI still shows popup
    return closePanelWithSuccess('Role assignment published successfully!', undefined, true);
  } catch (error) {
    console.error('[RoleAssign] Publish error:', error);
    return createV2Response(buildErrorContainer('Failed to publish. Please try again.'));
  }
}

async function handleSaveEditAction(
  context: PanelContext,
  pendingId: string
): Promise<PanelResponse> {
  const { guildId, client } = context;
  if (!guildId) {
    return createV2Response(buildErrorContainer('No guild context.'));
  }

  const pending = getPendingAssignment(guildId, pendingId);
  if (!pending || !pending.roles || pending.roles.length === 0) {
    return createV2Response(buildErrorContainer('Add at least one role before saving.'));
  }

  if (!pending.isEditing || !pending.originalGroupId) {
    return createV2Response(buildErrorContainer('This button is only for editing existing groups.'));
  }

  const oldGroup = getGroup(pending.originalGroupId, guildId);
  if (!oldGroup) {
    return createV2Response(buildErrorContainer('Original group not found. Use "Save & Replace" instead.'));
  }

  const messages = buildGroupMessages(pending, oldGroup.id);

  try {
    const oldChannel = await client.channels.fetch(oldGroup.channelId);
    if (!oldChannel || !('messages' in oldChannel)) {
      return createV2Response(buildErrorContainer('Cannot access the original channel.'));
    }

    const textChannel = oldChannel as TextChannel;
    const newMessageIds: string[] = [];

    const minMessages = Math.min(oldGroup.messageIds.length, messages.length);
    for (let i = 0; i < minMessages; i++) {
      try {
        const oldMsg = await textChannel.messages.fetch(oldGroup.messageIds[i]);
        const payload = toMessageCreateOptions(messages[i]);

        if (messages[i].useV2 && messages[i].container) {
          await oldMsg.edit({
            content: null,
            embeds: [],
            components: payload.components || [],
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          await oldMsg.edit({
            content: payload.content || null,
            embeds: payload.embeds || [],
            components: payload.components || [],
          });
        }
        newMessageIds.push(oldMsg.id);

        if (pending.interactionMode === 'reaction' && oldGroup.interactionMode !== 'reaction') {
          for (const role of messages[i].roleSubset) {
            if (role.emoji) {
              await oldMsg.react(role.emoji);
            }
          }
        }
      } catch (e) {
        console.error('[RoleAssign] Failed to edit message:', e);
      }
    }

    if (messages.length > oldGroup.messageIds.length) {
      for (let i = oldGroup.messageIds.length; i < messages.length; i++) {
        const payload = toMessageCreateOptions(messages[i]);
        const sent = await textChannel.send(payload);
        newMessageIds.push(sent.id);

        if (pending.interactionMode === 'reaction') {
          for (const role of messages[i].roleSubset) {
            if (role.emoji) {
              await sent.react(role.emoji);
            }
          }
        }
      }
    } else if (oldGroup.messageIds.length > messages.length) {
      for (let i = messages.length; i < oldGroup.messageIds.length; i++) {
        try {
          const extraMsg = await textChannel.messages.fetch(oldGroup.messageIds[i]);
          await extraMsg.delete();
        } catch {}
      }
    }

    const updatedGroup: RoleAssignmentGroup = {
      ...oldGroup,
      messageIds: newMessageIds,
      displayMode: pending.displayMode || 'embed-inside',
      interactionMode: pending.interactionMode || 'button',
      selectionMode: pending.selectionMode || 'multiple',
      reactionPersist: pending.reactionPersist,
      embedTitle: pending.embedTitle,
      embedDescription: pending.embedDescription,
      embedColor: pending.embedColor,
      embedThumbnail: pending.embedThumbnail,
      embedFooter: pending.embedFooter,
      textContent: pending.textContent,
      roles: pending.roles,
      updatedAt: Date.now(),
    };

    removeGroup(oldGroup.id, guildId);
    addGroup(updatedGroup);

    if (updatedGroup.interactionMode === 'reaction') {
      registerReactionHandlersForGroup(client, updatedGroup);
    }

    deletePendingAssignment(guildId, pendingId);

    // Close the panel with success notification
    // Silent on Discord (just defer+delete), Web-UI still shows popup
    return closePanelWithSuccess('Role assignment updated successfully!', undefined, true);
  } catch (error) {
    console.error('[RoleAssign] Save edit error:', error);
    return createV2Response(buildErrorContainer('Failed to save changes. Please try again.'));
  }
}

async function handleDeleteAction(
  context: PanelContext,
  pendingId: string
): Promise<PanelResponse> {
  const { guildId, client } = context;
  if (!guildId) {
    return createV2Response(buildErrorContainer('No guild context.'));
  }

  const pending = getPendingAssignment(guildId, pendingId);
  if (!pending) {
    return createV2Response(buildErrorContainer('Assignment not found.'));
  }

  // If editing, delete the original group's messages too
  if (pending.isEditing && pending.originalGroupId) {
    const oldGroup = getGroup(pending.originalGroupId, guildId);
    if (oldGroup) {
      for (const oldMsgId of oldGroup.messageIds) {
        try {
          const oldChannel = await client.channels.fetch(oldGroup.channelId);
          if (oldChannel && 'messages' in oldChannel) {
            const oldMsg = await (oldChannel as TextChannel).messages.fetch(oldMsgId);
            await oldMsg.delete();
          }
        } catch {}
      }
      removeGroup(pending.originalGroupId, guildId);
    }
  }

  deletePendingAssignment(guildId, pendingId);

  // Close the panel with success notification
  // Silent on Discord (just defer+delete), Web-UI still shows popup
  return closePanelWithSuccess('Role assignment deleted successfully!', undefined, true);
}

function getModalFieldValue(context: PanelContext, fieldId: string): string {
  const interaction = context.interaction as any;
  if (!interaction?.fields) return '';
  try {
    return interaction.fields.getTextInputValue(fieldId) || '';
  } catch {
    return '';
  }
}

function getModalSelectValues(context: PanelContext, fieldId: string): string[] {
  const interaction = context.interaction as any;
  if (!interaction?.fields) return [];
  try {
    return interaction.fields.getStringSelectValues(fieldId) || [];
  } catch {
    return [];
  }
}

function getModalEntityValues(context: PanelContext, fieldId: string): string[] {
  const interaction = context.interaction as any;
  if (!interaction?.fields) return [];
  try {
    const field = interaction.fields.getField(fieldId);
    if (field && 'values' in field) {
      const values = (field as any).values;
      return Array.isArray(values) ? values : values ? [values] : [];
    }
    return [];
  } catch {
    return [];
  }
}

async function handleErrorWithPanel(
  context: PanelContext,
  pendingId: string,
  errorMessage: string
): Promise<PanelResponse> {
  const { guildId } = context;

  const pending = guildId ? getPendingAssignment(guildId, pendingId) : undefined;
  const panelResponse = pending
    ? buildCreatePanelResponse(context, pending)
    : buildCreatePanelResponse(context, {
        id: pendingId,
        guildId: guildId || '',
        creatorId: context.userId,
        createdAt: Date.now(),
        status: 'draft',
        roles: [],
      });

  // Add notification to the response (shows as followUp on Discord, toast on Web-UI)
  return withNotification(panelResponse, 'error', errorMessage);
}

async function handleAddRoleModal(
  context: PanelContext,
  pendingId: string
): Promise<PanelResponse> {
  const { guildId, interaction, client } = context;
  if (!guildId) {
    return await handleErrorWithPanel(context, pendingId, 'No guild context.');
  }

  const roleIds = getModalEntityValues(context, 'role_id');
  const roleId = roleIds[0];
  const label = getModalFieldValue(context, 'label').trim();
  const emojiInput = getModalFieldValue(context, 'emoji').trim();
  const styleValues = getModalSelectValues(context, 'style');
  const styleStr = styleValues[0] || 'Secondary';
  const style = ButtonStyle[styleStr as keyof typeof ButtonStyle] || ButtonStyle.Secondary;

  if (!roleId) {
    return await handleErrorWithPanel(context, pendingId, 'Please select a role.');
  }

  const pending = getPendingAssignment(guildId, pendingId);
  if (!pending) {
    return await handleErrorWithPanel(context, pendingId, 'Assignment not found.');
  }

  const isReactionMode = (pending.interactionMode || 'button') === 'reaction';

  // Validation:
  // - Reaction mode: emoji is required (label not used)
  // - Button mode: at least one of label or emoji is required
  if (isReactionMode) {
    if (!emojiInput) {
      return await handleErrorWithPanel(context, pendingId, 'Emoji is required for reaction mode.');
    }
  } else {
    if (!label && !emojiInput) {
      return await handleErrorWithPanel(context, pendingId, 'Please provide a button label or emoji (or both).');
    }
  }

  const guild = interaction?.guild || (client ? client.guilds.cache.get(guildId) : null);
  const member = interaction?.member as GuildMember | undefined;

  // For Web-UI, we may not have guild/member - skip role position validation but still validate basic stuff
  if (!guild) {
    return withNotification(
      buildCreatePanelResponse(context, pending),
      'error',
      'Could not validate role. Please try again.'
    );
  }

  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return withNotification(
      buildCreatePanelResponse(context, pending),
      'error',
      'That role no longer exists.'
    );
  }
  if (role.managed) {
    return withNotification(
      buildCreatePanelResponse(context, pending),
      'error',
      'Managed roles (bot roles, integrations) cannot be assigned.'
    );
  }
  if (role.id === guild.id) {
    return withNotification(
      buildCreatePanelResponse(context, pending),
      'error',
      'The @everyone role cannot be assigned.'
    );
  }

  // Role position validation - only if we have member context (Discord interaction)
  if (member) {
    const isOwner = member.id === guild.ownerId;
    if (!isOwner && role.position >= member.roles.highest.position) {
      return withNotification(
        buildCreatePanelResponse(context, pending),
        'error',
        `You cannot add **${role.name}** - it's at or above your highest role (**${member.roles.highest.name}**).`
      );
    }
  }

  if (!botCanAssignRole(guild, roleId)) {
    return withNotification(
      buildCreatePanelResponse(context, pending),
      'error',
      `I cannot assign **${role.name}** - it's at or above my highest role. Move my role higher in Server Settings.`
    );
  }

  if (pending.roles?.some(r => r.roleId === roleId)) {
    return withNotification(
      buildCreatePanelResponse(context, pending),
      'error',
      'This role is already added to the panel.'
    );
  }

  // Parse emoji if provided
  let emoji: string | undefined;
  let displayEmoji: string | undefined;
  if (emojiInput && client) {
    // Use client's guild cache for fully populated emoji cache
    const modalGuild = client.guilds.cache.get(guildId) ?? interaction?.guild ?? null;
    const result = parseEmoji(emojiInput, client, modalGuild);
    if (!result.success) {
      return withNotification(
        buildCreatePanelResponse(context, pending),
        'error',
        result.errorMessage || 'Invalid emoji.'
      );
    }
    emoji = result.identifier;
    displayEmoji = result.displayEmoji;
  }

  const newRoles = [...(pending.roles || []), {
    roleId,
    roleName: role.name, // Store role name for Web-UI display
    label,
    emoji,
    displayEmoji,
    emojiInput: emojiInput || undefined,
    style,
  }];
  updatePendingAssignment(guildId, pendingId, { roles: newRoles });

  const updated = getPendingAssignment(guildId, pendingId);
  if (!updated) {
    return await handleErrorWithPanel(context, pendingId, 'Failed to update.');
  }

  return buildCreatePanelResponse(context, updated);
}

async function handleEditRoleModal(
  context: PanelContext,
  pendingId: string,
  roleIndex: number
): Promise<PanelResponse> {
  const { guildId, interaction, client } = context;
  if (!guildId) {
    return await handleErrorWithPanel(context, pendingId, 'No guild context.');
  }

  const label = getModalFieldValue(context, 'label').trim();
  const emojiInput = getModalFieldValue(context, 'emoji').trim();
  const styleValues = getModalSelectValues(context, 'style');
  const styleStr = styleValues[0];

  const pending = getPendingAssignment(guildId, pendingId);
  if (!pending || !pending.roles || !pending.roles[roleIndex]) {
    return await handleErrorWithPanel(context, pendingId, 'Role not found.');
  }

  const isReactionMode = (pending.interactionMode || 'button') === 'reaction';

  // Calculate which page this role is on
  const currentPage = Math.floor(roleIndex / ROLES_PER_PAGE);

  // Deletion logic:
  // - Reaction mode: clear emoji to remove
  // - Button mode: clear both label AND emoji to remove
  const shouldDelete = isReactionMode ? !emojiInput : (!label && !emojiInput);

  if (shouldDelete) {
    const newRoles = [...pending.roles];
    newRoles.splice(roleIndex, 1);
    updatePendingAssignment(guildId, pendingId, { roles: newRoles });

    const updated = getPendingAssignment(guildId, pendingId);
    if (!updated) {
      return await handleErrorWithPanel(context, pendingId, 'Failed to update.');
    }
    // After deletion, ensure we don't exceed available pages
    const maxPage = Math.max(0, Math.ceil(newRoles.length / ROLES_PER_PAGE) - 1);
    return buildCreatePanelResponse(context, updated, Math.min(currentPage, maxPage));
  }

  // Validation for button mode: at least one of label or emoji is required
  if (!isReactionMode && !label && !emojiInput) {
    return withNotification(
      buildCreatePanelResponse(context, pending, currentPage),
      'error',
      'Please provide a button label or emoji (or both).'
    );
  }

  let emoji: string | undefined;
  let displayEmoji: string | undefined;
  if (emojiInput && client) {
    const guild = interaction?.guild ?? null;
    const result = parseEmoji(emojiInput, client, guild);
    if (!result.success) {
      return withNotification(
        buildCreatePanelResponse(context, pending, currentPage),
        'error',
        result.errorMessage || 'Invalid emoji.'
      );
    }
    emoji = result.identifier;
    displayEmoji = result.displayEmoji;
  }

  const style = styleStr
    ? ButtonStyle[styleStr as keyof typeof ButtonStyle] || pending.roles[roleIndex].style
    : pending.roles[roleIndex].style;

  const newRoles = [...pending.roles];
  newRoles[roleIndex] = {
    ...newRoles[roleIndex],
    label,
    emoji,
    displayEmoji,
    emojiInput: emojiInput || undefined,
    style,
  };
  updatePendingAssignment(guildId, pendingId, { roles: newRoles });

  const updated = getPendingAssignment(guildId, pendingId);
  if (!updated) {
    return await handleErrorWithPanel(context, pendingId, 'Failed to update.');
  }

  return buildCreatePanelResponse(context, updated, currentPage);
}

async function handleEditEmbedModal(
  context: PanelContext,
  pendingId: string
): Promise<PanelResponse> {
  const { guildId } = context;
  if (!guildId) {
    return await handleErrorWithPanel(context, pendingId, 'No guild context.');
  }

  const title = getModalFieldValue(context, 'title').trim() || undefined;
  const description = getModalFieldValue(context, 'description').trim() || undefined;
  const colorValues = getModalSelectValues(context, 'color');
  const color = colorValues[0] || undefined;

  updatePendingAssignment(guildId, pendingId, {
    embedTitle: title,
    embedDescription: description,
    embedColor: color,
  });

  const updated = getPendingAssignment(guildId, pendingId);
  if (!updated) {
    return await handleErrorWithPanel(context, pendingId, 'Failed to update.');
  }

  return buildAppearancePanelResponse(context, updated);
}

async function handleEditTextModal(
  context: PanelContext,
  pendingId: string
): Promise<PanelResponse> {
  const { guildId } = context;
  if (!guildId) {
    return await handleErrorWithPanel(context, pendingId, 'No guild context.');
  }

  const textContent = getModalFieldValue(context, 'text_content').trim();

  updatePendingAssignment(guildId, pendingId, { textContent });

  const updated = getPendingAssignment(guildId, pendingId);
  if (!updated) {
    return await handleErrorWithPanel(context, pendingId, 'Failed to update.');
  }

  return buildAppearancePanelResponse(context, updated);
}

function buildErrorContainer(message: string): ContainerBuilder[] {
  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.danger)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Error**\n${message}`));
  return [container];
}

function hasValidAppearance(pending: PendingRoleAssignment): boolean {
  const isTextMode = pending.displayMode === 'text-only';
  if (isTextMode) {
    return !!pending.textContent;
  }
  return !!(pending.embedTitle || pending.embedDescription);
}

export function buildCreatePanelResponse(
  context: PanelContext,
  pending: PendingRoleAssignment,
  currentPage: number = 0
): PanelResponse {
  const container = new ContainerBuilder().setAccentColor(V2Colors.primary);

  const headerText = pending.isEditing ? '## Edit Role Assignment' : '## Create Role Assignment';
  const displayMode = pending.displayMode || 'embed-inside';
  const interactionMode = pending.interactionMode || 'button';
  const selectionMode = pending.selectionMode || 'multiple';
  const appearanceValid = hasValidAppearance(pending);

  const modeLabel = displayMode === 'text-only' ? 'Text' : displayMode === 'embed-outside' ? 'Embed+' : 'Embed';
  const interLabel = interactionMode === 'button' ? 'Buttons' : 'Reactions';
  const selLabel = selectionMode === 'single' ? 'Single' : selectionMode === 'exclusive' ? 'Exclusive' : 'Multiple';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${headerText}\n-# ${modeLabel} · ${interLabel} · ${selLabel}`)
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const appearanceButton = new ButtonBuilder()
    .setCustomId(buildButtonId(BTN_APPEARANCE, pending.id))
    .setLabel(appearanceValid ? 'Appearance ✓' : 'Appearance ⚠')
    .setStyle(appearanceValid ? ButtonStyle.Secondary : ButtonStyle.Danger);

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildButtonId(BTN_ADD_ROLE, pending.id))
        .setLabel('Add Role')
        .setStyle(ButtonStyle.Primary),
      appearanceButton,
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const roles = pending.roles || [];
  const paginationPrefix = `panel_${PANEL_ID}_btn_nav_${pending.id}`;
  const paginated = paginate(roles, currentPage, {
    itemsPerPage: ROLES_PER_PAGE,
    buttonPrefix: paginationPrefix,
  });

  const isReactionMode = (pending.interactionMode || 'button') === 'reaction';

  if (roles.length > 0) {
    for (let i = 0; i < paginated.items.length; i++) {
      const globalIndex = currentPage * ROLES_PER_PAGE + i;
      const role = paginated.items[i];
      const emojiDisplay = role.displayEmoji ? `${role.displayEmoji} ` : '';
      const colorName = role.style === ButtonStyle.Primary ? 'Blue'
        : role.style === ButtonStyle.Success ? 'Green'
        : role.style === ButtonStyle.Danger ? 'Red'
        : 'Gray';

      // Edit button matches role color, gray for reaction mode
      const editButtonStyle = isReactionMode
        ? ButtonStyle.Secondary
        : (role.style || ButtonStyle.Secondary);

      // Display role name if available, otherwise fall back to mention (for Discord display)
      const roleDisplay = role.roleName ? `@${role.roleName}` : `<@&${role.roleId}>`;

      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${emojiDisplay}\`${role.label}\`**\n${roleDisplay} · ${colorName}`
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildButtonId(BTN_EDIT_ROLE, pending.id, String(globalIndex)))
            .setLabel('Edit')
            .setStyle(editButtonStyle)
        );

      container.addSectionComponents(section);
    }

    const rolesWithEmojis = roles.filter(r => !!r.emoji).length;
    const missingEmojis = isReactionMode && rolesWithEmojis < roles.length;
    const emojisForDupeCheck = roles.map(r => r.emoji).filter(Boolean);
    const duplicateCount = emojisForDupeCheck.length - new Set(emojisForDupeCheck).size;
    const hasDupes = isReactionMode && duplicateCount > 0;

    const warnings: string[] = [];
    if (missingEmojis) warnings.push(`${roles.length - rolesWithEmojis} missing emoji`);
    if (hasDupes) warnings.push(`${duplicateCount} duplicate emoji`);
    const warningText = warnings.length > 0 ? ` ⚠️ ${warnings.join(', ')}` : '';

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${roles.length} role${roles.length !== 1 ? 's' : ''} configured${warningText}`)
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# No roles added yet. Click "Add Role" to add one.')
    );
  }

  container.addActionRowComponents(buildPaginationRow(paginated, paginationPrefix));

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const roleLimit = interactionMode === 'button'
    ? LIMITS.BUTTONS_PER_MESSAGE
    : LIMITS.REACTIONS_PER_MESSAGE;
  const isEmbedInside = displayMode === 'embed-inside';
  const exceedsLimit = isEmbedInside && roles.length > roleLimit;

  const hasRoles = roles.length > 0;
  const allHaveEmojis = roles.every(role => !!role.emoji);
  const emojis = roles.map(r => r.emoji).filter(Boolean);
  const uniqueEmojis = new Set(emojis);
  const hasDuplicateEmojis = emojis.length !== uniqueEmojis.size;
  const reactionModeValid = !isReactionMode || (allHaveEmojis && !hasDuplicateEmojis);
  const isReady = hasRoles && appearanceValid && !exceedsLimit && reactionModeValid;

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...(pending.isEditing
        ? [
            new ButtonBuilder()
              .setCustomId(buildButtonId(BTN_SAVE_EDIT, pending.id))
              .setLabel('Save + Edit')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!isReady),
            new ButtonBuilder()
              .setCustomId(buildButtonId(BTN_PUBLISH, pending.id))
              .setLabel('Save & Replace')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(!isReady),
          ]
        : [
            new ButtonBuilder()
              .setCustomId(buildButtonId(BTN_PUBLISH, pending.id))
              .setLabel('Publish')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!isReady),
          ]),
      new ButtonBuilder()
        .setCustomId(buildButtonId(BTN_BACK_LIST, pending.id))
        .setLabel('\u25C0 Back')
        .setStyle(ButtonStyle.Secondary),
      ...(pending.isEditing
        ? [
            new ButtonBuilder()
              .setCustomId(buildButtonId(BTN_DELETE, pending.id))
              .setLabel('Delete')
              .setStyle(ButtonStyle.Danger),
          ]
        : []),
    )
  );

  return createV2Response([container]);
}

function buildButtonPreviewText(count: number): string {
  if (count === 0) {
    return '`[+ Add roles to see preview]`';
  }

  const perMessage = LIMITS.BUTTONS_PER_MESSAGE;
  const perRow = 5;
  const lines: string[] = [];
  let remaining = count;
  let messageIndex = 0;

  while (remaining > 0) {
    if (messageIndex > 0) {
      lines.push('');  // Blank line for message separation
    }

    const inThisMessage = Math.min(remaining, perMessage);
    let inMessageRemaining = inThisMessage;

    while (inMessageRemaining > 0) {
      const inThisRow = Math.min(inMessageRemaining, perRow);
      lines.push(Array(inThisRow).fill('`[●]`').join(' '));
      inMessageRemaining -= inThisRow;
    }

    remaining -= inThisMessage;
    messageIndex++;
  }

  return lines.join('\n');
}

function buildReactionPreviewText(count: number): string {
  if (count === 0) {
    return 'Add roles with emojis to see preview';
  }

  const perMessage = LIMITS.REACTIONS_PER_MESSAGE;
  const perRow = 10;
  const lines: string[] = [];
  let remaining = count;
  let messageIndex = 0;

  while (remaining > 0) {
    if (messageIndex > 0) {
      lines.push('');  // Blank line for message separation
    }

    const inThisMessage = Math.min(remaining, perMessage);
    let inMessageRemaining = inThisMessage;

    while (inMessageRemaining > 0) {
      const inThisRow = Math.min(inMessageRemaining, perRow);
      lines.push(Array(inThisRow).fill('⬜').join(' '));
      inMessageRemaining -= inThisRow;
    }

    remaining -= inThisMessage;
    messageIndex++;
  }

  return lines.join('\n');
}

function addPreviewContent(container: ContainerBuilder, pending: PendingRoleAssignment): void {
  const displayMode = pending.displayMode || 'embed-inside';
  const interactionMode = pending.interactionMode || 'button';
  const roleCount = pending.roles?.length || 0;

  const buttonPreview = interactionMode === 'button'
    ? buildButtonPreviewText(roleCount)
    : buildReactionPreviewText(roleCount);

  if (displayMode === 'embed-inside') {
    const title = pending.embedTitle || '_Title_';
    const desc = pending.embedDescription
      ? (pending.embedDescription.length > 60 ? pending.embedDescription.substring(0, 60) + '...' : pending.embedDescription)
      : '_Description_';

    // Prepend blockquote to each line of button preview for embed-inside
    const quotedButtonPreview = buttonPreview.split('\n').map(line => `> ${line}`).join('\n');

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `> **${title}**\n> ${desc}\n${quotedButtonPreview}`
      )
    );
  } else if (displayMode === 'embed-outside') {
    const title = pending.embedTitle || '_Title_';

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `> **${title}** *(embed)*\n\n${buttonPreview}`
      )
    );
  } else {
    const text = pending.textContent || '_Your message text_';
    const preview = text.length > 80 ? text.substring(0, 80) + '...' : text;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${preview}\n${buttonPreview}`
      )
    );
  }
}

function buildAppearancePanelResponse(
  context: PanelContext,
  pending: PendingRoleAssignment
): PanelResponse {
  const container = new ContainerBuilder().setAccentColor(V2Colors.primary);
  const isTextMode = pending.displayMode === 'text-only';
  const isReactionMode = (pending.interactionMode || 'button') === 'reaction';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Appearance Settings')
  );

  // 1. Interaction Mode (how users interact - affects other options)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🎛️ **Interaction Type**\n-# How users will select roles')
  );
  container.addActionRowComponents(buildInteractionModeDropdown(pending));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // 2. Display Mode (visual format - options depend on interaction mode)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🖼️ **Display Format**\n-# Choose how your role message will look')
  );
  container.addActionRowComponents(buildDisplayModeDropdown(pending, isReactionMode));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // 3. Reaction Persist Mode (only for reaction mode)
  if (isReactionMode) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔄 **Reaction Behavior**\n-# What happens when a user reacts')
    );
    container.addActionRowComponents(buildReactionPersistDropdown(pending));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }

  // 4. Selection Mode (assignment behavior)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('✅ **Selection Behavior**\n-# How many roles can be assigned')
  );
  container.addActionRowComponents(buildSelectionModeDropdown(pending));

  // Preview Section
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**Preview**')
  );
  addPreviewContent(container, pending);

  // Action Buttons
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(isTextMode ? buildButtonId(BTN_EDIT_TEXT, pending.id) : buildButtonId(BTN_EDIT_EMBED, pending.id))
        .setLabel(isTextMode ? 'Edit Text Content' : 'Edit Embed Content')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buildButtonId(BTN_APPEARANCE_BACK, pending.id))
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
    )
  );

  return createV2Response([container]);
}

function buildSelectionModeDropdown(pending: PendingRoleAssignment): ActionRowBuilder<StringSelectMenuBuilder> {
  const current = pending.selectionMode || 'multiple';
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`panel_${PANEL_ID}_dropdown_${DROPDOWN_SELECTION_MODE}_${pending.id}`)
      .setPlaceholder('Selection Mode')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Single')
          .setValue('single')
          .setDescription('One role only, cannot change')
          .setDefault(current === 'single'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Exclusive')
          .setValue('exclusive')
          .setDescription('One at a time, can switch')
          .setDefault(current === 'exclusive'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Multiple')
          .setValue('multiple')
          .setDescription('Can have many, toggle on/off')
          .setDefault(current === 'multiple'),
      )
  );
}

function buildInteractionModeDropdown(pending: PendingRoleAssignment): ActionRowBuilder<StringSelectMenuBuilder> {
  const current = pending.interactionMode || 'button';
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`panel_${PANEL_ID}_dropdown_${DROPDOWN_INTERACTION_MODE}_${pending.id}`)
      .setPlaceholder('Interaction Mode')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Buttons')
          .setValue('button')
          .setDescription('Click buttons to assign roles')
          .setDefault(current === 'button'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Reactions')
          .setValue('reaction')
          .setDescription('React with emojis to assign roles')
          .setDefault(current === 'reaction'),
      )
  );
}

function buildDisplayModeDropdown(pending: PendingRoleAssignment, isReactionMode: boolean): ActionRowBuilder<StringSelectMenuBuilder> {
  const current = pending.displayMode || 'embed-inside';

  const options = isReactionMode
    ? [
        new StringSelectMenuOptionBuilder()
          .setLabel('Embed')
          .setValue('embed-inside')
          .setDescription('Single message, max 20 reactions')
          .setDefault(current === 'embed-inside'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Embed + Overflow')
          .setValue('embed-outside')
          .setDescription('Multiple messages if needed')
          .setDefault(current === 'embed-outside'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Text Only')
          .setValue('text-only')
          .setDescription('Plain text, multiple messages if needed')
          .setDefault(current === 'text-only'),
      ]
    : [
        new StringSelectMenuOptionBuilder()
          .setLabel('Embed + Buttons Inside')
          .setValue('embed-inside')
          .setDescription('No overflow, max 25 roles')
          .setDefault(current === 'embed-inside'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Embed + Buttons Outside')
          .setValue('embed-outside')
          .setDescription('Overflow enabled')
          .setDefault(current === 'embed-outside'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Text Only')
          .setValue('text-only')
          .setDescription('Plain text, overflow enabled')
          .setDefault(current === 'text-only'),
      ];

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`panel_${PANEL_ID}_dropdown_${DROPDOWN_DISPLAY_MODE}_${pending.id}`)
      .setPlaceholder('Display Mode')
      .addOptions(options)
  );
}

function buildReactionPersistDropdown(pending: PendingRoleAssignment): ActionRowBuilder<StringSelectMenuBuilder> {
  const current = pending.reactionPersist || 'persistent';
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`panel_${PANEL_ID}_dropdown_${DROPDOWN_REACTION_PERSIST}_${pending.id}`)
      .setPlaceholder('Reaction Behavior')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Persistent Reactions')
          .setValue('persistent')
          .setDescription('Keep reaction, role syncs with reaction state')
          .setDefault(current === 'persistent'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Clear on React')
          .setValue('clear')
          .setDescription('Remove reaction after toggling role')
          .setDefault(current === 'clear'),
      )
  );
}

export default roleAssignPanel;
