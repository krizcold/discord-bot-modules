/**
 * Response Manager - Cooldown Manager
 *
 * Tracks and enforces cooldowns for response groups.
 * - Group cooldowns: apply to all triggers from a group
 * - Keyword cooldowns: apply per-keyword (only if >1 keyword)
 *
 * Uses in-memory storage with charge-based system:
 * - charges: 0 = unlimited uses
 * - reloadSeconds: time to restore 1 charge
 */

import { CooldownConfig, ResponseGroup } from '../types/responseManager';

/**
 * Cooldown state for a group or keyword
 */
interface CooldownState {
  charges: number;        // Current available charges
  lastUsed: number;       // Timestamp of last use
  lastReload: number;     // Timestamp of last reload calculation
}

/**
 * Storage for cooldowns
 * Structure: guildId -> groupId -> ('group' | keywordPattern) -> CooldownState
 */
const cooldownStore = new Map<string, Map<string, Map<string, CooldownState>>>();

/**
 * Get or create guild cooldown map
 */
function getGuildCooldowns(guildId: string): Map<string, Map<string, CooldownState>> {
  if (!cooldownStore.has(guildId)) {
    cooldownStore.set(guildId, new Map());
  }
  return cooldownStore.get(guildId)!;
}

/**
 * Get or create group cooldown map
 */
function getGroupCooldowns(guildId: string, groupId: string): Map<string, CooldownState> {
  const guildMap = getGuildCooldowns(guildId);
  if (!guildMap.has(groupId)) {
    guildMap.set(groupId, new Map());
  }
  return guildMap.get(groupId)!;
}

/**
 * Calculate current available charges based on time passed
 */
function calculateCurrentCharges(
  state: CooldownState,
  config: CooldownConfig
): number {
  // If unlimited charges, always return max
  if (config.charges === 0) {
    return Infinity;
  }

  const now = Date.now();
  const timeSinceLastReload = (now - state.lastReload) / 1000; // in seconds

  // Calculate how many charges have been restored
  const chargesRestored = Math.floor(timeSinceLastReload / config.reloadSeconds);

  // Cap at max charges
  return Math.min(state.charges + chargesRestored, config.charges);
}

/**
 * Check if a group trigger is allowed (group-level cooldown)
 */
export function checkGroupCooldown(
  guildId: string,
  group: ResponseGroup
): boolean {
  const config = group.groupCooldown;

  // No cooldown config or unlimited = always allowed
  if (!config || config.charges === 0) {
    return true;
  }

  const groupCooldowns = getGroupCooldowns(guildId, group.id);
  const state = groupCooldowns.get('group');

  // First use - always allowed
  if (!state) {
    return true;
  }

  const currentCharges = calculateCurrentCharges(state, config);
  return currentCharges > 0;
}

/**
 * Check if a keyword trigger is allowed (per-keyword cooldown)
 * Only applies if group has >1 keyword
 */
export function checkKeywordCooldown(
  guildId: string,
  group: ResponseGroup,
  keywordPattern: string
): boolean {
  // Only apply per-keyword cooldown if >1 keyword
  if (!group.keywords || group.keywords.length <= 1) {
    return true;
  }

  const config = group.keywordCooldown;

  // No cooldown config or unlimited = always allowed
  if (!config || (config.charges === 0 && config.reloadSeconds === 0)) {
    return true;
  }

  // If charges is 0 but reload > 0, treat as unlimited charges with reload time
  if (config.charges === 0) {
    return true;
  }

  const groupCooldowns = getGroupCooldowns(guildId, group.id);
  const state = groupCooldowns.get(`keyword:${keywordPattern}`);

  // First use - always allowed
  if (!state) {
    return true;
  }

  const currentCharges = calculateCurrentCharges(state, config);
  return currentCharges > 0;
}

/**
 * Check if a response trigger is allowed (both cooldowns)
 */
export function canTrigger(
  guildId: string,
  group: ResponseGroup,
  keywordPattern: string
): boolean {
  // Check group cooldown first
  if (!checkGroupCooldown(guildId, group)) {
    return false;
  }

  // Check keyword cooldown
  if (!checkKeywordCooldown(guildId, group, keywordPattern)) {
    return false;
  }

  return true;
}

/**
 * Record a trigger use (updates cooldown state)
 */
export function recordTrigger(
  guildId: string,
  group: ResponseGroup,
  keywordPattern: string
): void {
  const now = Date.now();
  const groupCooldowns = getGroupCooldowns(guildId, group.id);

  // Update group cooldown
  const groupConfig = group.groupCooldown;
  if (groupConfig && groupConfig.charges > 0) {
    const groupState = groupCooldowns.get('group');

    if (!groupState) {
      // First use
      groupCooldowns.set('group', {
        charges: groupConfig.charges - 1,
        lastUsed: now,
        lastReload: now,
      });
    } else {
      // Calculate current charges and deduct
      const currentCharges = calculateCurrentCharges(groupState, groupConfig);
      const timeSinceLastReload = (now - groupState.lastReload) / 1000;
      const chargesRestored = Math.floor(timeSinceLastReload / groupConfig.reloadSeconds);

      groupCooldowns.set('group', {
        charges: currentCharges - 1,
        lastUsed: now,
        // Update lastReload if charges were restored
        lastReload: chargesRestored > 0 ? now : groupState.lastReload,
      });
    }
  }

  // Update keyword cooldown (only if >1 keyword)
  if (group.keywords && group.keywords.length > 1) {
    const keywordConfig = group.keywordCooldown;
    if (keywordConfig && keywordConfig.charges > 0) {
      const key = `keyword:${keywordPattern}`;
      const keywordState = groupCooldowns.get(key);

      if (!keywordState) {
        // First use
        groupCooldowns.set(key, {
          charges: keywordConfig.charges - 1,
          lastUsed: now,
          lastReload: now,
        });
      } else {
        // Calculate current charges and deduct
        const currentCharges = calculateCurrentCharges(keywordState, keywordConfig);
        const timeSinceLastReload = (now - keywordState.lastReload) / 1000;
        const chargesRestored = Math.floor(timeSinceLastReload / keywordConfig.reloadSeconds);

        groupCooldowns.set(key, {
          charges: currentCharges - 1,
          lastUsed: now,
          lastReload: chargesRestored > 0 ? now : keywordState.lastReload,
        });
      }
    }
  }
}

/**
 * Clear all cooldowns for a group (useful when group is deleted/reset)
 */
export function clearGroupCooldowns(guildId: string, groupId: string): void {
  const guildMap = cooldownStore.get(guildId);
  if (guildMap) {
    guildMap.delete(groupId);
  }
}

/**
 * Clear all cooldowns for a guild
 */
export function clearGuildCooldowns(guildId: string): void {
  cooldownStore.delete(guildId);
}

/**
 * Get cooldown info for debugging
 */
export function getCooldownInfo(
  guildId: string,
  groupId: string,
  key: string = 'group'
): { available: number; maxCharges: number; reloadSeconds: number } | null {
  const guildMap = cooldownStore.get(guildId);
  if (!guildMap) return null;

  const groupMap = guildMap.get(groupId);
  if (!groupMap) return null;

  const state = groupMap.get(key);
  if (!state) return null;

  return {
    available: state.charges,
    maxCharges: 0, // Would need config to know this
    reloadSeconds: 0,
  };
}
