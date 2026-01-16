/**
 * Validation utilities for the Giveaway module
 * This file provides centralized validation functions
 * for giveaway creation and management.
 */

import { PendingGiveawayData, StoredPendingGiveaway } from '../types';

/**
 * Validation errors that can occur during giveaway creation
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate basic giveaway fields
 */
export function validateBasicFields(data: PendingGiveawayData): ValidationError | null {
  if (!data.title || data.title === 'Untitled Giveaway') {
    return { field: 'title', message: 'Please set a title for the giveaway.' };
  }

  if (!data.prizes || data.prizes.length === 0 || !data.prizes[0]) {
    return { field: 'prize', message: 'Please set a prize description.' };
  }

  if (data.durationMs === undefined || data.durationMs <= 0) {
    return { field: 'duration', message: 'Please set a valid duration for the giveaway.' };
  }

  return null;
}

/**
 * Validate trivia mode specific fields
 */
export function validateTriviaMode(data: PendingGiveawayData): ValidationError | null {
  if (data.entryMode !== 'trivia') {
    return null;
  }

  if (!data.triviaQuestion) {
    return { field: 'triviaQuestion', message: 'For trivia mode, please set a trivia question.' };
  }

  if (!data.triviaAnswer) {
    return { field: 'triviaAnswer', message: 'For trivia mode, please set a trivia answer.' };
  }

  return null;
}

/**
 * Validate reaction mode specific fields
 */
export function validateReactionMode(data: PendingGiveawayData): ValidationError | null {
  if (data.entryMode !== 'reaction') {
    return null;
  }

  if (!data.reactionIdentifier) {
    return { field: 'reactionEmoji', message: 'For reaction mode, please set a reaction emoji.' };
  }

  return null;
}

/**
 * Validate all giveaway fields
 */
export function validateGiveawayData(data: PendingGiveawayData): ValidationError | null {
  // Check basic fields first
  const basicError = validateBasicFields(data);
  if (basicError) return basicError;

  // Check mode-specific fields
  const triviaError = validateTriviaMode(data);
  if (triviaError) return triviaError;

  const reactionError = validateReactionMode(data);
  if (reactionError) return reactionError;

  return null;
}

/**
 * Validate and parse duration string
 * @returns Duration in milliseconds, or null if invalid
 */
export function validateDuration(durationStr: string): number | null {
  // This function delegates to the existing parser,
  // but could be expanded with additional validation
  const parseDuration = require('../manager/giveawayManager').parseDuration;
  const durationMs = parseDuration(durationStr);

  if (durationMs === null || durationMs <= 0) {
    return null;
  }

  // Optional: Add max duration limit
  const MAX_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (durationMs > MAX_DURATION) {
    return null;
  }

  return durationMs;
}

/**
 * Validate trivia attempts input
 */
export function validateTriviaAttempts(attemptsStr: string): number | null {
  const attempts = parseInt(attemptsStr, 10);

  if (isNaN(attempts)) {
    return null;
  }

  // -1 or 0 means infinite, otherwise must be positive
  return attempts <= 0 ? -1 : attempts;
}

/**
 * Validate winner count input
 * @returns Winner count (>= 1), or null if invalid
 */
export function validateWinnerCount(countStr: string): number | null {
  const count = parseInt(countStr, 10);

  if (isNaN(count)) {
    return null;
  }

  // Must be at least 1
  if (count < 1) {
    return null;
  }

  return count;
}

/**
 * Get a user-friendly error message for validation errors
 */
export function getValidationMessage(error: ValidationError): string {
  return error.message;
}

/**
 * Build a complete validation error message for all errors
 */
export function buildValidationErrorMessage(errors: ValidationError[]): string {
  if (errors.length === 0) return '';

  if (errors.length === 1) {
    return getValidationMessage(errors[0]);
  }

  return 'Please fix the following issues:\n' +
    errors.map(e => `• ${e.message}`).join('\n');
}

/**
 * Check if a pending giveaway has all required fields to be started.
 * This is the single source of truth for giveaway readiness validation.
 */
export function isGiveawayReady(g: StoredPendingGiveaway | PendingGiveawayData | null): boolean {
  if (!g) return false;

  // Check that prizes array has at least one non-empty prize
  const hasPrize = g.prizes && g.prizes.length > 0 && g.prizes[0] && g.prizes[0].trim() !== '';

  return !!(
    g.title &&
    g.title !== 'Untitled Giveaway' &&
    hasPrize &&
    g.durationMs &&
    g.durationMs > 0 &&
    g.winnerCount &&
    g.winnerCount > 0 &&
    // Mode-specific requirements
    (g.entryMode !== 'trivia' || (g.triviaQuestion && g.triviaAnswer)) &&
    (g.entryMode !== 'reaction' || g.reactionDisplayEmoji)
  );
}