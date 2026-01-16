/**
 * Hall of Fame Validation Utilities
 */

import { Board } from '../types';
import { isEmojiAvailable, loadBoards } from '../manager/data/crud';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a board configuration
 */
export function validateBoard(board: Partial<Board>, guildId: string, excludeBoardId?: string): ValidationResult {
  const errors: string[] = [];

  // Name validation
  if (!board.name || board.name.trim().length === 0) {
    errors.push('Board name is required.');
  } else if (board.name.length > 50) {
    errors.push('Board name must be 50 characters or less.');
  }

  // Emoji validation
  if (!board.emojiIdentifier || board.emojiIdentifier.trim().length === 0) {
    errors.push('Emoji is required.');
  } else if (!isEmojiAvailable(guildId, board.emojiIdentifier, excludeBoardId)) {
    errors.push('This emoji is already used by another active board.');
  }

  // Destination channel validation
  if (!board.destinationChannelId || board.destinationChannelId.trim().length === 0) {
    errors.push('Destination channel is required.');
  }

  // Threshold validation
  if (board.minReactions !== undefined) {
    if (board.minReactions < 1) {
      errors.push('Minimum reactions must be at least 1.');
    } else if (board.minReactions > 100) {
      errors.push('Minimum reactions must be 100 or less.');
    }
  }

  if (board.removalThreshold !== undefined) {
    if (board.removalThreshold < 0) {
      errors.push('Removal threshold cannot be negative.');
    } else if (board.minReactions !== undefined && board.removalThreshold >= board.minReactions) {
      errors.push('Removal threshold must be less than minimum reactions.');
    }
  }

  // Embed color validation
  if (board.embedColor !== undefined) {
    if (board.embedColor < 0 || board.embedColor > 0xFFFFFF) {
      errors.push('Invalid embed color.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a board is ready to be enabled
 */
export function isBoardReady(board: Partial<Board>): boolean {
  return !!(
    board.name &&
    board.name.trim().length > 0 &&
    board.emojiIdentifier &&
    board.emojiIdentifier.trim().length > 0 &&
    board.destinationChannelId &&
    board.destinationChannelId.trim().length > 0 &&
    board.minReactions !== undefined &&
    board.minReactions >= 1
  );
}

/**
 * Parse a color string to number
 * Accepts: "0x5865F2", "#5865F2", "5865F2"
 */
export function parseColor(colorStr: string): number | null {
  if (!colorStr) return null;

  let cleaned = colorStr.trim();

  // Remove 0x prefix
  if (cleaned.toLowerCase().startsWith('0x')) {
    cleaned = cleaned.slice(2);
  }

  // Remove # prefix
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.slice(1);
  }

  // Validate hex format
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null;
  }

  const num = parseInt(cleaned, 16);
  if (isNaN(num) || num < 0 || num > 0xFFFFFF) {
    return null;
  }

  return num;
}

/**
 * Format a color number to hex string
 */
export function formatColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * Validate a threshold input string
 */
export function parseThreshold(input: string, min: number = 0, max: number = 100): number | null {
  const trimmed = input.trim();
  const num = parseInt(trimmed, 10);

  if (isNaN(num)) return null;
  if (num < min || num > max) return null;

  return num;
}

/**
 * Check if a channel list is valid
 */
export function validateChannelList(channelIds: string[]): boolean {
  if (!Array.isArray(channelIds)) return false;

  for (const id of channelIds) {
    if (typeof id !== 'string' || !/^\d+$/.test(id)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if source and destination channels conflict
 */
export function hasChannelConflict(board: Partial<Board>): boolean {
  if (!board.destinationChannelId) return false;
  if (!board.sourceChannelIds || board.sourceChannelIds.length === 0) return false;

  // Destination channel shouldn't be in source channels
  return board.sourceChannelIds.includes(board.destinationChannelId);
}
