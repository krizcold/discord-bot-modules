/**
 * Configuration utility functions for the Giveaway module
 * This file provides centralized access to giveaway configuration settings
 * and avoids duplicating config loading logic across multiple files.
 */

import { getMergedConfig } from '@internal/utils/configManager';

/**
 * Interface for Giveaway configuration
 */
export interface GiveawayConfig {
  // Display settings
  itemsPerPage: number;
  nameDisplayCap: number;

  // Color configuration for different panels/embeds
  colors: {
    createPanel: string;
    listPanel: string;
    mainPanel: string;
    detailPanelActive: string;
    detailPanelEnded: string;
    detailPanelCancelled: string;
    activeGiveaway: string;
  };

  // Button labels
  labels: {
    enterButton: string;
    triviaButton: string;
  };
}

/**
 * Get the giveaway configuration for a specific guild
 * Merges schema defaults with any guild-specific or global overrides
 *
 * @param guildId - The guild ID to get configuration for
 * @returns The merged configuration object
 */
export function getGiveawayConfig(guildId: string | null): GiveawayConfig {
  const config = getMergedConfig('giveaway-config.json', guildId);

  // Transform the flat config into our structured interface
  // This handles both old-style flat configs and new nested configs
  return {
    itemsPerPage: config.properties?.itemsPerPage?.value ?? 10,
    nameDisplayCap: config.properties?.nameDisplayCap?.value ?? 25,

    colors: {
      createPanel: config.properties?.['colors.createPanel']?.value ?? '0x5865F2',
      listPanel: config.properties?.['colors.listPanel']?.value ?? '0x1ABC9C',
      mainPanel: config.properties?.['colors.mainPanel']?.value ?? '0x5865F2',
      detailPanelActive: config.properties?.['colors.detailPanelActive']?.value ?? '0x2ECC71',
      detailPanelEnded: config.properties?.['colors.detailPanelEnded']?.value ?? '0xF39C12',
      detailPanelCancelled: config.properties?.['colors.detailPanelCancelled']?.value ?? '0xE91E63',
      activeGiveaway: config.properties?.['colors.activeGiveaway']?.value ?? '0x2ECC71'
    },

    labels: {
      enterButton: config.properties?.['labels.enterButton']?.value ?? '🎉 Enter Giveaway',
      triviaButton: config.properties?.['labels.triviaButton']?.value ?? '✏️ Answer Trivia'
    }
  };
}

/**
 * Parse a hex color string to a number for Discord embeds
 *
 * @param colorStr - Hex color string (e.g., "0x5865F2" or "#5865F2")
 * @returns Parsed color number for Discord embeds
 */
export function parseColor(colorStr: string): number {
  // Handle both 0x and # prefixes
  if (colorStr.startsWith('#')) {
    return parseInt(colorStr.replace('#', '0x'));
  }
  if (colorStr.startsWith('0x')) {
    return parseInt(colorStr);
  }
  // Assume it's a hex string without prefix
  return parseInt(`0x${colorStr}`);
}

/**
 * Get a specific color from the configuration
 *
 * @param colorKey - The color key to retrieve
 * @param guildId - The guild ID for configuration
 * @returns The parsed color number
 */
export function getConfigColor(
  colorKey: keyof GiveawayConfig['colors'],
  guildId: string | null
): number {
  const config = getGiveawayConfig(guildId);
  return parseColor(config.colors[colorKey]);
}

/**
 * Get a specific label from the configuration
 *
 * @param labelKey - The label key to retrieve
 * @param guildId - The guild ID for configuration
 * @returns The label string
 */
export function getConfigLabel(
  labelKey: keyof GiveawayConfig['labels'],
  guildId: string | null
): string {
  const config = getGiveawayConfig(guildId);
  return config.labels[labelKey];
}