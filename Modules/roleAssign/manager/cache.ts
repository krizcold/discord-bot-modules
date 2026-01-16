import { RoleAssignmentGroup } from '../types/roleAssign';

class RoleAssignCacheService {
  private groupsCache = new Map<string, RoleAssignmentGroup[]>();
  private cacheLoaded = new Set<string>();
  private messageToGroupMap = new Map<string, { guildId: string; groupId: string }>();

  getGroups(guildId: string): RoleAssignmentGroup[] | undefined {
    return this.groupsCache.get(guildId);
  }

  setGroups(guildId: string, groups: RoleAssignmentGroup[]): void {
    this.groupsCache.set(guildId, groups);
    this.rebuildMessageMap(guildId, groups);
  }

  invalidate(guildId: string): void {
    const groups = this.groupsCache.get(guildId);
    if (groups) {
      for (const group of groups) {
        for (const messageId of group.messageIds) {
          this.messageToGroupMap.delete(messageId);
        }
      }
    }
    this.groupsCache.delete(guildId);
    this.cacheLoaded.delete(guildId);
  }

  isLoaded(guildId: string): boolean {
    return this.cacheLoaded.has(guildId);
  }

  markLoaded(guildId: string): void {
    this.cacheLoaded.add(guildId);
  }

  getGroupByMessageId(messageId: string): { guildId: string; groupId: string } | undefined {
    return this.messageToGroupMap.get(messageId);
  }

  setMessageMapping(messageId: string, guildId: string, groupId: string): void {
    this.messageToGroupMap.set(messageId, { guildId, groupId });
  }

  removeMessageMapping(messageId: string): void {
    this.messageToGroupMap.delete(messageId);
  }

  private rebuildMessageMap(guildId: string, groups: RoleAssignmentGroup[]): void {
    for (const group of groups) {
      for (const messageId of group.messageIds) {
        this.messageToGroupMap.set(messageId, { guildId, groupId: group.id });
      }
    }
  }

  clear(): void {
    this.groupsCache.clear();
    this.cacheLoaded.clear();
    this.messageToGroupMap.clear();
  }
}

export const cacheService = new RoleAssignCacheService();
