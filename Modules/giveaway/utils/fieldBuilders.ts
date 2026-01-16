/**
 * Shared embed field builders for the giveaway module
 * Centralizes field creation to reduce duplication across panels
 */

import { Giveaway } from '@bot/types/commandTypes';
import { StoredPendingGiveaway } from '../types';
import {
  formatCodeValue,
  getModeDisplay,
  getPrizeDisplay,
  formatDurationDisplay,
  formatTriviaAttempts,
  getStatusText,
  formatDiscordTimestamp,
} from './displayFormatters';

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

// ============================================================================
// Common Fields
// ============================================================================

/**
 * Build title field
 */
export function buildTitleField(title: string | undefined, inline = false): EmbedField {
  return {
    name: '\uD83E\uDDFE Title',
    value: formatCodeValue(title, 'Untitled Giveaway'),
    inline,
  };
}

/**
 * Build prize field (CONFIDENTIAL - never shows actual prize!)
 */
export function buildPrizeField(prizes: string[], winnerCount: number, inline = false): EmbedField {
  return {
    name: '\uD83C\uDF81 Prize',
    value: getPrizeDisplay(prizes, winnerCount),
    inline,
  };
}

/**
 * Build prize field from a pending giveaway
 */
export function buildPrizeFieldFromPending(pending: StoredPendingGiveaway, inline = false): EmbedField {
  return buildPrizeField(pending.prizes || [], pending.winnerCount || 1, inline);
}

/**
 * Build duration field
 */
export function buildDurationField(durationMs: number | undefined, inline = true): EmbedField {
  return {
    name: '\u23F1\uFE0F Duration',
    value: formatCodeValue(formatDurationDisplay(durationMs)),
    inline,
  };
}

/**
 * Build winner count field
 */
export function buildWinnersField(winnerCount: number | undefined, inline = true): EmbedField {
  return {
    name: '\uD83C\uDFC6 Winners',
    value: formatCodeValue(winnerCount || 1),
    inline,
  };
}

/**
 * Build entry mode field
 */
export function buildModeField(entryMode: 'button' | 'reaction' | 'trivia' | 'competition' | undefined, inline = true): EmbedField {
  return {
    name: '\uD83D\uDD04 Entry Mode',
    value: formatCodeValue(getModeDisplay(entryMode)),
    inline,
  };
}

/**
 * Build participants field
 */
export function buildParticipantsField(count: number, inline = true): EmbedField {
  return {
    name: '\uD83D\uDC65 Participants',
    value: formatCodeValue(count),
    inline,
  };
}

/**
 * Build winners target field
 */
export function buildWinnersTargetField(winnerCount: number, inline = true): EmbedField {
  return {
    name: '\uD83C\uDFC6 Winners Target',
    value: formatCodeValue(winnerCount),
    inline,
  };
}

// ============================================================================
// Mode-Specific Fields
// ============================================================================

/**
 * Build reaction emoji field
 */
export function buildReactionEmojiField(emoji: string | undefined, inline = true): EmbedField | null {
  if (!emoji) return null;
  return {
    name: '\uD83D\uDE00 Reaction Emoji',
    value: emoji,
    inline,
  };
}

/**
 * Build trivia question field
 */
export function buildTriviaQuestionField(question: string | undefined, inline = false): EmbedField | null {
  if (!question) return null;
  return {
    name: '\u2753 Trivia Question',
    value: formatCodeValue(question, 'Not set'),
    inline,
  };
}

/**
 * Build trivia answer field (only show if ended)
 */
export function buildTriviaAnswerField(answer: string | undefined, inline = true): EmbedField | null {
  if (!answer) return null;
  return {
    name: '\u2705 Trivia Answer',
    value: formatCodeValue(answer, 'Not set'),
    inline,
  };
}

/**
 * Build max attempts field
 */
export function buildMaxAttemptsField(attempts: number | undefined, inline = true): EmbedField | null {
  if (attempts === undefined || attempts === -1 || attempts <= 0) return null;
  return {
    name: '\uD83D\uDD22 Max Attempts',
    value: formatCodeValue(attempts),
    inline,
  };
}

// ============================================================================
// Status & Time Fields
// ============================================================================

/**
 * Build status field for active giveaway
 */
