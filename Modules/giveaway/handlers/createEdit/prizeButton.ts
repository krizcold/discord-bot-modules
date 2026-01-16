/**
 * Prize Edit and Navigation Button Handlers
 * Handles prize editing and Prize Manager navigation
 */

import { ButtonInteraction, Client, MessageFlags } from 'discord.js';
import { parsePrizeEditButtonId, parsePrizeNavButtonId } from '../../constants';
import { getPendingGiveaway } from '../../state';
import { buildPrizeManagerResponse } from '../../panels/prizeManager';
import { PanelContext } from '@bot/types/panelTypes';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');
import { createSinglePrizeModal } from './prizeModal';

/**
 * Handle gw_prize_edit_{pendingId}_{prizeIndex} button clicks - show modal for single prize
 */
export async function handlePrizeEditButton(
  client: Client,
  interaction: ButtonInteraction
): Promise<void> {
  const parsed = parsePrizeEditButtonId(interaction.customId);
  if (!parsed) {
    logger.error('Failed to parse prize edit button ID:', interaction.customId);
    return;
  }

  const { pendingId, prizeIndex } = parsed;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const pending = getPendingGiveaway(guildId, pendingId);
  if (!pending) {
    await interaction.reply({ content: 'Giveaway not found. It may have been deleted.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Get current prize value if exists
  const currentValue = pending.prizes?.[prizeIndex];

  // Show modal for this prize
  const modal = createSinglePrizeModal(pendingId, prizeIndex, currentValue);
  await interaction.showModal(modal);
}

/**
 * Handle gw_prize_nav_{pendingId}_{direction}_{page} button clicks - navigate Prize Manager pages
 */
export async function handlePrizeNavButton(
  client: Client,
  interaction: ButtonInteraction
): Promise<void> {
  const parsed = parsePrizeNavButtonId(interaction.customId);
  if (!parsed) {
    logger.error('Failed to parse prize nav button ID:', interaction.customId);
    return;
  }

  const { pendingId, direction, page } = parsed;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const pending = getPendingGiveaway(guildId, pendingId);
  if (!pending) {
    await interaction.reply({ content: 'Giveaway not found. It may have been deleted.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Calculate new page
  const newPage = direction === 'prev' ? page - 1 : page + 1;

  // Build panel context for response
  const context: PanelContext = {
    client,
    interaction,
    panelId: 'giveaway',
    userId: interaction.user.id,
    guildId,
    accessMethod: 'direct_command',
    navigationStack: [],
  };

  const response = buildPrizeManagerResponse(context, pendingId, newPage);

  await interaction.deferUpdate();
  await interaction.editReply(response);
}
