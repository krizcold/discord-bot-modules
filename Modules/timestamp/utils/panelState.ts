// Panel state storage for modal pre-population and format persistence
// Stores state by user ID (ephemeral panels are user-specific)

import { TimestampInput, TimestampSessionState } from '../types/timestamp';

interface StoredState {
  state: TimestampSessionState;
  timestamp: number;
}

const STATE_TTL_MS = 60 * 60 * 1000; // 1 hour
const panelStateMap = new Map<string, StoredState>();

export function storePanelState(userId: string, state: TimestampSessionState): void {
  panelStateMap.set(userId, { state, timestamp: Date.now() });
}

export function getPanelState(userId: string): TimestampSessionState | undefined {
  const stored = panelStateMap.get(userId);
  if (!stored) return undefined;

  // Check if expired
  if (Date.now() - stored.timestamp > STATE_TTL_MS) {
    panelStateMap.delete(userId);
    return undefined;
  }

  return stored.state;
}

export function getPanelInput(userId: string): TimestampInput | undefined {
  return getPanelState(userId)?.input;
}

export function clearPanelState(userId: string): void {
  panelStateMap.delete(userId);
}

// Cleanup expired entries (call periodically or on bot ready)
export function cleanupExpiredStates(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [userId, stored] of panelStateMap) {
    if (now - stored.timestamp > STATE_TTL_MS) {
      panelStateMap.delete(userId);
      cleaned++;
    }
  }

  return cleaned;
}
