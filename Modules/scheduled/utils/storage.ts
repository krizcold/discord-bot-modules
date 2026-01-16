/**
 * Scheduled Messages Storage Utilities
 */

import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { getModuleSetting } from '@internal/utils/settings/settingsStorage';
import type { SettingValue } from '@bot/types/settingsTypes';
import {
  UserReminder,
  ReminderStorage,
  ScheduledGroup,
  ScheduledMessage,
  GroupStorage,
  ScheduleConfig,
} from '../types/scheduled';

const MODULE_NAME = 'scheduled';
const CATEGORY = 'misc';
const REMINDERS_FILE = 'reminders.json';
const GROUPS_FILE = 'groups.json';

// Settings helper
function getSetting<T extends SettingValue>(key: string, guildId: string, defaultValue: T): T {
  const value = getModuleSetting<T>(MODULE_NAME, key, guildId, CATEGORY);
  return value !== undefined ? value : defaultValue;
}

// ================== REMINDER STORAGE ==================

function createDefaultReminderStorage(): ReminderStorage {
  return { reminders: [] };
}

export function loadReminders(guildId: string): ReminderStorage {
  return loadModuleData<ReminderStorage>(
    REMINDERS_FILE,
    guildId,
    MODULE_NAME,
    createDefaultReminderStorage()
  );
}

export function saveReminders(guildId: string, storage: ReminderStorage): void {
  saveModuleData(REMINDERS_FILE, guildId, MODULE_NAME, storage);
}

export function getAllReminders(guildId: string): UserReminder[] {
  return loadReminders(guildId).reminders;
}

export function getUserReminders(guildId: string, userId: string): UserReminder[] {
  return getAllReminders(guildId).filter(r => r.userId === userId);
}

export function getReminder(guildId: string, reminderId: string): UserReminder | undefined {
  return getAllReminders(guildId).find(r => r.id === reminderId);
}

export function createReminder(guildId: string, reminder: Omit<UserReminder, 'id'>): UserReminder {
  const storage = loadReminders(guildId);

  const newReminder: UserReminder = {
    id: generateId('rem'),
    ...reminder,
  };

  storage.reminders.push(newReminder);
  saveReminders(guildId, storage);

  return newReminder;
}

export function deleteReminder(guildId: string, reminderId: string): boolean {
  const storage = loadReminders(guildId);
  const index = storage.reminders.findIndex(r => r.id === reminderId);

  if (index === -1) return false;

  storage.reminders.splice(index, 1);
  saveReminders(guildId, storage);
  return true;
}

export function getMaxRemindersPerUser(guildId: string): number {
  return getSetting('reminder.maxPerUser', guildId, 1);
}

export function getMaxReminderDuration(guildId: string): number {
  return getSetting('reminder.maxDuration', guildId, 1440);
}

export function getBypassRoles(guildId: string): string[] {
  return getSetting('reminder.bypassRoles', guildId, [] as string[]);
}

// ================== GROUP STORAGE ==================

function createDefaultGroupStorage(): GroupStorage {
  return { groups: [] };
}

export function loadGroups(guildId: string): GroupStorage {
  return loadModuleData<GroupStorage>(
    GROUPS_FILE,
    guildId,
    MODULE_NAME,
    createDefaultGroupStorage()
  );
}

export function saveGroups(guildId: string, storage: GroupStorage): void {
  saveModuleData(GROUPS_FILE, guildId, MODULE_NAME, storage);
}

export function getAllGroups(guildId: string): ScheduledGroup[] {
  return loadGroups(guildId).groups;
}

export function getEnabledGroups(guildId: string): ScheduledGroup[] {
  return getAllGroups(guildId).filter(g => g.enabled);
}

export function getGroup(guildId: string, groupId: string): ScheduledGroup | undefined {
  return getAllGroups(guildId).find(g => g.id === groupId);
}

