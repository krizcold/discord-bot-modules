/**
 * Panel State Management
 *
 * Tracks per-user panel state like current page, editing group, etc.
 */

import { ResponseManagerPanelState } from '../types/responseManager';

// In-memory state storage (keyed by `${guildId}:${userId}`)
const panelStates = new Map<string, ResponseManagerPanelState>();

// State expiry time (30 minutes)
const STATE_EXPIRY_MS = 30 * 60 * 1000;

interface StateEntry {
  state: ResponseManagerPanelState;
  timestamp: number;
}

const stateEntries = new Map<string, StateEntry>();

/**
 * Get state key for a user in a guild
 */
function getKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

/**
 * Get panel state for a user
 */
export function getPanelState(guildId: string, userId: string): ResponseManagerPanelState {
  const key = getKey(guildId, userId);
  const entry = stateEntries.get(key);

  if (entry && Date.now() - entry.timestamp < STATE_EXPIRY_MS) {
    return entry.state;
  }

  // Return default state
  return {
    currentPage: 1,
  };
}

/**
 * Set panel state for a user
 */
export function setPanelState(guildId: string, userId: string, state: ResponseManagerPanelState): void {
  const key = getKey(guildId, userId);
  stateEntries.set(key, {
    state,
    timestamp: Date.now(),
  });
}

/**
 * Update partial panel state
 */
export function updatePanelState(
  guildId: string,
  userId: string,
  updates: Partial<ResponseManagerPanelState>
): ResponseManagerPanelState {
  const current = getPanelState(guildId, userId);
  const updated = { ...current, ...updates };
  setPanelState(guildId, userId, updated);
  return updated;
}

/**
 * Clear panel state for a user
 */
export function clearPanelState(guildId: string, userId: string): void {
  const key = getKey(guildId, userId);
  stateEntries.delete(key);
}

/**
 * Get current page for a user
 */
export function getCurrentPage(guildId: string, userId: string): number {
  return getPanelState(guildId, userId).currentPage;
}

/**
 * Set current page for a user
 */
export function setCurrentPage(guildId: string, userId: string, page: number): void {
  updatePanelState(guildId, userId, { currentPage: page });
}

/**
 * Get editing group ID
 */
export function getEditingGroupId(guildId: string, userId: string): string | undefined {
  return getPanelState(guildId, userId).editingGroupId;
}

/**
 * Set editing group ID
 */
export function setEditingGroupId(guildId: string, userId: string, groupId: string | undefined): void {
  updatePanelState(guildId, userId, { editingGroupId: groupId });
}

/**
 * Clean up expired states (call periodically)
 */
export function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, entry] of stateEntries.entries()) {
    if (now - entry.timestamp >= STATE_EXPIRY_MS) {
      stateEntries.delete(key);
    }
  }
}

// Cleanup every 10 minutes
setInterval(cleanupExpiredStates, 10 * 60 * 1000);
