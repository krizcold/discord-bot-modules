/**
 * Trivia Entry Handler
 * Handles trivia-based giveaway entry (entryMode: 'trivia')
 *
 * Users answer a question to enter the giveaway pool.
 * Winners are selected randomly from correct answerers when giveaway ends.
 */

import {
  Client,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import * as giveawayManager from '../../manager/giveawayManager';
import { GW_TRIVIA_ANSWER_MODAL_PREFIX } from '../../constants';
import { DISCORD_EPHEMERAL_FLAG } from '@bot/constants';
import { validateGiveawayEntry, replyWithError } from './validation';

/**
 * Handle gw_trivia_answer_btn_* button clicks - show trivia answer modal
 */
export async function handleTriviaAnswerButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  // Validate entry
  const validation = await validateGiveawayEntry(interaction, 'gw_trivia_answer_btn', {
    expectedModes: ['trivia'],
    checkAlreadyEntered: true,
    checkTriviaAttempts: true,
  });

  if (!validation.valid || !validation.giveaway) {
    await replyWithError(interaction, validation.error || "Could not process entry.");
    return;
  }

  const giveaway = validation.giveaway;

  if (!giveaway.triviaQuestion) {
    await interaction.reply({ content: "This giveaway doesn't have a question set up correctly.", flags: DISCORD_EPHEMERAL_FLAG });
    return;
  }

  // Build modal title
  const maxTitleLen = 45 - 8; // "Trivia: " = 8 chars
  const modalTitle = giveaway.title.length > maxTitleLen
    ? `Trivia: ${giveaway.title.substring(0, maxTitleLen - 3)}...`
    : `Trivia: ${giveaway.title}`;

  const modal = new ModalBuilder()
    .setCustomId(`${GW_TRIVIA_ANSWER_MODAL_PREFIX}_${giveaway.id}`)
    .setTitle(modalTitle);

  const answerInput = new TextInputBuilder()
    .setCustomId('triviaUserAnswer')
    .setLabel(giveaway.triviaQuestion.substring(0, 45))
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(answerInput));
  await interaction.showModal(modal);
}

/**
 * Handle trivia modal submissions - validate answer
 */
export async function handleTriviaAnswerModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  // Validate entry
  const validation = await validateGiveawayEntry(interaction, GW_TRIVIA_ANSWER_MODAL_PREFIX, {
    expectedModes: ['trivia'],
    checkAlreadyEntered: true,
  });

  if (!validation.valid || !validation.giveaway) {
    await replyWithError(interaction, validation.error || "Could not process answer.");
    return;
  }

  const giveaway = validation.giveaway;

  if (!giveaway.triviaAnswer) {
    await replyWithError(interaction, "The answer is not set. Please contact an admin.");
    return;
  }

  const userAnswer = interaction.fields.getTextInputValue('triviaUserAnswer');
  const maxAttempts = (giveaway.maxTriviaAttempts === undefined || giveaway.maxTriviaAttempts <= 0) ? -1 : giveaway.maxTriviaAttempts;

  // Check answer (case-insensitive)
  if (userAnswer.toLowerCase() === giveaway.triviaAnswer.toLowerCase()) {
    // Correct! Add as participant
    giveawayManager.addParticipant(giveaway.id, interaction.user.id, interaction.guildId!);
    await interaction.reply({ content: "Correct! You've entered the giveaway. 🎉", flags: DISCORD_EPHEMERAL_FLAG });
  } else {
    // Wrong answer - increment attempts
    const attemptsMadeAfterThis = giveawayManager.incrementUserTriviaAttempts(giveaway.id, interaction.user.id, interaction.guildId!);

    let replyContent = "Sorry, that's not the right answer. ";
    if (maxAttempts !== -1) {
      const attemptsLeft = maxAttempts - attemptsMadeAfterThis;
      if (attemptsLeft > 0) {
        replyContent += `You have **${attemptsLeft}** attempt(s) left.`;
      } else {
        replyContent += `You have no more attempts left.`;
      }
    } else {
      replyContent += "Try again!";
    }

    await interaction.reply({ content: replyContent, flags: DISCORD_EPHEMERAL_FLAG });
  }
}