export function createGroup(guildId: string, group: Partial<ScheduledGroup>): ScheduledGroup | null {
  const storage = loadGroups(guildId);
  const maxGroups = getSetting('scheduled.maxGroups', guildId, 10);

  if (storage.groups.length >= maxGroups) {
    return null;
  }

  const defaultAutoPin = getSetting('scheduled.defaultAutoPin', guildId, false);

  const newGroup: ScheduledGroup = {
    id: generateId('grp'),
    guildId,
    name: group.name || 'New Group',
    enabled: group.enabled ?? true,
    channelId: group.channelId || '',
    messages: group.messages || [],
    selectionMode: group.selectionMode || 'sequential',
    randomOldestPercent: group.randomOldestPercent ?? getSetting('scheduled.randomPercent', guildId, 30),
    loop: group.loop ?? true,  // Default to looping forever
    currentIndex: group.currentIndex ?? 0,
    autoPin: group.autoPin ?? defaultAutoPin,
    schedule: group.schedule || createDefaultSchedule(),
    createdAt: Date.now(),
    lastSentAt: null,
    nextSendAt: null,
  };

  storage.groups.push(newGroup);
  saveGroups(guildId, storage);

  return newGroup;
}

export function updateGroup(guildId: string, groupId: string, updates: Partial<ScheduledGroup>): ScheduledGroup | null {
  const storage = loadGroups(guildId);
  const index = storage.groups.findIndex(g => g.id === groupId);

  if (index === -1) return null;

  storage.groups[index] = {
    ...storage.groups[index],
    ...updates,
    id: groupId,
    guildId,
  };

  saveGroups(guildId, storage);
  return storage.groups[index];
}

export function deleteGroup(guildId: string, groupId: string): boolean {
  const storage = loadGroups(guildId);
  const index = storage.groups.findIndex(g => g.id === groupId);

  if (index === -1) return false;

  storage.groups.splice(index, 1);
  saveGroups(guildId, storage);
  return true;
}

export function toggleGroup(guildId: string, groupId: string): boolean | null {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);

  if (!group) return null;

  group.enabled = !group.enabled;
  saveGroups(guildId, storage);
  return group.enabled;
}

export function toggleAutoPin(guildId: string, groupId: string): boolean | null {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);

  if (!group) return null;

  group.autoPin = !group.autoPin;
  saveGroups(guildId, storage);
  return group.autoPin;
}

// ================== MESSAGE OPERATIONS ==================

export function addMessage(guildId: string, groupId: string, content: string, image?: string): ScheduledMessage | null {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return null;

  const maxMessages = getSetting('scheduled.maxMessagesPerGroup', guildId, 100);
  if (group.messages.length >= maxMessages) return null;

  const newMessage: ScheduledMessage = {
    id: generateId('msg'),
    content,
    sentCount: 0,
    lastSentAt: null,
    createdAt: Date.now(),
    image: image || undefined,
  };

  group.messages.push(newMessage);
  saveGroups(guildId, storage);

  return newMessage;
}

export function updateMessage(guildId: string, groupId: string, messageId: string, content: string, image?: string): ScheduledMessage | null {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return null;

  const message = group.messages.find(m => m.id === messageId);
  if (!message) return null;

  message.content = content;
  message.image = image || undefined;
  saveGroups(guildId, storage);

  return message;
}

export function deleteMessage(guildId: string, groupId: string, messageId: string): boolean {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return false;

  const index = group.messages.findIndex(m => m.id === messageId);
  if (index === -1) return false;

  group.messages.splice(index, 1);

  // Adjust currentIndex if needed
  if (group.currentIndex >= group.messages.length && group.messages.length > 0) {
    group.currentIndex = group.messages.length - 1;
  }

  saveGroups(guildId, storage);
  return true;
}

export function markMessageSent(guildId: string, groupId: string, messageId: string): void {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return;

  const message = group.messages.find(m => m.id === messageId);
  if (!message) return;

  message.sentCount++;
  message.lastSentAt = Date.now();
  group.lastSentAt = Date.now();

  // Clear queue flags after sending
  message.forceNext = undefined;
  message.queuePosition = undefined;

  // Increment currentIndex for sequential mode
  if (group.selectionMode === 'sequential') {
    group.currentIndex++;
  }

  saveGroups(guildId, storage);
}

