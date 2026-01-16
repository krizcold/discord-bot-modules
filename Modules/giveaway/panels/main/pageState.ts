/**
 * Page State Management
 * Stores current page per user per guild for persistent panel state
 */

// TTL-based cleanup to prevent memory leaks
const PAGE_STATE_TTL = 30 * 60 * 1000; // 30 minutes

interface PageStateEntry {
  page: number;
  timestamp: number;
}

const userPageState = new Map<string, PageStateEntry>();

// Periodic cleanup of stale page state entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userPageState.entries()) {
    if (now - value.timestamp > PAGE_STATE_TTL) {
      userPageState.delete(key);
    }
  }
}, PAGE_STATE_TTL);

function getPageStateKey(userId: string, guildId: string): string {
  return `${guildId}:${userId}`;
}

export function setPageState(userId: string, guildId: string, page: number): void {
  userPageState.set(getPageStateKey(userId, guildId), { page, timestamp: Date.now() });
}

export function getPageState(userId: string, guildId: string): number {
  const state = userPageState.get(getPageStateKey(userId, guildId));
  return state?.page ?? 0;
}
