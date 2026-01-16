/**
 * Prize Results Navigation Handlers
 * Navigation for Prize Results panel (active/ended giveaways)
 */

import { ButtonInteraction, Client, MessageFlags } from 'discord.js';
import { parsePrizeResultsNavButtonId, parsePrizeResultsBackButtonId } from '../../constants';
import { buildPrizeResultsResponse } from '../../panels/prizeManager';
import { buildDetailPanelResponse } from '../../panels/detail';
import { PanelContext } from '@bot/types/panelTypes';
import * as giveawayManager from '../../manager/giveawayManager';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/**
 * Handle gw_prize_results_nav_{giveawayId}_{direction}_{page} button clicks
 * Navigate Prize Results pages for active/ended giveaways
 */
export async function handlePrizeResultsNavButton(
  client: Client,
  interaction: ButtonInteraction
): Promise<void> {
  const parsed = parsePrizeResultsNavButtonId(interaction.customId);
  if (!parsed) {
    logger.error('Failed to parse prize results nav button ID:', interaction.customId);
    return;
  }

  const { giveawayId, direction, page } = parsed;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const giveaway = giveawayManager.getGiveaway(giveawayId, guildId);
  if (!giveaway) {
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

  const response = buildPrizeResultsResponse(context, giveawayId, newPage, 0);

  await interaction.deferUpdate();
  await interaction.editReply(response);
}

/**
 * Handle gw_prize_results_back_{giveawayId}_{returnPage} button clicks
 * Return to detail panel from Prize Results
 */
export async function handlePrizeResultsBackButton(
  client: Client,
  interaction: ButtonInteraction
): Promise<void> {
  const parsed = parsePrizeResultsBackButtonId(interaction.customId);
  if (!parsed) {
    logger.error('Failed to parse prize results back button ID:', interaction.customId);
    return;
  }

  const { giveawayId, returnPage } = parsed;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const giveaway = giveawayManager.getGiveaway(giveawayId, guildId);
  if (!giveaway) {
    await interaction.reply({ content: 'Giveaway not found. It may have been deleted.', flags: MessageFlags.Ephemeral });
    return;
  }

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

  const response = buildDetailPanelResponse(context, giveaway, returnPage);

  await interaction.deferUpdate();
  await interaction.editReply(response);
}
