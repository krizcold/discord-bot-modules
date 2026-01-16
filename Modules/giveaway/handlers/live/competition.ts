/**
 * Competition Entry Handler
 * Handles competition-based giveaway entry (entryMode: 'competition')
 *
 * First N correct answers win, with prizes awarded in order.
 * Features:
 * - Placement medals (🥇🥈🥉🎗️)
 * - Live leaderboard updates
 * - Auto-end when all winner slots filled
 */

import {
  Client,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import * as giveawayManager from '../../manager/giveawayManager';
import { GW_COMPETITION_ANSWER_MODAL_PREFIX } from '../../constants';
import { DISCORD_EPHEMERAL_FLAG } from '@bot/constants';
import { Giveaway } from '@bot/types/commandTypes';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');
import { validateGiveawayEntry, replyWithError, getPlacementText, getPlacementEmoji } from './validation';
import {
  buildGiveawayAnnouncementComponents,
  buildCompetitionLeaderboardText,
} from '../../utils/embedBuilder';
import { getConfigColor } from '../../utils/configUtils';

/**
 * Handle gw_competition_answer_btn_* button clicks - show competition answer modal
 */
export async function handleCompetitionAnswerButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  // Validate entry
  const validation = await validateGiveawayEntry(interaction, 'gw_competition_answer_btn', {
    expectedModes: ['competition'],
    checkCompetitionFull: true,
    checkTriviaAttempts: true,
  });

  if (!validation.valid || !validation.giveaway) {
    await replyWithError(interaction, validation.error || "Could not process entry.");
    return;
  }

  const giveaway = validation.giveaway;

  if (!giveaway.triviaQuestion) {
    await interaction.reply({ content: "This competition doesn't have a question set up correctly.", flags: DISCORD_EPHEMERAL_FLAG });
    return;
  }

  // Build modal title
  const maxTitleLen = 45 - 13; // "Competition: " = 13 chars
  const modalTitle = giveaway.title.length > maxTitleLen
    ? `Competition: ${giveaway.title.substring(0, maxTitleLen - 3)}...`
    : `Competition: ${giveaway.title}`;

  const modal = new ModalBuilder()
    .setCustomId(`${GW_COMPETITION_ANSWER_MODAL_PREFIX}_${giveaway.id}`)
    .setTitle(modalTitle);

  const answerInput = new TextInputBuilder()
    .setCustomId('competitionUserAnswer')
    .setLabel(giveaway.triviaQuestion.substring(0, 45))
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(answerInput));
  await interaction.showModal(modal);
}

/**
 * Handle competition modal submissions - validate answer and assign placement
 */
export async function handleCompetitionAnswerModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  // Validate entry
  const validation = await validateGiveawayEntry(interaction, GW_COMPETITION_ANSWER_MODAL_PREFIX, {
    expectedModes: ['competition'],
    checkCompetitionFull: true,
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

  const userAnswer = interaction.fields.getTextInputValue('competitionUserAnswer');
  const maxAttempts = (giveaway.maxTriviaAttempts === undefined || giveaway.maxTriviaAttempts <= 0) ? -1 : giveaway.maxTriviaAttempts;

  // Check answer (case-insensitive)
  if (userAnswer.toLowerCase() === giveaway.triviaAnswer.toLowerCase()) {
    // Correct! Assign placement
    await handleCorrectAnswer(client, interaction, giveaway);
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

/**
 * Handle a correct answer in competition mode
 */
async function handleCorrectAnswer(
  client: Client,
  interaction: ModalSubmitInteraction,
  giveaway: Giveaway
): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Calculate placement (0-indexed)
  const currentPlacements = giveaway.competitionPlacements || {};
  const placement = Object.keys(currentPlacements).length;

  // Update giveaway with new placement
  const newPlacements = { ...currentPlacements, [userId]: placement };
  giveawayManager.updateGiveaway(giveaway.id, { competitionPlacements: newPlacements }, guildId);

  // Also add to participants for consistency
  if (!giveaway.participants.includes(userId)) {
    giveawayManager.addParticipant(giveaway.id, userId, guildId);
  }

  // Send placement message to user
  const placementText = getPlacementText(placement);
  const prize = giveaway.prizes[placement];
  let replyContent = `${getPlacementEmoji(placement)} **Congratulations!** You placed **${placementText}** in the competition!`;
  if (prize) {
    replyContent += `\n\nYour prize will be revealed when the competition ends.`;
  }

  await interaction.reply({ content: replyContent, flags: DISCORD_EPHEMERAL_FLAG });

  // Update live leaderboard if enabled
  const updatedGiveaway = giveawayManager.getGiveaway(giveaway.id, guildId);
  if (updatedGiveaway && updatedGiveaway.liveLeaderboard !== false) {
    await updateLeaderboard(client, updatedGiveaway);
  }

  // Check if all winner slots are filled - auto-end
  const totalPlacements = Object.keys(newPlacements).length;
  if (totalPlacements >= giveaway.winnerCount) {
    logger.info(`Competition ${giveaway.id} has all ${giveaway.winnerCount} winners, auto-ending...`);
    // Use the ending processor to properly end the giveaway
    const { processEndedGiveaway } = await import('../../manager/scheduling/ending');
    await processEndedGiveaway(client, giveaway.id, guildId);
  }
}

/**
 * Update the live leaderboard on the giveaway announcement message (V2)
 * Rebuilds the entire V2 container with updated leaderboard
 */
async function updateLeaderboard(client: Client, giveaway: Giveaway): Promise<void> {
  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!channel || !('messages' in channel)) return;

    const message = await channel.messages.fetch(giveaway.messageId);
    if (!message) return;

    const guildId = giveaway.guildId;
    const placements = giveaway.competitionPlacements || {};

    // Rebuild the V2 container with updated leaderboard
    const container = new ContainerBuilder()
      .setAccentColor(getConfigColor('activeGiveaway', guildId));

    // Title
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## 🎉 ${giveaway.title} 🎉`)
    );

    // Description for competition mode
    let description = 'A new giveaway has started!';
    description += `\n🏆 **Competition Mode** - First ${giveaway.winnerCount} correct answers win!`;
    if (giveaway.maxTriviaAttempts && giveaway.maxTriviaAttempts > 0) {
      description += ` *You have ${giveaway.maxTriviaAttempts} attempt(s).*`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(description)
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Ends In
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Ends:** <t:${Math.floor(giveaway.endTime / 1000)}:R>`)
    );

    // Competition question
    if (giveaway.triviaQuestion) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Competition Question:**\n${giveaway.triviaQuestion}`)
      );
    }

    // Live leaderboard with updated placements
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(buildCompetitionLeaderboardText(placements))
    );

    // Footer (need to fetch creator for tag - use generic footer)
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Competition in progress`)
    );

    // Get action row with entry button
    const actionRows = buildGiveawayAnnouncementComponents(giveaway, guildId);

    await message.edit({
      content: '',
      embeds: [],
      components: actionRows.length > 0 ? [container, ...actionRows] : [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    logger.error(`Failed to update competition leaderboard for ${giveaway.id}:`, error);
  }
}
