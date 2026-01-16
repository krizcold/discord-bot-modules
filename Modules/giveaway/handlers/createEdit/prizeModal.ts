/**
 * Prize Modal Handlers
 * Modal creation and submission for multi-prize system
 */

import {
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  Client,
  MessageFlags,
} from 'discord.js';
import { buildGwModalId } from '../../constants';
import { getPendingGiveaway, updatePendingGiveaway } from '../../state';
import { buildPrizeManagerResponse } from '../../panels/prizeManager';
import { PanelContext } from '@bot/types/panelTypes';
import { resolveEmojisInText } from '@internal/utils/emojiHandler';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/**
 * Create a modal for editing a single prize in a multi-prize giveaway
 */
export function createSinglePrizeModal(pendingId: string, prizeIndex: number, currentValue?: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(buildGwModalId(pendingId, `prize_${prizeIndex}`))
    .setTitle(`Set Prize #${prizeIndex + 1}`);

  const input = new TextInputBuilder()
    .setCustomId('prize')
    .setLabel('Prize (will be hidden with spoiler)')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(true)
    .setPlaceholder('e.g., Steam Key: XXXXX-XXXXX-XXXXX');

  if (currentValue) {
    input.setValue(currentValue);
  }

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

/**
 * Handle prize modal submissions from Prize Manager
 * Modal format: gw_modal_prize_{prizeIndex}_{pendingId}
 */
export async function handlePrizeModalSubmit(
  client: Client,
  interaction: ModalSubmitInteraction,
  pendingId: string,
  prizeIndex: number
): Promise<void> {
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

  try {
    let prize = interaction.fields.getTextInputValue('prize')?.trim();

    if (prize) {
      // Resolve emoji shortcodes in prize text
      prize = resolveEmojisInText(prize, client, interaction.guild);

      // Initialize prizes array if needed, preserving existing values
      const prizes = [...(pending.prizes || [])];

      // Ensure array is large enough
      while (prizes.length <= prizeIndex) {
        prizes.push('');
      }

      prizes[prizeIndex] = prize;

      updatePendingGiveaway(guildId, pendingId, { prizes });
    }

    // Get updated pending and build Prize Manager response
    const updatedPending = getPendingGiveaway(guildId, pendingId);
    if (!updatedPending) {
      await interaction.reply({ content: 'Giveaway not found after update.', flags: MessageFlags.Ephemeral });
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

    // Calculate which page the edited prize is on (5 per page)
    const page = Math.floor(prizeIndex / 5);
    const response = buildPrizeManagerResponse(context, pendingId, page);

    await interaction.deferUpdate();
    await interaction.editReply(response);
  } catch (error) {
    logger.error('Error processing prize modal:', error);
    try {
      await interaction.reply({ content: 'An error occurred while processing your input.', flags: MessageFlags.Ephemeral });
    } catch {
      // Interaction may have already been handled
    }
  }
}
