/**
 * Response Manager Storage Utilities
 */

import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { getMergedConfig } from '@internal/utils/configManager';
import {
  ResponseGroup,
  ResponseItem,
  ResponseManagerStorage,
  createDefaultStorage,
  createDefaultGroup,
} from '../types/responseManager';
import { DEFAULT_MAX_GROUPS } from '../panels/constants';

const MODULE_NAME = 'response-manager';
const STORAGE_FILE = 'groups.json';
const CONFIG_FILE = 'response-manager-config.json';

/**
 * Get max groups from config (with default fallback)
 */
function getMaxGroups(guildId: string): number {
  const config = getMergedConfig(CONFIG_FILE, guildId);
  return config.properties?.maxGroups?.value ?? DEFAULT_MAX_GROUPS;
}

/**
 * Migrate old string[] responses to ResponseItem[] format
 */
function migrateResponses(responses: any[]): ResponseItem[] {
  if (!responses || responses.length === 0) return [];

  // Check if already migrated (first item is an object with 'value' property)
  if (typeof responses[0] === 'object' && 'value' in responses[0]) {
    return responses as ResponseItem[];
  }

  // Migrate from string[] to ResponseItem[]
  return responses.map((r: string) => ({
    value: r,
    displayValue: r, // For old data, value and display are the same
  }));
}

/**
 * Load response groups for a guild
 */
export function loadGroups(guildId: string): ResponseManagerStorage {
  const storage = loadModuleData<ResponseManagerStorage>(
    STORAGE_FILE,
    guildId,
    MODULE_NAME,
    createDefaultStorage()
  );

  // Migrate old data format if needed
  let needsSave = false;
  for (const group of storage.groups) {
    const migratedResponses = migrateResponses(group.responses as any);
    if (migratedResponses !== group.responses) {
      group.responses = migratedResponses;
      needsSave = true;
    }
  }

  if (needsSave) {
    saveModuleData(STORAGE_FILE, guildId, MODULE_NAME, storage);
  }

  return storage;
}

/**
 * Save response groups for a guild
 */
export function saveGroups(guildId: string, storage: ResponseManagerStorage): void {
  saveModuleData(STORAGE_FILE, guildId, MODULE_NAME, storage);
}

/**
 * Get all groups for a guild
 */
export function getAllGroups(guildId: string): ResponseGroup[] {
  return loadGroups(guildId).groups;
}

/**
 * Get enabled groups for a guild
 */
export function getEnabledGroups(guildId: string): ResponseGroup[] {
  return getAllGroups(guildId).filter(g => g.enabled);
}

/**
 * Get a specific group by ID
 */
export function getGroup(guildId: string, groupId: string): ResponseGroup | undefined {
  return getAllGroups(guildId).find(g => g.id === groupId);
}

/**
 * Create a new group
 */
export function createGroup(guildId: string, group: Partial<ResponseGroup>): ResponseGroup | null {
  const storage = loadGroups(guildId);
  const maxGroups = getMaxGroups(guildId);

  if (storage.groups.length >= maxGroups) {
    return null;
  }

  const newGroup: ResponseGroup = {
    id: generateGroupId(),
    name: group.name || 'New Group',
    enabled: group.enabled ?? true,
    keywords: group.keywords || [],
    matchMode: group.matchMode || 'word',
    responseType: group.responseType || 'react',
    responses: group.responses || [],
    selectionMode: group.selectionMode || 'random',
    enabledChannels: group.enabledChannels || [],
    commandName: group.commandName,
    argumentMapping: group.argumentMapping,
    groupCooldown: group.groupCooldown || { charges: 0, reloadSeconds: 1 },
    keywordCooldown: group.keywordCooldown || { charges: 0, reloadSeconds: 0 },
  };

  storage.groups.push(newGroup);
  saveGroups(guildId, storage);

  return newGroup;
}

/**
 * Update an existing group
 */
export function updateGroup(guildId: string, groupId: string, updates: Partial<ResponseGroup>): ResponseGroup | null {
  const storage = loadGroups(guildId);
  const index = storage.groups.findIndex(g => g.id === groupId);

  if (index === -1) {
    return null;
  }

  storage.groups[index] = {
    ...storage.groups[index],
    ...updates,
    id: groupId, // Prevent ID change
  };

  saveGroups(guildId, storage);
  return storage.groups[index];
}

/**
 * Delete a group
 */
export function deleteGroup(guildId: string, groupId: string): boolean {
  const storage = loadGroups(guildId);
  const index = storage.groups.findIndex(g => g.id === groupId);

  if (index === -1) {
    return false;
  }

  storage.groups.splice(index, 1);
  saveGroups(guildId, storage);
  return true;
}

/**
 * Toggle group enabled state
 */
export function toggleGroup(guildId: string, groupId: string): boolean | null {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);

  if (!group) {
    return null;
  }

  group.enabled = !group.enabled;
  saveGroups(guildId, storage);
  return group.enabled;
}

/**
 * Update sequence index for sequential selection mode
 */
export function updateSequenceIndex(guildId: string, groupId: string, newIndex: number): void {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);

  if (group) {
    group.lastSequenceIndex = newIndex;
    saveGroups(guildId, storage);
  }
}

/**
 * Generate a unique group ID
 */
function generateGroupId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Check if a group name already exists
 */
export function groupNameExists(guildId: string, name: string, excludeId?: string): boolean {
  return getAllGroups(guildId).some(g =>
    g.name.toLowerCase() === name.toLowerCase() && g.id !== excludeId
  );
}
