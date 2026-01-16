/**
 * Edit Modal Submit Handler
 * Processes modal submissions and updates panel
 */

import { ModalSubmitInteraction, Client, MessageFlags } from 'discord.js';
import {
  parseGwModalId,
  MODAL_TITLE,
  MODAL_PRIZE,
  MODAL_DURATION,
  MODAL_WINNERS,
  MODAL_REACTION,
  MODAL_TRIVIA_QA,
  MODAL_TRIVIA_ATTEMPTS,
} from '../../constants';
import { getPendingGiveaway, updatePendingGiveaway } from '../../state';
import { parseEmoji, resolveEmojisInText } from '@internal/utils/emojiHandler';
import { buildCreatePanelResponse } from '../../panels/create';
import { PanelContext } from '@bot/types/panelTypes';
import * as giveawayManager from '../../manager/giveawayManager';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');
import { handlePrizeModalSubmit } from './prizeModal';

/**
 * Handle gw_modal_* submissions - process the modal data and update panel
 */
export async function handleEditModalSubmit(
  client: Client,
  interaction: ModalSubmitInteraction
): Promise<void> {
  const parsed = parseGwModalId(interaction.customId);
  if (!parsed) {
    logger.error('Failed to parse modal ID:', interaction.customId);
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

  // Check if this is a prize edit modal from Prize Manager (format: prize_{index})
  if (modalType.startsWith('prize_')) {
    const prizeIndex = parseInt(modalType.slice(6), 10);
    if (!isNaN(prizeIndex)) {
      await handlePrizeModalSubmit(client, interaction, pendingId, prizeIndex);
      return;
    }
  }

  // Track any non-fatal errors to show as follow-up
  let validationWarning: string | null = null;

  // Process modal data based on type
  try {
    switch (modalType) {
      case MODAL_TITLE: {
        const title = interaction.fields.getTextInputValue('title')?.trim();
        if (title) updatePendingGiveaway(guildId, pendingId, { title });
        break;
      }
      case MODAL_PRIZE: {
        let prize = interaction.fields.getTextInputValue('prize')?.trim();
        if (prize) {
          // Resolve emoji shortcodes in prize text
          prize = resolveEmojisInText(prize, client, interaction.guild);
          // Always store in prizes array for consistency (prizes[0] for single winner)
          const prizes = [...(pending.prizes || [])];
          prizes[0] = prize;
          updatePendingGiveaway(guildId, pendingId, { prizes });
        }
        break;
      }
      case MODAL_DURATION: {
        const durationStr = interaction.fields.getTextInputValue('duration')?.trim();
        if (durationStr) {
          const durationMs = giveawayManager.parseDuration(durationStr);
          if (durationMs && durationMs > 0) {
            updatePendingGiveaway(guildId, pendingId, { durationMs });
          }
        }
        break;
      }
      case MODAL_WINNERS: {
        const winnersStr = interaction.fields.getTextInputValue('winners')?.trim();
        if (winnersStr) {
          const winnerCount = parseInt(winnersStr, 10);
          if (!isNaN(winnerCount) && winnerCount > 0 && winnerCount <= 100) {
            updatePendingGiveaway(guildId, pendingId, { winnerCount });
          }
        }
        break;
      }
      case MODAL_REACTION: {
        const emojiInput = interaction.fields.getTextInputValue('emoji')?.trim();
        if (emojiInput) {
          // Get guild for emoji lookup
          const guild = interaction.guild;

          // Use the emoji parser utility to handle all formats:
          // - Unicode emoji: 🎉
          // - Full custom: <:name:id>
          // - Name with colons: :myEmoji:
          // - Just name: myEmoji
          // - Name with ID: myEmoji:123456 or :myEmoji:123456
          const result = parseEmoji(emojiInput, client, guild);

          if (result.success && result.identifier && result.displayEmoji) {
            updatePendingGiveaway(guildId, pendingId, {
              reactionIdentifier: result.identifier,
              reactionDisplayEmoji: result.displayEmoji,
              reactionEmojiInput: emojiInput, // Save raw input for editing
            });
          } else {
            // Show error to user as follow-up message
            validationWarning = `⚠️ Could not parse emoji: ${result.errorMessage || 'Invalid emoji format'}`;
            logger.warn('Emoji parse failed:', result.errorMessage);
          }
        }
        break;
      }
      case MODAL_TRIVIA_QA: {
        const question = interaction.fields.getTextInputValue('question')?.trim();
        const answer = interaction.fields.getTextInputValue('answer')?.trim();
        if (question && answer) {
          updatePendingGiveaway(guildId, pendingId, { triviaQuestion: question, triviaAnswer: answer });
        }
        break;
      }
      case MODAL_TRIVIA_ATTEMPTS: {
        const attemptsStr = interaction.fields.getTextInputValue('attempts')?.trim();
        if (attemptsStr) {
          const attempts = parseInt(attemptsStr, 10);
          const maxTriviaAttempts = isNaN(attempts) || attempts <= 0 ? -1 : attempts;
          updatePendingGiveaway(guildId, pendingId, { maxTriviaAttempts });
        }
        break;
      }
      default:
        logger.error('Unknown modal type:', modalType);
    }

    // Get updated pending and build response
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

    const response = buildCreatePanelResponse(context, updatedPending);

    // Update the message with new panel state
    // Modal from message component has update method, but need to defer first
    await interaction.deferUpdate();
    await interaction.editReply(response);

    // Show validation warning as follow-up if there was one
    if (validationWarning) {
      await interaction.followUp({ content: validationWarning, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    logger.error('Error processing modal:', error);
    try {
      await interaction.reply({ content: 'An error occurred while processing your input.', flags: MessageFlags.Ephemeral });
    } catch {
      // Interaction may have already been handled
    }
  }
}
