import { RoleAssignmentGroup } from '../types/roleAssign';
import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { cacheService } from './cache';
import { MODULE_NAME, DATA_FILE } from '../constants/prefixes';

function loadGroups(guildId: string, forceReload = false): RoleAssignmentGroup[] {
  if (!forceReload && cacheService.isLoaded(guildId)) {
    return cacheService.getGroups(guildId) || [];
  }

  const groups: RoleAssignmentGroup[] = loadModuleData(DATA_FILE, guildId, MODULE_NAME, []);
  cacheService.setGroups(guildId, groups);
  cacheService.markLoaded(guildId);
  return groups;
}

function saveGroups(guildId: string, groups: RoleAssignmentGroup[]): void {
  saveModuleData(DATA_FILE, guildId, MODULE_NAME, groups);
  cacheService.setGroups(guildId, groups);
}

export function addGroup(group: RoleAssignmentGroup): RoleAssignmentGroup | null {
  const groups = loadGroups(group.guildId);

  if (groups.some(g => g.id === group.id)) {
    return null;
  }

  groups.push(group);
  saveGroups(group.guildId, groups);
  return group;
}

export function getGroup(groupId: string, guildId: string): RoleAssignmentGroup | undefined {
  const groups = loadGroups(guildId);
  return groups.find(g => g.id === groupId);
}

export function getGroupByMessageId(messageId: string, guildId?: string): RoleAssignmentGroup | undefined {
  const cached = cacheService.getGroupByMessageId(messageId);
  if (cached) {
    return getGroup(cached.groupId, cached.guildId);
  }

  if (guildId) {
    const groups = loadGroups(guildId);
    return groups.find(g => g.messageIds.includes(messageId));
  }

  return undefined;
}

export function updateGroup(
  groupId: string,
  updates: Partial<RoleAssignmentGroup>,
  guildId: string
): boolean {
  const groups = loadGroups(guildId);
  const index = groups.findIndex(g => g.id === groupId);

  if (index === -1) {
    return false;
  }

  const oldMessageIds = groups[index].messageIds;
  groups[index] = { ...groups[index], ...updates, updatedAt: Date.now() };

  for (const messageId of oldMessageIds) {
    cacheService.removeMessageMapping(messageId);
  }
  for (const messageId of groups[index].messageIds) {
    cacheService.setMessageMapping(messageId, guildId, groupId);
  }

  saveGroups(guildId, groups);
  return true;
}

export function removeGroup(groupId: string, guildId: string): boolean {
  const groups = loadGroups(guildId);
  const index = groups.findIndex(g => g.id === groupId);

  if (index === -1) {
    return false;
  }

  const group = groups[index];
  for (const messageId of group.messageIds) {
    cacheService.removeMessageMapping(messageId);
  }

  groups.splice(index, 1);
  saveGroups(guildId, groups);
  return true;
}

export function getAllGroups(guildId: string): RoleAssignmentGroup[] {
  const groups = loadGroups(guildId);
  return groups.sort((a, b) => b.createdAt - a.createdAt);
}

export function reloadGroups(guildId: string): RoleAssignmentGroup[] {
  return loadGroups(guildId, true);
}
