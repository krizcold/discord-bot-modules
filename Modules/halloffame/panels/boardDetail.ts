/**
 * Hall of Fame Board Detail Panel
 * Shows board information and management options
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { Board } from '../types';
import { HOF_PANEL_ID } from '../constants';
import { getFeaturedCount } from '../manager/boardManager';
import { formatColor } from '../utils/validationUtils';

/**
 * Build the board detail panel response
 */
export function buildBoardDetailResponse(
  context: PanelContext,
  board: Board,
  returnPage: number = 0
): PanelResponse {
  const guildId = context.guildId!;
  const featuredCount = getFeaturedCount(guildId, board.id);

  const container = new ContainerBuilder()
    .setAccentColor(board.embedColor);

  // Title with emoji
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${board.emojiDisplay} ${board.name}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Status
  const statusText = board.enabled ? '\u2705 **Active**' : '\u26D4 **Disabled**';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Status:** ${statusText}`)
  );

  // Stats
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Featured Messages:** ${featuredCount}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Configuration
  const configLines: string[] = [];

  // Channels
  configLines.push(`**Destination:** <#${board.destinationChannelId}>`);
  if (board.sourceChannelIds.length === 0) {
    configLines.push(`**Source Channels:** All channels`);
  } else {
    const channelMentions = board.sourceChannelIds.map(id => `<#${id}>`).join(', ');
    configLines.push(`**Source Channels:** ${channelMentions}`);
  }

  // Thresholds
  configLines.push(`**Min Reactions:** ${board.minReactions}`);
  if (board.removalThreshold > 0) {
    configLines.push(`**Removal Threshold:** ${board.removalThreshold}`);
  } else {
    configLines.push(`**Removal Threshold:** Never`);
  }
  configLines.push(`**Unfeatured Action:** ${board.unfeaturedAction === 'delete' ? 'Delete' : 'Edit to show removed'}`);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(configLines.join('\n'))
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Settings
  const settingsLines: string[] = [];
  settingsLines.push(`**Self React:** ${board.allowSelfReact ? 'Allowed' : 'Not allowed'}`);
  settingsLines.push(`**Sync Edits:** ${board.syncEdits ? 'Yes' : 'No'}`);
  settingsLines.push(`**Sync Deletes:** ${board.syncDeletes ? 'Yes' : 'No'}`);
  settingsLines.push(`**Auto React:** ${board.autoReact ? 'Yes' : 'No'}`);
  settingsLines.push(`**Embed Color:** ${formatColor(board.embedColor)}`);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(settingsLines.join('\n'))
  );

  // Excluded channels and locks
  const hasExcluded = board.excludedChannels && board.excludedChannels.length > 0;
  const hasLocks = board.lockSourceEnabled || board.lockDestinationEnabled;

  if (hasExcluded || hasLocks) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const advancedLines: string[] = [];
    if (hasExcluded) {
      advancedLines.push(`**Excluded Channels:** ${board.excludedChannels.length}`);
    }
    if (board.lockSourceEnabled) {
      const formats = board.lockSourceFormats?.join(', ') || 'None';
      advancedLines.push(`**Source Lock:** Enabled (${formats})`);
    }
    if (board.lockDestinationEnabled) {
      advancedLines.push(`**Destination Lock:** Bot-only`);
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(advancedLines.join('\n'))
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Action buttons row 1
  const editButton = new ButtonBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_btn_edit_${board.id}`)
    .setLabel('Edit')
    .setStyle(ButtonStyle.Primary);

  const reloadButton = new ButtonBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_btn_reload_${board.id}`)
    .setLabel('Reload')
    .setStyle(ButtonStyle.Secondary);

  const toggleButton = new ButtonBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_btn_toggle_${board.id}`)
    .setLabel(board.enabled ? 'Disable' : 'Enable')
    .setStyle(board.enabled ? ButtonStyle.Secondary : ButtonStyle.Success);

  const deleteButton = new ButtonBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_btn_delete_${board.id}`)
    .setLabel('Delete')
    .setStyle(ButtonStyle.Danger);

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(editButton, reloadButton, toggleButton, deleteButton)
  );

  // Navigation row
  const backButton = new ButtonBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_btn_back_${returnPage}`)
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
  );

  return createV2Response([container]);
}
