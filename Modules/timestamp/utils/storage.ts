// User Preferences Storage for Timestamp Module

import { loadGlobalModuleData, saveGlobalModuleData } from '@internal/utils/dataManager';
import { UserTimestampPrefs, DEFAULT_USER_PREFS } from '../types/timestamp';

const MODULE_NAME = 'timestamp';
const PREFS_FILE = 'userPrefs.json';

/**
 * Storage structure for all users
 */
interface UserPrefsStorage {
  [userId: string]: UserTimestampPrefs;
}

/**
 * Load user's timestamp preferences
 * Returns defaults if user has no saved preferences
 */
export function loadUserPrefs(userId: string): UserTimestampPrefs {
  const allPrefs = loadGlobalModuleData<UserPrefsStorage>(PREFS_FILE, MODULE_NAME, {});

  if (allPrefs[userId]) {
    // Merge with defaults to ensure all fields exist (in case of schema updates)
    return {
      ...DEFAULT_USER_PREFS,
      ...allPrefs[userId],
    };
  }

  return { ...DEFAULT_USER_PREFS };
}

/**
 * Save user's timestamp preferences
 */
export function saveUserPrefs(userId: string, prefs: UserTimestampPrefs): void {
  const allPrefs = loadGlobalModuleData<UserPrefsStorage>(PREFS_FILE, MODULE_NAME, {});

  allPrefs[userId] = {
    ...prefs,
    lastUsed: new Date().toISOString(),
  };

  saveGlobalModuleData(PREFS_FILE, MODULE_NAME, allPrefs);
}

/**
 * Check if user has completed first-time setup
 */
export function hasCompletedSetup(userId: string): boolean {
  const prefs = loadUserPrefs(userId);
  return prefs.setupComplete;
}

/**
 * Update specific preference fields without overwriting others
 */
export function updateUserPrefs(userId: string, updates: Partial<UserTimestampPrefs>): UserTimestampPrefs {
  const currentPrefs = loadUserPrefs(userId);
  const newPrefs = {
    ...currentPrefs,
    ...updates,
    lastUsed: new Date().toISOString(),
  };

  saveUserPrefs(userId, newPrefs);
  return newPrefs;
}

/**
 * Mark user's setup as complete
 */
export function markSetupComplete(userId: string): UserTimestampPrefs {
  return updateUserPrefs(userId, { setupComplete: true });
}
