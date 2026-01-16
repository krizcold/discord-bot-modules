/**
 * Edit Button Handler
 * Shows appropriate modal for giveaway editing
 */

import { ButtonInteraction, Client, MessageFlags } from 'discord.js';
import {
  parseEditButtonId,
  MODAL_TITLE,
  MODAL_PRIZE,
  MODAL_DURATION,
  MODAL_WINNERS,
  MODAL_REACTION,
  MODAL_TRIVIA_QA,
  MODAL_TRIVIA_ATTEMPTS,
} from '../../constants';
import { getPendingGiveaway } from '../../state';
import {
  createTitleModal,
  createPrizeModal,
  createDurationModal,
  createWinnersModal,
  createReactionModal,
  createTriviaQAModal,
  createTriviaAttemptsModal,
} from '../../utils/modalFactory';
import { formatDurationDisplay } from '../../utils/displayFormatters';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/**
 * Handle gw_edit_* button clicks - show the appropriate modal
 */
export async function handleEditButton(
  client: Client,
  interaction: ButtonInteraction
): Promise<void> {
  const parsed = parseEditButtonId(interaction.customId);
  if (!parsed) {
    logger.error('Failed to parse edit button ID:', interaction.customId);
    return;
  }

  const { pendingId, modalType } = parsed;
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

  // Show the appropriate modal based on type
  try {
    switch (modalType) {
      case MODAL_TITLE:
        await interaction.showModal(createTitleModal(pendingId, pending.title));
        break;
      case MODAL_PRIZE:
        await interaction.showModal(createPrizeModal(pendingId, pending.prizes?.[0]));
        break;
      case MODAL_DURATION:
        await interaction.showModal(createDurationModal(pendingId, formatDurationDisplay(pending.durationMs)));
        break;
      case MODAL_WINNERS:
        await interaction.showModal(createWinnersModal(pendingId, pending.winnerCount));
        break;
      case MODAL_REACTION:
        await interaction.showModal(createReactionModal(pendingId, pending.reactionEmojiInput || pending.reactionDisplayEmoji));
        break;
      case MODAL_TRIVIA_QA:
        await interaction.showModal(createTriviaQAModal(pendingId, pending.triviaQuestion, pending.triviaAnswer));
        break;
      case MODAL_TRIVIA_ATTEMPTS:
        await interaction.showModal(createTriviaAttemptsModal(pendingId, pending.maxTriviaAttempts));
        break;
      default:
        logger.error('Unknown modal type:', modalType);
        await interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    logger.error('Error showing modal:', error);
  }
}