export function resetAllCounters(guildId: string, groupId: string): boolean {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return false;

  // Reset all message counters
  for (const message of group.messages) {
    message.sentCount = 0;
    message.lastSentAt = null;
  }

  // Reset group's sequential index
  group.currentIndex = 0;

  saveGroups(guildId, storage);
  return true;
}

export function updateMessageSentCount(guildId: string, groupId: string, messageId: string, sentCount: number): boolean {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return false;

  const message = group.messages.find(m => m.id === messageId);
  if (!message) return false;

  message.sentCount = Math.max(0, sentCount);
  saveGroups(guildId, storage);
  return true;
}

export function updateLastPinnedMessage(guildId: string, groupId: string, messageId: string, channelId: string): void {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return;

  group.lastPinnedMessageId = messageId;
  group.lastPinnedChannelId = channelId;
  saveGroups(guildId, storage);
}

export function clearLastPinnedMessage(guildId: string, groupId: string): void {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return;

  group.lastPinnedMessageId = undefined;
  group.lastPinnedChannelId = undefined;
  saveGroups(guildId, storage);
}

/**
 * Set message queue status
 * @param queueMode - 'none' | 'force' | 'queue'
 */
export function setMessageQueueStatus(
  guildId: string,
  groupId: string,
  messageId: string,
  queueMode: 'none' | 'force' | 'queue'
): boolean {
  const storage = loadGroups(guildId);
  const group = storage.groups.find(g => g.id === groupId);
  if (!group) return false;

  const message = group.messages.find(m => m.id === messageId);
  if (!message) return false;

  if (queueMode === 'none') {
    // Clear all queue flags
    message.forceNext = undefined;
    message.queuePosition = undefined;
  } else if (queueMode === 'force') {
    // Clear any existing forceNext on other messages
    for (const msg of group.messages) {
      if (msg.forceNext) {
        msg.forceNext = undefined;
      }
    }
    // Set this message as forced next
    message.forceNext = true;
    message.queuePosition = undefined;
  } else if (queueMode === 'queue') {
    // Get the highest current queue position and add 1
    const maxQueuePos = Math.max(0, ...group.messages.map(m => m.queuePosition || 0));
    message.queuePosition = maxQueuePos + 1;
    message.forceNext = undefined;
  }

  saveGroups(guildId, storage);
  return true;
}

/**
 * Get the current queue mode for a message
 */
export function getMessageQueueMode(message: ScheduledMessage): 'none' | 'force' | 'queue' {
  if (message.forceNext) return 'force';
  if (message.queuePosition && message.queuePosition > 0) return 'queue';
  return 'none';
}

// ================== TIMESTAMP MODULE INTEGRATION ==================

interface UserTimezone {
  utcOffset: number;
  minuteModifier: number;
}

/**
 * Get user's timezone from the timestamp module (if available)
 * Falls back to UTC if the module isn't available or user hasn't set up
 */
export function getUserTimezone(userId: string): UserTimezone {
  try {
    // Try to load from timestamp module's storage
    const timestampStorage = require('@modules/misc/timestamp/utils/storage');
    if (timestampStorage && timestampStorage.loadUserPrefs) {
      const prefs = timestampStorage.loadUserPrefs(userId);
      return {
        utcOffset: prefs.utcOffset ?? 0,
        minuteModifier: prefs.minuteModifier ?? 0,
      };
    }
  } catch {
    // Timestamp module not available
  }

  return { utcOffset: 0, minuteModifier: 0 };
}

// ================== HELPERS ==================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

function createDefaultSchedule(): ScheduleConfig {
  return {
    type: 'daily',
    timeHour: 9,
    timeMinute: 0,
    startDate: Date.now(),
    utcOffset: 0,
    minuteModifier: 0,
  };
}

export function groupNameExists(guildId: string, name: string, excludeId?: string): boolean {
  return getAllGroups(guildId).some(g =>
    g.name.toLowerCase() === name.toLowerCase() && g.id !== excludeId
  );
}

export function getMaxGroups(guildId: string): number {
  return getSetting('scheduled.maxGroups', guildId, 10);
}

export function getMaxMessagesPerGroup(guildId: string): number {
  return getSetting('scheduled.maxMessagesPerGroup', guildId, 100);
}
