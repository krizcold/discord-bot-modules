/**
 * Hall of Fame Page State
 * Tracks pagination state per user/guild
 */

// Map: `${userId}_${guildId}` -> page number
const pageStates = new Map<string, number>();

/**
 * Get the current page for a user in a guild
 */
export function getPageState(userId: string, guildId: string): number {
  const key = `${userId}_${guildId}`;
  return pageStates.get(key) || 0;
}

/**
 * Set the current page for a user in a guild
 */
export function setPageState(userId: string, guildId: string, page: number): void {
  const key = `${userId}_${guildId}`;
  pageStates.set(key, page);
}

/**
 * Clear page state for a user in a guild
 */
export function clearPageState(userId: string, guildId: string): void {
  const key = `${userId}_${guildId}`;
  pageStates.delete(key);
}
