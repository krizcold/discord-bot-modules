/**
 * Configuration utility functions for the Hall of Fame module
 * Provides centralized access to module settings from settingsSchema.json
 */

import { getModuleSetting } from '@internal/utils/settings/settingsStorage';

const MODULE_NAME = 'halloffame';
const CATEGORY = 'fun';

/**
 * Interface for Hall of Fame configuration
 */
export interface HallOfFameConfig {
  // Display settings
  itemsPerPage: number;
  nameDisplayCap: number;

  // Default board values
  defaults: {
    minReactions: number;
    removalThreshold: number;
    embedColor: number;
    allowSelfReact: boolean;
    autoReact: boolean;
    syncEdits: boolean;
    syncDeletes: boolean;
  };

  // Panel colors
  colors: {
    mainPanel: number;
    createPanel: number;
    detailPanel: number;
  };
}

/**
 * Parse a hex color string to a number for Discord embeds
 * Accepts: "0x5865F2", "#5865F2", "5865F2"
 */
export function parseColorString(colorStr: string): number {
  if (!colorStr) return 0x5865F2; // Default Discord blurple

  let cleaned = colorStr.trim();

  // Remove 0x prefix
  if (cleaned.toLowerCase().startsWith('0x')) {
    cleaned = cleaned.slice(2);
  }

  // Remove # prefix
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.slice(1);
  }

  const num = parseInt(cleaned, 16);
  if (isNaN(num) || num < 0 || num > 0xFFFFFF) {
    return 0x5865F2;
  }

  return num;
}

/**
 * Get the Hall of Fame configuration for a specific guild
 * Merges schema defaults with any guild-specific overrides
 *
 * @param guildId - The guild ID to get configuration for (null for global)
 * @returns The merged configuration object
 */
export function getHofConfig(guildId: string | null): HallOfFameConfig {
  // Display settings
  const itemsPerPage = getModuleSetting<number>(MODULE_NAME, 'itemsPerPage', guildId, CATEGORY) ?? 8;
  const nameDisplayCap = getModuleSetting<number>(MODULE_NAME, 'nameDisplayCap', guildId, CATEGORY) ?? 25;

  // Default board values
  const defaultMinReactions = getModuleSetting<number>(MODULE_NAME, 'defaultMinReactions', guildId, CATEGORY) ?? 3;
  const defaultRemovalThreshold = getModuleSetting<number>(MODULE_NAME, 'defaultRemovalThreshold', guildId, CATEGORY) ?? 0;
  const defaultEmbedColorStr = getModuleSetting<string>(MODULE_NAME, 'defaultEmbedColor', guildId, CATEGORY) ?? '0xFFD700';
  const defaultAllowSelfReact = getModuleSetting<boolean>(MODULE_NAME, 'defaultAllowSelfReact', guildId, CATEGORY) ?? false;
  const defaultAutoReact = getModuleSetting<boolean>(MODULE_NAME, 'defaultAutoReact', guildId, CATEGORY) ?? true;
  const defaultSyncEdits = getModuleSetting<boolean>(MODULE_NAME, 'defaultSyncEdits', guildId, CATEGORY) ?? true;
  const defaultSyncDeletes = getModuleSetting<boolean>(MODULE_NAME, 'defaultSyncDeletes', guildId, CATEGORY) ?? true;

  // Panel colors
  const colorMainPanelStr = getModuleSetting<string>(MODULE_NAME, 'colorMainPanel', guildId, CATEGORY) ?? '0x5865F2';
  const colorCreatePanelStr = getModuleSetting<string>(MODULE_NAME, 'colorCreatePanel', guildId, CATEGORY) ?? '0xF39C12';
  const colorDetailPanelStr = getModuleSetting<string>(MODULE_NAME, 'colorDetailPanel', guildId, CATEGORY) ?? '0x2ECC71';

  return {
    itemsPerPage,
    nameDisplayCap,
    defaults: {
      minReactions: defaultMinReactions,
      removalThreshold: defaultRemovalThreshold,
      embedColor: parseColorString(defaultEmbedColorStr),
      allowSelfReact: defaultAllowSelfReact,
      autoReact: defaultAutoReact,
      syncEdits: defaultSyncEdits,
      syncDeletes: defaultSyncDeletes,
    },
    colors: {
      mainPanel: parseColorString(colorMainPanelStr),
      createPanel: parseColorString(colorCreatePanelStr),
      detailPanel: parseColorString(colorDetailPanelStr),
    },
  };
}

/**
 * Get a specific color from the configuration
 */
export function getConfigColor(
  colorKey: keyof HallOfFameConfig['colors'],
  guildId: string | null
): number {
  const config = getHofConfig(guildId);
  return config.colors[colorKey];
}

/**
 * Get the default board values from settings
 */
export function getDefaultBoardValues(guildId: string | null): HallOfFameConfig['defaults'] {
  const config = getHofConfig(guildId);
  return config.defaults;
}

/**
 * Get display settings
 */
export function getDisplaySettings(guildId: string | null): { itemsPerPage: number; nameDisplayCap: number } {
  const config = getHofConfig(guildId);
  return {
    itemsPerPage: config.itemsPerPage,
    nameDisplayCap: config.nameDisplayCap,
  };
}
