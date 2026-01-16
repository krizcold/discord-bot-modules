/**
 * Message Selection Logic
 * Handles random (pseudo-random) and sequential selection
 */

import { ScheduledGroup, ScheduledMessage } from '../types/scheduled';

/**
 * Select the next message to send based on group settings
 * Priority:
 * 1. Message with forceNext: true (only one at a time)
 * 2. Messages with queuePosition > 0, sorted by position (FIFO)
 * 3. Normal selection (sequential or random)
 */
export function selectNextMessage(group: ScheduledGroup): ScheduledMessage | null {
  const { messages, selectionMode, randomOldestPercent, loop, currentIndex } = group;

  if (messages.length === 0) return null;

  // Check for forced next message
  const forcedMessage = messages.find(m => m.forceNext === true);
  if (forcedMessage) {
    return forcedMessage;
  }

  // Check for queued messages (sorted by queuePosition, lowest first)
  const queuedMessages = messages
    .filter(m => m.queuePosition && m.queuePosition > 0)
    .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

  if (queuedMessages.length > 0) {
    return queuedMessages[0];
  }

  // Normal selection
  // stopAfterAllSent = !loop (loop disabled means stop after all sent)
  const stopAfterAllSent = !loop;

  if (selectionMode === 'sequential') {
    return selectSequential(messages, currentIndex, stopAfterAllSent);
  }

  return selectPseudoRandom(messages, randomOldestPercent, stopAfterAllSent);
}

/**
 * Sequential selection - picks messages in order
 */
function selectSequential(
  messages: ScheduledMessage[],
  currentIndex: number,
  stopAfterAllSent: boolean
): ScheduledMessage | null {
  if (stopAfterAllSent && currentIndex >= messages.length) {
    return null; // All messages sent once
  }

  return messages[currentIndex % messages.length];
}

/**
 * Pseudo-random selection - picks from a pool built as follows:
 * 1. Add ALL never-sent messages to the pool first (they have priority)
 * 2. If pool < target size (X%), add oldest sent messages until target reached
 * 3. Pick randomly from the pool
 *
 * When randomOldestPercent is 0, only never-sent items are in pool (or oldest 1 if all sent)
 */
function selectPseudoRandom(
  messages: ScheduledMessage[],
  randomOldestPercent: number,
  stopAfterAllSent: boolean
): ScheduledMessage | null {
  // Build the pool using the priority system
  const pool = buildSelectionPool(messages, randomOldestPercent);

  if (pool.length === 0) {
    return null;
  }

  // Filter for stopAfterAllSent mode
  const eligible = stopAfterAllSent
    ? pool.filter(m => m.sentCount === 0)
    : pool;

  if (eligible.length === 0) {
    if (stopAfterAllSent) {
      // All messages in pool have been sent, check if any unsent exist at all
      const allUnsent = messages.filter(m => m.sentCount === 0);
      if (allUnsent.length === 0) return null; // All sent once
      // This shouldn't happen since unsent are added first, but safety fallback
      return allUnsent[Math.floor(Math.random() * allUnsent.length)];
    }
    return null;
  }

  // Random selection from pool
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Build the selection pool for random mode:
 * 1. Add ALL never-sent messages first (highest priority)
 * 2. If pool < target size, add oldest sent messages until target reached
 *
 * Returns array of messages in the pool
 */
function buildSelectionPool(
  messages: ScheduledMessage[],
  randomOldestPercent: number
): ScheduledMessage[] {
  if (messages.length === 0) return [];

  // Step 1: Add all never-sent messages to pool
  const neverSent = messages.filter(m => m.sentCount === 0);

  // Calculate target pool size: 0% means only never-sent (or 1 if all sent)
  const targetSize = randomOldestPercent === 0
    ? (neverSent.length > 0 ? neverSent.length : 1)
    : Math.max(1, Math.ceil(messages.length * (randomOldestPercent / 100)));

  // Step 2: If never-sent already meets or exceeds target, pool is ready
  if (neverSent.length >= targetSize) {
    return neverSent;
  }

  // Step 3: Need to add oldest sent messages to fill the pool
  const sentMessages = messages.filter(m => m.sentCount > 0);

  // Sort sent messages by lastSentAt (oldest first)
  const sortedSent = [...sentMessages].sort((a, b) => {
    const aTime = a.lastSentAt ?? 0;
    const bTime = b.lastSentAt ?? 0;
    return aTime - bTime;
  });

  // Add oldest sent messages until we reach target size
  const spotsToFill = targetSize - neverSent.length;
  const oldestSent = sortedSent.slice(0, spotsToFill);

  return [...neverSent, ...oldestSent];
}

/**
 * Get the next message for preview (without actually selecting)
 */
export function previewNextMessage(group: ScheduledGroup): ScheduledMessage | null {
  return selectNextMessage(group);
}

/**
 * Check if group is complete (all messages sent once when loop disabled)
 */
export function isGroupComplete(group: ScheduledGroup): boolean {
  // If loop is enabled, never complete
  if (group.loop) return false;

  if (group.selectionMode === 'sequential') {
    return group.currentIndex >= group.messages.length;
  }

  // For random mode, check if all messages have been sent
  return group.messages.every(m => m.sentCount > 0);
}

/**
 * Get completion progress (for when loop is disabled)
 */
export function getCompletionProgress(group: ScheduledGroup): { sent: number; total: number } {
  const total = group.messages.length;

  if (group.selectionMode === 'sequential') {
    return {
      sent: Math.min(group.currentIndex, total),
      total,
    };
  }

  const sent = group.messages.filter(m => m.sentCount > 0).length;
  return { sent, total };
}

/**
 * Check if a message is on cooldown (not in the selectable pool)
 * For random mode: message is outside the pool (never-sent first, then oldest sent)
 * For sequential mode: message is before the current index (already sent in sequence)
 */
export function isMessageOnCooldown(group: ScheduledGroup, messageIndex: number): boolean {
  const { messages, selectionMode, randomOldestPercent, currentIndex } = group;

  if (messages.length === 0) return false;

  const message = messages[messageIndex];
  if (!message) return false;

  // Forced or queued messages are never on cooldown
  if (message.forceNext || (message.queuePosition && message.queuePosition > 0)) {
    return false;
  }

  if (selectionMode === 'sequential') {
    // In sequential mode, messages before currentIndex are on cooldown
    return messageIndex < (currentIndex % messages.length);
  }

  // Random mode: build pool and check if message is in it
  const pool = buildSelectionPool(messages, randomOldestPercent);

  // Check if the message at this index is in the pool
  return !pool.includes(message);
}
