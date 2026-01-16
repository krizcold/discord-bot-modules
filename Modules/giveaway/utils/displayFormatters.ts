/**
 * Shared display formatting utilities for the giveaway module
 * Centralizes common formatting logic to reduce duplication
 */

import { Giveaway } from '@bot/types/commandTypes';
import { StoredPendingGiveaway, GiveawayDisplayStatus } from '../types';
import { STATUS_EMOJI } from '../constants';

// ============================================================================
// Value Formatters
// ============================================================================

/**
 * Format a value in code block style with fallback placeholder
 */
export function formatCodeValue(value: string | number | undefined | null, placeholder = 'Not Set'): string {
  if (value === undefined || value === null || value === '') {
    return `\`${placeholder}\``;
  }
  return `\`${value}\``;
}

/**
 * Get display text for entry mode
 */
export function getModeDisplay(entryMode: 'button' | 'reaction' | 'trivia' | 'competition' | undefined): string {
  switch (entryMode) {
    case 'button':
      return '\uD83D\uDD18 Button';
    case 'reaction':
      return '\uD83D\uDE00 Reaction';
    case 'trivia':
      return '\u2753 Trivia';
    case 'competition':
      return '\uD83C\uDFC6 Competition';
    default:
      return '\uD83D\uDD18 Button';
  }
}

/**
 * Get prize display text (CONFIDENTIAL - never show actual prize!)
 */
export function getPrizeDisplay(prizes: string[], winnerCount: number): string {
  const configuredCount = prizes.filter(p => p && p.trim()).length;

  // Multi-prize mode (2+ winners)
  if (winnerCount > 1) {
    if (configuredCount === 0) {
      return `\u274C 0/${winnerCount} prizes`;
    }
    if (configuredCount === winnerCount) {
      return `\u2705 ${configuredCount}/${winnerCount} prizes`;
    }
    return `\u26A0\uFE0F ${configuredCount}/${winnerCount} prizes`;
  }

  // Single prize mode (1 winner)
  const singlePrize = prizes[0];
  if (!singlePrize || singlePrize.trim() === '') {
    return '\u274C Not Set';
  }
  return '\u2705 Prize configured';
}

/**
 * Format duration in human-readable form
 */
export function formatDurationDisplay(durationMs: number | undefined): string {
  if (!durationMs) return 'Not Set';

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (parts.length === 0 && seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ') || 'Not Set';
}

/**
 * Format max trivia attempts display
 */
export function formatTriviaAttempts(attempts: number | undefined): string {
  if (attempts === undefined || attempts === -1 || attempts <= 0) {
    return 'Unlimited';
  }
  return String(attempts);
}

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * Get status emoji for a giveaway
 */
export function getStatusEmoji(giveaway: Giveaway): string {
  if (giveaway.cancelled) return STATUS_EMOJI.cancelled;
  if (giveaway.ended) return STATUS_EMOJI.ended;
  if (giveaway.endTime > Date.now()) return STATUS_EMOJI.active;
  return STATUS_EMOJI.active; // Processing
}

/**
 * Get status emoji for a pending giveaway
 */
export function getPendingStatusEmoji(pending: StoredPendingGiveaway): string {
  return pending.status === 'ready' ? STATUS_EMOJI.pending : STATUS_EMOJI.draft;
}

/**
 * Get display status from giveaway
 */
export function getDisplayStatus(giveaway: Giveaway): GiveawayDisplayStatus {
  if (giveaway.cancelled) return 'cancelled';
  if (giveaway.ended) return 'ended';
  return 'active';
}

/**
 * Get status text with timestamp
 */
export function getStatusText(giveaway: Giveaway): string {
  const endTimestamp = Math.floor(giveaway.endTime / 1000);

  if (giveaway.cancelled) {
    return `${STATUS_EMOJI.cancelled} Cancelled`;
  }
  if (giveaway.ended) {
    return `${STATUS_EMOJI.ended} Ended <t:${endTimestamp}:R>`;
  }
  if (giveaway.endTime > Date.now()) {
    return `${STATUS_EMOJI.active} Ends <t:${endTimestamp}:R>`;
  }
  return `\u231B Processing...`;
}

// ============================================================================
// Timestamp Helpers
// ============================================================================

/**
 * Format Unix timestamp for Discord
 */
export function formatDiscordTimestamp(ms: number, style: 'R' | 'F' | 'f' | 'D' | 'd' | 'T' | 't' = 'R'): string {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

/**
 * Get relative time string
 */
export function getRelativeTime(ms: number): string {
  return formatDiscordTimestamp(ms, 'R');
}

/**
 * Get full datetime string (without day of week)
 */
export function getFullDateTime(ms: number): string {
  return formatDiscordTimestamp(ms, 'f');
}
