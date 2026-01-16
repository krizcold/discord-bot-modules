/**
 * Cache Service Implementation
 * Encapsulates global mutable state for giveaways
 */

import { Giveaway } from '@bot/types/commandTypes';

class CacheService {
  private giveawaysCache = new Map<string, Giveaway[]>();
  private cacheLoaded = new Set<string>();
  private activeTimers = new Map<string, NodeJS.Timeout>();

  getGiveaways(guildId: string): Giveaway[] {
    return this.giveawaysCache.get(guildId) || [];
  }

  setGiveaways(guildId: string, giveaways: Giveaway[]): void {
    this.giveawaysCache.set(guildId, giveaways);
  }

  invalidate(guildId: string): void {
    this.cacheLoaded.delete(guildId);
  }

  isLoaded(guildId: string): boolean {
    return this.cacheLoaded.has(guildId);
  }

  markLoaded(guildId: string): void {
    this.cacheLoaded.add(guildId);
  }

  setTimer(giveawayId: string, timer: NodeJS.Timeout): void {
    // Clear existing timer if present
    if (this.activeTimers.has(giveawayId)) {
      clearTimeout(this.activeTimers.get(giveawayId));
    }
    this.activeTimers.set(giveawayId, timer);
  }

  getTimer(giveawayId: string): NodeJS.Timeout | undefined {
    return this.activeTimers.get(giveawayId);
  }

  clearTimer(giveawayId: string): void {
    const timer = this.activeTimers.get(giveawayId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(giveawayId);
    }
  }

  hasTimer(giveawayId: string): boolean {
    return this.activeTimers.has(giveawayId);
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export Map-like interfaces for existing code compatibility
export const giveawaysCache = {
  get: (guildId: string) => cacheService.getGiveaways(guildId),
  set: (guildId: string, giveaways: Giveaway[]) => cacheService.setGiveaways(guildId, giveaways),
};

export const cacheLoaded = {
  has: (guildId: string) => cacheService.isLoaded(guildId),
  add: (guildId: string) => cacheService.markLoaded(guildId),
};

export const activeTimers = {
  get: (giveawayId: string) => cacheService.getTimer(giveawayId),
  set: (giveawayId: string, timer: NodeJS.Timeout) => cacheService.setTimer(giveawayId, timer),
  has: (giveawayId: string) => cacheService.hasTimer(giveawayId),
  delete: (giveawayId: string) => cacheService.clearTimer(giveawayId),
};
