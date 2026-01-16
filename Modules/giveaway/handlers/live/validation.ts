/**
 * Shared Validation Utilities for Live Giveaway Handlers
 *
 * Provides common validation logic to reduce duplication across entry mode handlers.
 */

import { ButtonInteraction, ModalSubmitInteraction, GuildMember } from 'discord.js';
import { Giveaway } from '@bot/types/commandTypes';
import * as giveawayManager from '../../manager/giveawayManager';
import { DISCORD_EPHEMERAL_FLAG } from '@bot/constants';

/**
 * Result of giveaway validation
 */
export interface ValidationResult {
  valid: boolean;
  giveaway?: Giveaway;
  error?: string;
}

/**
 * Options for validation
 */
export interface ValidationOptions {
  /** Expected entry mode(s) for this handler */
  expectedModes?: Giveaway['entryMode'][];
  /** Check if user has already entered (for trivia/competition) */
  checkAlreadyEntered?: boolean;
  /** Check if competition is full */
  checkCompetitionFull?: boolean;
  /** Check trivia attempts */
  checkTriviaAttempts?: boolean;
}

/**
 * Validate a giveaway entry attempt
 * Returns validation result with giveaway data or error message
 */
export async function validateGiveawayEntry(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  customIdPrefix: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const giveawayId = giveawayManager.getSessionIdFromCustomId(interaction.customId, customIdPrefix);

  if (!giveawayId || !interaction.guildId) {
    return { valid: false, error: "Error identifying this giveaway." };
  }

  const giveaway = giveawayManager.getGiveaway(giveawayId, interaction.guildId);

  if (!giveaway) {
    return { valid: false, error: "This giveaway could not be found." };
  }

  // Check entry mode if specified
  if (options.expectedModes?.length && !options.expectedModes.includes(giveaway.entryMode)) {
    return { valid: false, error: `This giveaway does not use ${options.expectedModes.join('/')} entry.` };
  }

  // Check if giveaway is still active
  if (giveaway.ended || giveaway.cancelled || giveaway.endTime <= Date.now()) {
    return { valid: false, error: "This giveaway is no longer active." };
  }

  // Role requirement validation
  const member = interaction.member as GuildMember;

  if (giveaway.requiredRoles?.length) {
    const hasRequiredRole = giveaway.requiredRoles.some(roleId => member.roles.cache.has(roleId));
    if (!hasRequiredRole) {
      return { valid: false, error: "You don't have one of the required roles to enter this giveaway." };
    }
  }

  if (giveaway.blockedRoles?.length) {
    const hasBlockedRole = giveaway.blockedRoles.some(roleId => member.roles.cache.has(roleId));
    if (hasBlockedRole) {
      return { valid: false, error: "You have a role that is blocked from entering this giveaway." };
    }
  }

  // Check if competition is full
  if (options.checkCompetitionFull && giveaway.entryMode === 'competition') {
    const currentWinners = giveaway.competitionPlacements ? Object.keys(giveaway.competitionPlacements).length : 0;
    if (currentWinners >= giveaway.winnerCount) {
      return { valid: false, error: "This competition has already found all its winners!" };
    }
  }

  // Check if already won (competition)
  if (giveaway.entryMode === 'competition' && giveaway.competitionPlacements?.[interaction.user.id] !== undefined) {
    const placement = giveaway.competitionPlacements[interaction.user.id];
    return { valid: false, error: `You already placed ${getPlacementText(placement)} in this competition!` };
  }

  // Check if already entered (trivia - correct answer already given)
  if (options.checkAlreadyEntered && giveaway.entryMode === 'trivia') {
    if (giveaway.participants.includes(interaction.user.id)) {
      return { valid: false, error: "You have already successfully answered the trivia for this giveaway!" };
    }
  }

  // Check trivia attempts
  if (options.checkTriviaAttempts) {
    const attemptsMade = giveawayManager.getUserTriviaAttempts(giveaway.id, interaction.user.id, interaction.guildId);
    const maxAttempts = (giveaway.maxTriviaAttempts === undefined || giveaway.maxTriviaAttempts <= 0) ? -1 : giveaway.maxTriviaAttempts;

    if (maxAttempts !== -1 && attemptsMade >= maxAttempts) {
      return { valid: false, error: `You have no more attempts left. (Max: ${maxAttempts})` };
    }
  }

  return { valid: true, giveaway };
}

/**
 * Send an ephemeral error reply
 */
export async function replyWithError(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  message: string
): Promise<void> {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: message, flags: DISCORD_EPHEMERAL_FLAG });
  }
}

/**
 * Get placement text with medal emoji
 */
export function getPlacementText(placement: number): string {
  switch (placement) {
    case 0: return '🥇 1st';
    case 1: return '🥈 2nd';
    case 2: return '🥉 3rd';
    default: return `🎗️ ${placement + 1}th`;
  }
}

/**
 * Get placement emoji only
 */
export function getPlacementEmoji(placement: number): string {
  switch (placement) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return '🎗️';
  }
}