export function buildStatusField(giveaway: Giveaway, inline = false): EmbedField {
  return {
    name: '\uD83D\uDCC5 Status',
    value: getStatusText(giveaway),
    inline,
  };
}

/**
 * Build start time field
 */
export function buildStartTimeField(startTime: number, inline = true): EmbedField {
  return {
    name: '\uD83D\uDE80 Started',
    value: formatDiscordTimestamp(startTime, 'f'), // 'f' = long date without day of week
    inline,
  };
}

/**
 * Build end time field
 */
export function buildEndTimeField(endTime: number, inline = true): EmbedField {
  return {
    name: '\uD83C\uDFC1 End Time',
    value: formatDiscordTimestamp(endTime, 'f'), // 'f' = long date without day of week
    inline,
  };
}

/**
 * Build target channel field
 */
export function buildChannelField(channelId: string, inline = false): EmbedField {
  return {
    name: '\uD83D\uDCCD Target Channel',
    value: `<#${channelId}>`,
    inline,
  };
}

/**
 * Build winners display field (for ended giveaways)
 */
export function buildWinnersDisplayField(giveaway: Giveaway, inline = false): EmbedField {
  let winnersDisplay: string;
  if (giveaway.cancelled) {
    winnersDisplay = 'Cancelled - no winners';
  } else if (giveaway.winners.length === 0) {
    winnersDisplay = 'No winners selected';
  } else {
    winnersDisplay = giveaway.winners.map(id => `<@${id}>`).join(', ');
  }
  return {
    name: '\uD83C\uDFC6 Winners',
    value: winnersDisplay,
    inline,
  };
}

// ============================================================================
// Composite Field Builders
// ============================================================================

/**
 * Build all mode-specific fields for a giveaway
 */
export function buildModeSpecificFields(
  data: Giveaway | StoredPendingGiveaway,
  options: { showAnswer?: boolean; inline?: boolean } = {}
): EmbedField[] {
  const fields: EmbedField[] = [];
  const entryMode = data.entryMode;
  const inline = options.inline ?? true; // Default to true for backward compatibility

  if (entryMode === 'reaction') {
    const emojiField = buildReactionEmojiField(data.reactionDisplayEmoji, inline);
    if (emojiField) fields.push(emojiField);
  }

  if (entryMode === 'trivia' || entryMode === 'competition') {
    const questionField = buildTriviaQuestionField(data.triviaQuestion, inline);
    if (questionField) fields.push(questionField);

    if (options.showAnswer && 'triviaAnswer' in data) {
      const answerField = buildTriviaAnswerField(data.triviaAnswer, inline);
      if (answerField) fields.push(answerField);
    }

    const attemptsField = buildMaxAttemptsField(data.maxTriviaAttempts, inline);
    if (attemptsField) fields.push(attemptsField);
  }

  return fields;
}

/**
 * Build standard preview fields for pending giveaway
 */
export function buildPendingPreviewFields(pending: StoredPendingGiveaway): EmbedField[] {
  const fields: EmbedField[] = [
    buildTitleField(pending.title),
    buildPrizeField(pending.prizes || [], pending.winnerCount || 1, true),
    buildDurationField(pending.durationMs),
    buildWinnersField(pending.winnerCount),
    buildModeField(pending.entryMode),
  ];

  // Add mode-specific fields
  fields.push(...buildModeSpecificFields(pending));

  return fields;
}

/**
 * Build standard detail fields for active/ended giveaway
 */
export function buildGiveawayDetailFields(giveaway: Giveaway): EmbedField[] {
  const fields: EmbedField[] = [
    buildPrizeField(giveaway.prizes, giveaway.winnerCount, true),
    buildParticipantsField(giveaway.participants.length),
    buildWinnersTargetField(giveaway.winnerCount),
    buildModeField(giveaway.entryMode),
  ];

  // Add mode-specific fields
  fields.push(...buildModeSpecificFields(giveaway, { showAnswer: giveaway.ended }));

  // Add status and time fields
  fields.push(buildStatusField(giveaway));
  fields.push(buildStartTimeField(giveaway.startTime));
  fields.push(buildEndTimeField(giveaway.endTime));

  // Add winners if ended
  if (giveaway.ended) {
    fields.push(buildWinnersDisplayField(giveaway));
  }

  return fields;
}
