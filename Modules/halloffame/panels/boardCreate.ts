/**
 * Hall of Fame Board Create/Edit Panel
 * Compact layout with grouped fields and sub-panels
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
} from 'discord.js';
import { PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { isValidEmojiFormat, parseEmoji } from '@internal/utils/emojiHandler';
import { Board, STATIC_BOARD_DEFAULTS, PendingBoard } from '../types';
import { HOF_PANEL_ID } from '../constants';
import { createBoard, updateBoard, deleteBoard, isEmojiAvailable } from '../manager/boardManager';
import { buildMainPanelResponse } from './main';
import { getPageState } from './main/pageState';
import { getHofConfig } from '../utils/configUtils';
import { formatColor, parseColor } from '../utils/validationUtils';

// Status emojis
const STATUS_EMOJI = {
  draft: '\uD83D\uDFE1',    // Yellow circle
  ready: '\u2705',          // Green checkmark
  on: '\uD83D\uDFE2',       // Green circle
  off: '\u26AB',            // Black circle
};

// Lock format options
const LOCK_FORMAT_OPTIONS = [
  { value: 'images', label: 'Images', emoji: '\uD83D\uDDBC\uFE0F' },
  { value: 'videos', label: 'Videos', emoji: '\uD83C\uDFA5' },
  { value: 'audio', label: 'Audio', emoji: '\uD83D\uDD0A' },
  { value: 'files', label: 'Files', emoji: '\uD83D\uDCC1' },
  { value: 'links', label: 'Links', emoji: '\uD83D\uDD17' },
];

// In-memory pending board state per user
const pendingBoards = new Map<string, PendingBoard>();

function getPendingKey(guildId: string, userId: string): string {
  return `${guildId}_${userId}`;
}

/**
 * Get default board values from config merged with static defaults
 */
function getConfiguredDefaults(guildId: string): Partial<Board> {
  const config = getHofConfig(guildId);
  return {
    ...STATIC_BOARD_DEFAULTS,
    minReactions: config.defaults.minReactions,
    removalThreshold: config.defaults.removalThreshold,
    embedColor: config.defaults.embedColor,
    allowSelfReact: config.defaults.allowSelfReact,
    autoReact: config.defaults.autoReact,
    syncEdits: config.defaults.syncEdits,
    syncDeletes: config.defaults.syncDeletes,
  };
}

export function getPendingBoard(guildId: string, userId: string): PendingBoard {
  const key = getPendingKey(guildId, userId);
  return pendingBoards.get(key) || { ...getConfiguredDefaults(guildId) };
}

export function setPendingBoard(guildId: string, userId: string, pending: PendingBoard): void {
  const key = getPendingKey(guildId, userId);
  pendingBoards.set(key, pending);
}

export function clearPendingBoard(guildId: string, userId: string): void {
  const key = getPendingKey(guildId, userId);
  pendingBoards.delete(key);
}

/**
 * Check if board has minimum required fields for creation
 */
function isReadyToSave(pending: PendingBoard, guildId: string, excludeId?: string): boolean {
  if (!pending.name || pending.name.trim() === '') return false;
  if (!pending.emojiIdentifier || !isValidEmojiFormat(pending.emojiDisplay)) return false;
  if (!pending.destinationChannelId) return false;
  if (!isEmojiAvailable(guildId, pending.emojiIdentifier, excludeId)) return false;
  return true;
}

/**
 * Build the board create/edit panel response (COMPACT - grouped fields)
 */
