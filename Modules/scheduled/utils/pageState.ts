/**
 * Panel State Management
 *
 * Tracks per-user panel state like current page, editing group, etc.
 */

import { ScheduledPanelState, ScheduledGroup } from '../types/scheduled';

// State expiry time (2 hours - generous timeout)
const STATE_EXPIRY_MS = 2 * 60 * 60 * 1000;

interface StateEntry {
  state: ScheduledPanelState;
  timestamp: number;
}

const stateEntries = new Map<string, StateEntry>();

function getKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function getPanelState(guildId: string, userId: string): ScheduledPanelState {
  const key = getKey(guildId, userId);
  const entry = stateEntries.get(key);

  if (entry && Date.now() - entry.timestamp < STATE_EXPIRY_MS) {
    // Refresh timestamp on access to keep state alive while actively using
    entry.timestamp = Date.now();
    return entry.state;
  }

  return { currentPage: 1 };
}

export function setPanelState(guildId: string, userId: string, state: ScheduledPanelState): void {
  const key = getKey(guildId, userId);
  stateEntries.set(key, {
    state,
    timestamp: Date.now(),
  });
}

export function updatePanelState(
  guildId: string,
  userId: string,
  updates: Partial<ScheduledPanelState>
): ScheduledPanelState {
  const current = getPanelState(guildId, userId);
  const updated = { ...current, ...updates };
  setPanelState(guildId, userId, updated);
  return updated;
}

export function clearPanelState(guildId: string, userId: string): void {
  const key = getKey(guildId, userId);
  stateEntries.delete(key);
}

// Page helpers
export function getCurrentPage(guildId: string, userId: string): number {
  return getPanelState(guildId, userId).currentPage;
}

export function setCurrentPage(guildId: string, userId: string, page: number): void {
  updatePanelState(guildId, userId, { currentPage: page });
}

// Messages page helpers
export function getMessagesPage(guildId: string, userId: string): number {
  return getPanelState(guildId, userId).messagesPage ?? 1;
}

export function setMessagesPage(guildId: string, userId: string, page: number): void {
  updatePanelState(guildId, userId, { messagesPage: page });
}

// Editing group helpers
export function getEditingGroupId(guildId: string, userId: string): string | undefined {
  return getPanelState(guildId, userId).editingGroupId;
}

export function setEditingGroupId(guildId: string, userId: string, groupId: string | undefined): void {
  updatePanelState(guildId, userId, { editingGroupId: groupId, messagesPage: 1 });
}

// Pending group helpers (for new group creation)
export function getPendingGroup(guildId: string, userId: string): Partial<ScheduledGroup> | undefined {
  return getPanelState(guildId, userId).pendingGroup;
}

export function setPendingGroup(guildId: string, userId: string, pending: Partial<ScheduledGroup> | undefined): void {
  updatePanelState(guildId, userId, { pendingGroup: pending });
}

// Selected message helpers
export function getSelectedMessageIndex(guildId: string, userId: string): number | undefined {
  return getPanelState(guildId, userId).selectedMessageIndex;
}

export function setSelectedMessageIndex(guildId: string, userId: string, index: number | undefined): void {
  updatePanelState(guildId, userId, { selectedMessageIndex: index });
}

// View mode helpers
export function getMessagesViewMode(guildId: string, userId: string): 'detailed' | 'compact' {
  return getPanelState(guildId, userId).messagesViewMode ?? 'detailed';
}

export function setMessagesViewMode(guildId: string, userId: string, mode: 'detailed' | 'compact'): void {
  updatePanelState(guildId, userId, { messagesViewMode: mode });
}

export function toggleMessagesViewMode(guildId: string, userId: string): 'detailed' | 'compact' {
  const current = getMessagesViewMode(guildId, userId);
  const newMode = current === 'detailed' ? 'compact' : 'detailed';
  setMessagesViewMode(guildId, userId, newMode);
  return newMode;
}

// Cleanup expired states
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

// ================== GROUP RETRIEVAL ==================

import { getGroup } from './storage';

/**
 * Get the group being edited (from storage or pending state)
 * Centralized function used by all panels
 */
export function getEditingGroup(
  guildId: string,
  userId: string
): { group: Partial<ScheduledGroup>; isNew: boolean } {
  const editingId = getEditingGroupId(guildId, userId);
  const pending = getPendingGroup(guildId, userId);

  if (editingId) {
    const stored = getGroup(guildId, editingId);
    if (stored) {
      return { group: stored, isNew: false };
    }
  }

  return { group: pending || {}, isNew: true };
}