export function buildBoardCreateResponse(
  context: PanelContext,
  existingBoard: Board | null
): PanelResponse {
  const guildId = context.guildId!;
  const userId = context.userId;
  const config = getHofConfig(guildId);
  const configuredDefaults = getConfiguredDefaults(guildId);

  let pending = getPendingBoard(guildId, userId);

  if (existingBoard) {
    pending = { ...existingBoard, existingId: existingBoard.id };
    setPendingBoard(guildId, userId, pending);
  } else if (!pending.existingId && Object.keys(pending).length <= Object.keys(configuredDefaults).length) {
    pending = { ...configuredDefaults };
    setPendingBoard(guildId, userId, pending);
  }

  const isEditing = !!pending.existingId;
  const isReady = isReadyToSave(pending, guildId, pending.existingId);

  // Check what's missing for basic info
  const hasName = pending.name && pending.name.trim() !== '';
  const hasEmoji = pending.emojiIdentifier && isValidEmojiFormat(pending.emojiDisplay);
  const hasDest = !!pending.destinationChannelId;
  const basicComplete = hasName && hasEmoji && hasDest;

  const container = new ContainerBuilder()
    .setAccentColor(isReady ? V2Colors.success : config.colors.createPanel);

  // Title + Status
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# ${isEditing ? 'Edit Board' : 'Create New Board'}\n${isReady ? `${STATUS_EMOJI.ready} Ready to save` : `${STATUS_EMOJI.draft} Draft - missing required fields`}`
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // === BASIC INFO (Name, Emoji, Hall of Fame channel) ===
  const nameDisplay = hasName ? pending.name : '*Not set*';
  const emojiDisplay = hasEmoji ? pending.emojiDisplay : '*Not set*';
  const destDisplay = hasDest ? `<#${pending.destinationChannelId}>` : '*Not set*';
  const basicLabel = basicComplete ? '**\uD83D\uDCDD Basic Info**' : '**\uD83D\uDCDD Basic Info** \u26A0\uFE0F';

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${basicLabel}\nName: ${nameDisplay}\nEmoji: ${emojiDisplay}\nHall of Fame: ${destDisplay}`
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_basic`)
          .setLabel('Configure')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // === THRESHOLDS ===
  const minReactions = pending.minReactions ?? 3;
  const removalThreshold = pending.removalThreshold ?? 0;
  const removalDisplay = removalThreshold === 0 ? 'Never' : String(removalThreshold);

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**\uD83D\uDD22 Thresholds**\nMin Reactions: \`${minReactions}\`\nRemoval: \`${removalDisplay}\``
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_edit_thresholds`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // === OPTIONS (Toggles + Watch Channels) ===
  const watchCount = pending.sourceChannelIds?.length ?? 0;
  const watchDisplay = watchCount === 0 ? 'All channels' : `${watchCount} channel${watchCount > 1 ? 's' : ''}`;
  const hasWatchChannels = watchCount > 0;
  const selfReact = pending.allowSelfReact ?? false;
  const autoReact = pending.autoReact ?? true;
  const syncEdits = pending.syncEdits ?? false;
  const syncDeletes = pending.syncDeletes ?? false;

  // Status indicators: green circle = ON, black circle = OFF
  const autoIcon = hasWatchChannels ? (autoReact ? STATUS_EMOJI.on : STATUS_EMOJI.off) : STATUS_EMOJI.off;
  const selfIcon = selfReact ? STATUS_EMOJI.on : STATUS_EMOJI.off;
  const editsIcon = syncEdits ? STATUS_EMOJI.on : STATUS_EMOJI.off;
  const deletesIcon = syncDeletes ? STATUS_EMOJI.on : STATUS_EMOJI.off;

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**\u2699\uFE0F Options**\nWatch: ${watchDisplay}\n${autoIcon} Auto-React\n${selfIcon} Author-React\n${editsIcon} Sync Edits\n${deletesIcon} Sync Deletes`
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_options`)
          .setLabel('Configure')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // === ADVANCED (Color, Unfeatured, Locks) ===
  const embedColor = formatColor(pending.embedColor ?? 0xFFD700);
  const unfeaturedAction = pending.unfeaturedAction === 'edit' ? 'Edit' : 'Delete';
  const hasLocks = pending.lockSourceEnabled || pending.lockDestinationEnabled;
  const lockIcon = hasLocks ? STATUS_EMOJI.on : STATUS_EMOJI.off;

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**\uD83C\uDFA8 Advanced**\nEmbed Color: ${embedColor}\nUnfeatured Action: ${unfeaturedAction}\n${lockIcon} Channel Locks`
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_advanced`)
          .setLabel('Configure')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Footer info (only when editing)
  if (isEditing && pending.createdAt) {
    const createdDate = new Date(pending.createdAt);
    const formattedDate = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Created: ${formattedDate} \u2022 ID: ${pending.existingId?.substring(0, 8)}`)
    );
  }

  // Action buttons
  const actionButtons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(`panel_${HOF_PANEL_ID}_btn_cancel`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary),
  ];

  if (isEditing) {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_delete_board`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    );
  }

  actionButtons.push(
    new ButtonBuilder()
      .setCustomId(`panel_${HOF_PANEL_ID}_btn_save`)
      .setLabel(isEditing ? 'Save' : 'Create')
      .setEmoji(isReady ? '\uD83D\uDCBE' : '\u274C')
      .setStyle(isReady ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!isReady)
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...actionButtons)
  );

  return createV2Response([container]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-PANELS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the basic info sub-panel (Name, Emoji, Hall of Fame channel)
 */
function buildBasicInfoSubPanel(context: PanelContext, pending: PendingBoard): PanelResponse {
  const container = new ContainerBuilder().setAccentColor(V2Colors.info);

  const hasName = pending.name && pending.name.trim() !== '';
  const hasEmoji = pending.emojiIdentifier && isValidEmojiFormat(pending.emojiDisplay);
  const hasDest = !!pending.destinationChannelId;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Basic Info\n-# Required fields for the board')
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Name
  const nameLabel = hasName ? '**Name**' : '**Name** \u26A0\uFE0F';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${nameLabel}\n${pending.name || '*Not set*'}`))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_edit_name`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // Emoji
  const emojiLabel = hasEmoji ? '**Emoji**' : '**Emoji** \u26A0\uFE0F';
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojiLabel}\n${pending.emojiDisplay || '*Not set*'}`))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_edit_emoji`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // Hall of Fame channel
  const destLabel = hasDest ? '**Hall of Fame Channel**' : '**Hall of Fame Channel** \u26A0\uFE0F';
  const destDisplay = hasDest ? `<#${pending.destinationChannelId}>` : '*Not set*';
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${destLabel}\n${destDisplay}`));

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_dropdown_destination`)
    .setPlaceholder('Select Hall of Fame channel...')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  if (pending.destinationChannelId) {
    channelSelect.setDefaultChannels(pending.destinationChannelId);
  }
  container.addActionRowComponents(
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect)
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_back`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return createV2Response([container]);
}

/**
 * Build the options sub-panel (watch channels + toggles)
 */
function buildOptionsSubPanel(context: PanelContext, pending: PendingBoard): PanelResponse {
  const container = new ContainerBuilder().setAccentColor(V2Colors.info);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Options')
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // === WATCH CHANNELS ===
  const channels = pending.sourceChannelIds || [];
  const hasWatchChannels = channels.length > 0;

  if (channels.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Watch Channels**\nCurrently watching: **All channels**')
    );
  } else {
    const channelList = channels.slice(0, 5).map(id => `<#${id}>`).join(', ');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Watch Channels**\nCurrently watching: ${channels.length} channel${channels.length > 1 ? 's' : ''}\n${channelList}${channels.length > 5 ? '...' : ''}`)
    );
  }

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_dropdown_watch_channels`)
    .setPlaceholder('Select channels to monitor...')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(0)
    .setMaxValues(25);
  if (channels.length > 0) {
    channelSelect.setDefaultChannels(channels);
  }
  container.addActionRowComponents(
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('-# Empty = monitor all channels')
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // === TOGGLES ===
  const autoReact = pending.autoReact ?? true;
  const authorReact = pending.allowSelfReact ?? false;
  const syncEdits = pending.syncEdits ?? false;
  const syncDeletes = pending.syncDeletes ?? false;

  // Auto-React is disabled when monitoring all channels (no watch channels set)
  const autoReactDisabled = !hasWatchChannels;
  const autoReactLabel = autoReactDisabled
    ? 'N/A'
    : (autoReact ? 'ON' : 'OFF');

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**Auto-React**\n-# Bot reacts to messages in watched channels'
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_toggle_auto`)
          .setLabel(autoReactLabel)
          .setStyle(autoReact && !autoReactDisabled ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(autoReactDisabled)
      )
  );

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**Author-React**\n-# Allow authors to react to their own messages'
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_toggle_self`)
          .setLabel(authorReact ? 'ON' : 'OFF')
          .setStyle(authorReact ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
  );

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**Sync Edits**\n-# Update featured when original is edited'
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_toggle_edits`)
          .setLabel(syncEdits ? 'ON' : 'OFF')
          .setStyle(syncEdits ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
  );

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**Sync Deletes**\n-# Handle featured when original is deleted'
      ))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_toggle_deletes`)
          .setLabel(syncDeletes ? 'ON' : 'OFF')
          .setStyle(syncDeletes ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_watch_clear`)
        .setLabel('Clear Watch')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(channels.length === 0),
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_back`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return createV2Response([container]);
}

/**
 * Build the advanced settings sub-panel
 */
function buildAdvancedSubPanel(context: PanelContext, pending: PendingBoard): PanelResponse {
  const container = new ContainerBuilder().setAccentColor(V2Colors.warning);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Advanced Settings')
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Embed color
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Embed Color**\n${formatColor(pending.embedColor ?? 0xFFD700)}`))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_edit_color`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  // Unfeatured action dropdown
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**When Unfeatured**'));

  const unfeaturedAction = pending.unfeaturedAction ?? 'delete';
  const actionSelect = new StringSelectMenuBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_dropdown_unfeatured_action`)
    .setPlaceholder('Select action...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Delete message')
        .setDescription('Remove the featured message entirely')
        .setValue('delete')
        .setDefault(unfeaturedAction === 'delete'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Edit to show removed')
        .setDescription('Edit message to indicate it was unfeatured')
        .setValue('edit')
        .setDefault(unfeaturedAction === 'edit')
    );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actionSelect)
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Excluded channels
  const excludedCount = pending.excludedChannels?.length ?? 0;
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Excluded Channels** (${excludedCount})\n-# Channels ignored even if in watch list`))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_excluded`)
          .setLabel('Manage')
          .setStyle(ButtonStyle.Secondary)
      )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Channel locks
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**\uD83D\uDD12 Channel Locks**'));

  const lockSourceEnabled = pending.lockSourceEnabled ?? false;
  const lockDestEnabled = pending.lockDestinationEnabled ?? false;
  const hasWatchChannels = (pending.sourceChannelIds?.length ?? 0) > 0;

  const lockRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`panel_${HOF_PANEL_ID}_btn_toggle_lock_source`)
      .setLabel(`Source Lock: ${lockSourceEnabled ? 'ON' : 'OFF'}`)
      .setStyle(lockSourceEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!hasWatchChannels),
    new ButtonBuilder()
      .setCustomId(`panel_${HOF_PANEL_ID}_btn_toggle_lock_dest`)
      .setLabel(`Dest Lock: ${lockDestEnabled ? 'ON' : 'OFF'}`)
      .setStyle(lockDestEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
  );
  container.addActionRowComponents(lockRow);

  // Lock format config - always show, disable Edit when Source Lock is OFF
  const formats = pending.lockSourceFormats || [];
  // Show "All" if Source Lock is OFF or no formats selected
  const formatDisplay = (!lockSourceEnabled || formats.length === 0) ? 'All' : formats.join(', ');
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Allowed Formats**: ${formatDisplay}`))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_lock_formats`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!lockSourceEnabled)
      )
  );

  if (!hasWatchChannels) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# \u26A0\uFE0F Source lock requires watch channels to be set')
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_back`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return createV2Response([container]);
}

/**
 * Build the excluded channels sub-panel
 */
function buildExcludedChannelsSubPanel(context: PanelContext, pending: PendingBoard): PanelResponse {
  const container = new ContainerBuilder().setAccentColor(V2Colors.info);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Excluded Channels\n-# These channels are ignored even if in watch list')
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const channels = pending.excludedChannels || [];
  if (channels.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('*No excluded channels*'));
  } else {
    const channelList = channels.slice(0, 10).map(id => `<#${id}>`).join('\n');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Currently excluded: ${channels.length} channels\n${channelList}${channels.length > 10 ? '\n...' : ''}`)
    );
  }

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_dropdown_add_excluded`)
    .setPlaceholder('Select channel to exclude...')
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  container.addActionRowComponents(
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect)
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_excluded_clear`)
        .setLabel('Clear All')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(channels.length === 0),
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_back_advanced`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return createV2Response([container]);
}

/**
 * Build the lock formats sub-panel
 */
function buildLockFormatsSubPanel(context: PanelContext, pending: PendingBoard): PanelResponse {
  const container = new ContainerBuilder().setAccentColor(V2Colors.info);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Allowed Content Types\n-# Messages without these will be deleted')
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const currentFormats = pending.lockSourceFormats || [];

  // Format toggle buttons (2 rows)
  const formatRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...LOCK_FORMAT_OPTIONS.slice(0, 3).map(opt =>
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_format_${opt.value}`)
        .setLabel(opt.label)
        .setEmoji(opt.emoji)
        .setStyle(currentFormats.includes(opt.value) ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );
  container.addActionRowComponents(formatRow1);

  const formatRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...LOCK_FORMAT_OPTIONS.slice(3).map(opt =>
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_format_${opt.value}`)
        .setLabel(opt.label)
        .setEmoji(opt.emoji)
        .setStyle(currentFormats.includes(opt.value) ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );
  container.addActionRowComponents(formatRow2);

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_btn_subpanel_back_advanced`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return createV2Response([container]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle board create panel button interactions
 */
export async function handleBoardCreateButton(
  context: PanelContext,
  buttonId: string
): Promise<PanelResponse | null> {
  const guildId = context.guildId!;
  const userId = context.userId;
  const pending = getPendingBoard(guildId, userId);
  const currentPage = getPageState(userId, guildId);

  // Navigation
  if (buttonId === 'cancel') {
    clearPendingBoard(guildId, userId);
    return await buildMainPanelResponse(context, currentPage);
  }

  if (buttonId === 'save') {
    if (pending.existingId) {
      updateBoard(guildId, pending.existingId, pending);
    } else {
      createBoard(guildId, userId, pending);
    }
    clearPendingBoard(guildId, userId);
    return await buildMainPanelResponse(context, currentPage);
  }

  if (buttonId === 'delete_board') {
    if (pending.existingId) {
      deleteBoard(guildId, pending.existingId);
    }
    clearPendingBoard(guildId, userId);
    return await buildMainPanelResponse(context, currentPage);
  }

  // Sub-panel navigation
  if (buttonId === 'subpanel_back') return buildBoardCreateResponse(context, null);
  if (buttonId === 'subpanel_back_advanced') return buildAdvancedSubPanel(context, pending);
  if (buttonId === 'subpanel_basic') return buildBasicInfoSubPanel(context, pending);
  if (buttonId === 'subpanel_options') return buildOptionsSubPanel(context, pending);
  if (buttonId === 'subpanel_advanced') return buildAdvancedSubPanel(context, pending);
  if (buttonId === 'subpanel_excluded') return buildExcludedChannelsSubPanel(context, pending);
  if (buttonId === 'subpanel_lock_formats') return buildLockFormatsSubPanel(context, pending);

  // Toggle buttons
  if (buttonId === 'toggle_self') {
    pending.allowSelfReact = !pending.allowSelfReact;
    setPendingBoard(guildId, userId, pending);
    return buildOptionsSubPanel(context, pending);
  }

  if (buttonId === 'toggle_auto') {
    pending.autoReact = !pending.autoReact;
    setPendingBoard(guildId, userId, pending);
    return buildOptionsSubPanel(context, pending);
  }

  if (buttonId === 'toggle_edits') {
    pending.syncEdits = !pending.syncEdits;
    setPendingBoard(guildId, userId, pending);
    return buildOptionsSubPanel(context, pending);
  }

  if (buttonId === 'toggle_deletes') {
    pending.syncDeletes = !pending.syncDeletes;
    setPendingBoard(guildId, userId, pending);
    return buildOptionsSubPanel(context, pending);
  }

  if (buttonId === 'toggle_lock_source') {
    pending.lockSourceEnabled = !pending.lockSourceEnabled;
    setPendingBoard(guildId, userId, pending);
    return buildAdvancedSubPanel(context, pending);
  }

  if (buttonId === 'toggle_lock_dest') {
    pending.lockDestinationEnabled = !pending.lockDestinationEnabled;
    setPendingBoard(guildId, userId, pending);
    return buildAdvancedSubPanel(context, pending);
  }

  // Lock format toggles
  if (buttonId.startsWith('format_')) {
    const format = buttonId.slice(7);
    if (!pending.lockSourceFormats) pending.lockSourceFormats = [];
    if (pending.lockSourceFormats.includes(format)) {
      pending.lockSourceFormats = pending.lockSourceFormats.filter(f => f !== format);
    } else {
      pending.lockSourceFormats.push(format);
    }
    setPendingBoard(guildId, userId, pending);
    return buildLockFormatsSubPanel(context, pending);
  }

  // Clear buttons
  if (buttonId === 'watch_clear') {
    pending.sourceChannelIds = [];
    // Disable Auto-React when watch channels are cleared (N/A for all-channel monitoring)
    pending.autoReact = false;
    setPendingBoard(guildId, userId, pending);
    return buildOptionsSubPanel(context, pending);
  }

  if (buttonId === 'excluded_clear') {
    pending.excludedChannels = [];
    setPendingBoard(guildId, userId, pending);
    return buildExcludedChannelsSubPanel(context, pending);
  }

  // Modal triggers
  if (buttonId === 'edit_name') {
    return {
      modal: new ModalBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_modal_name`)
        .setTitle('Board Name')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('name')
              .setLabel('Name')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g., Starboard, Hall of Fame')
              .setMaxLength(50)
              .setRequired(true)
              .setValue(pending.name || '')
          )
        )
    };
  }

  if (buttonId === 'edit_emoji') {
    // Pre-fill with original input (emojiInput) if available, otherwise emojiDisplay
    const modalValue = pending.emojiInput || pending.emojiDisplay || '';

    return {
      modal: new ModalBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_modal_emoji`)
        .setTitle('Board Emoji')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('emoji')
              .setLabel('Emoji')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g., ⭐ or :star: or custom emoji')
              .setMaxLength(100)
              .setRequired(true)
              .setValue(modalValue)
          )
        )
    };
  }

  if (buttonId === 'edit_thresholds') {
    return {
      modal: new ModalBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_modal_thresholds`)
        .setTitle('Thresholds')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('min')
              .setLabel('Minimum reactions to feature (1-100)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('3')
              .setMaxLength(3)
              .setRequired(true)
              .setValue(String(pending.minReactions ?? 3))
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('removal')
              .setLabel('Removal threshold (0 = never remove)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('0')
              .setMaxLength(2)
              .setRequired(true)
              .setValue(String(pending.removalThreshold ?? 0))
          )
        )
    };
  }

  if (buttonId === 'edit_color') {
    return {
      modal: new ModalBuilder()
        .setCustomId(`panel_${HOF_PANEL_ID}_modal_color`)
        .setTitle('Embed Color')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('color')
              .setLabel('Hex color for featured message embeds')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g., #FFD700 or FFD700')
              .setMaxLength(7)
              .setRequired(true)
              .setValue(formatColor(pending.embedColor ?? 0xFFD700))
          )
        )
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle board create panel modal submissions
 */
export async function handleBoardCreateModal(
  context: PanelContext,
  modalId: string
): Promise<PanelResponse> {
  const guildId = context.guildId!;
  const userId = context.userId;
  const pending = getPendingBoard(guildId, userId);
  const interaction = context.interaction;

  if (!interaction || !('fields' in interaction)) {
    return buildBoardCreateResponse(context, null);
  }

  const modalInteraction = interaction as ModalSubmitInteraction;
  const fields = modalInteraction.fields;

  if (modalId === 'name') {
    const name = fields.getTextInputValue('name').trim();
    if (name) {
      pending.name = name;
      setPendingBoard(guildId, userId, pending);
    }
    return buildBasicInfoSubPanel(context, pending);
  }

  if (modalId === 'emoji') {
    const emojiInput = fields.getTextInputValue('emoji').trim();
    const client = context.client;

    if (!client) {
      return buildBasicInfoSubPanel(context, pending);
    }

    // Get guild from interaction for emoji resolution
    const guild = context.interaction?.guild ?? null;

    const result = parseEmoji(emojiInput, client, guild);

    if (result.success && result.identifier) {
      pending.emojiIdentifier = result.identifier;
      pending.emojiDisplay = result.displayEmoji;
      pending.emojiInput = emojiInput; // Store original input for edit modal
      setPendingBoard(guildId, userId, pending);
    }
    // If parsing fails, silently return (responseManager pattern)
    return buildBasicInfoSubPanel(context, pending);
  }

  if (modalId === 'thresholds') {
    const minInput = fields.getTextInputValue('min');
    const removalInput = fields.getTextInputValue('removal');

    const minNum = parseInt(minInput.trim(), 10);
    if (!isNaN(minNum) && minNum >= 1 && minNum <= 100) {
      pending.minReactions = minNum;
    }

    const removalNum = parseInt(removalInput.trim(), 10);
    if (!isNaN(removalNum) && removalNum >= 0 && removalNum <= 99) {
      pending.removalThreshold = removalNum;
    }

    setPendingBoard(guildId, userId, pending);
    return buildBoardCreateResponse(context, null);
  }

  if (modalId === 'color') {
    const input = fields.getTextInputValue('color');
    const color = parseColor(input);
    if (color !== null) {
      pending.embedColor = color;
      setPendingBoard(guildId, userId, pending);
    }
    return buildAdvancedSubPanel(context, pending);
  }

  return buildBoardCreateResponse(context, null);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DROPDOWN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle board create panel dropdown selections
 */
export async function handleBoardCreateDropdown(
  context: PanelContext,
  dropdownId: string,
  values: string[]
): Promise<PanelResponse | null> {
  const guildId = context.guildId!;
  const userId = context.userId;
  const pending = getPendingBoard(guildId, userId);

  if (dropdownId === 'destination' && values.length > 0) {
    pending.destinationChannelId = values[0];
    setPendingBoard(guildId, userId, pending);
    return buildBasicInfoSubPanel(context, pending);
  }

  if (dropdownId === 'watch_channels') {
    const hadWatchChannels = (pending.sourceChannelIds?.length ?? 0) > 0;
    const nowHasWatchChannels = values.length > 0;

    pending.sourceChannelIds = values;

    // Auto-enable Auto-React when watch channels are first set
    if (!hadWatchChannels && nowHasWatchChannels) {
      pending.autoReact = true;
    }

    setPendingBoard(guildId, userId, pending);
    return buildOptionsSubPanel(context, pending);
  }

  if (dropdownId === 'unfeatured_action' && values.length > 0) {
    pending.unfeaturedAction = values[0] as 'delete' | 'edit';
    setPendingBoard(guildId, userId, pending);
    return buildAdvancedSubPanel(context, pending);
  }

  if (dropdownId === 'add_excluded' && values.length > 0) {
    const channelId = values[0];
    if (!pending.excludedChannels) pending.excludedChannels = [];
    if (!pending.excludedChannels.includes(channelId)) {
      pending.excludedChannels.push(channelId);
      setPendingBoard(guildId, userId, pending);
    }
    return buildExcludedChannelsSubPanel(context, pending);
  }

  return null;
}
