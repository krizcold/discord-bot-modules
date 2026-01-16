/**
 * Handler Registry
 * Centralizes all button and modal handler registrations for the giveaway module.
 * This module provides a clean interface for registering all giveaway handlers
 * and follows the Open-Closed Principle.
 */

import { Client, StringSelectMenuInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '@internal/events/interactionCreate/buttonHandler';
import { registerModalHandler } from '@internal/events/interactionCreate/modalSubmitHandler';
import { registerDropdownHandler } from '@internal/events/interactionCreate/dropdownHandler';

// Import constants for prefixes
import {
  GW_ENTER_BTN_PREFIX,
  GW_TRIVIA_ANSWER_BTN_PREFIX,
  GW_TRIVIA_ANSWER_MODAL_PREFIX,
  GW_COMPETITION_ANSWER_BTN_PREFIX,
  GW_COMPETITION_ANSWER_MODAL_PREFIX,
  GW_CLAIM_PRIZE_BTN_PREFIX,
  GW_EDIT_BTN_PREFIX,
  GW_MODAL_PREFIX,
  GW_CHECK_PRIZE_BTN_PREFIX,
  GW_PRIZE_EDIT_BTN_PREFIX,
  GW_PRIZE_NAV_PREFIX,
  GW_PRIZE_RESULTS_NAV_PREFIX,
  GW_PRIZE_RESULTS_BACK_PREFIX,
  CREATE_MODE_DROPDOWN_PREFIX,
} from '../constants';

// Import live giveaway handlers
import {
  handleGiveawayEnterButton,
  handleTriviaAnswerButton,
  handleTriviaAnswerModalSubmit,
  handleCompetitionAnswerButton,
  handleCompetitionAnswerModalSubmit,
  handleClaimPrizeButton,
} from './live';

// Import create panel edit handlers
import {
  handleEditButton,
  handleEditModalSubmit,
  handleCheckPrizeButton,
  handlePrizeEditButton,
  handlePrizeNavButton,
  handlePrizeResultsNavButton,
  handlePrizeResultsBackButton,
} from './createEdit';

// Import state management for mode dropdown
import { getPendingGiveaway, updatePendingGiveaway } from '../state';
import { getPanelManager } from '@internal/utils/panelManager';
import { buildCreatePanelResponse } from '../panels/create';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/**
 * Handler configuration with description for documentation
 */
interface HandlerConfig {
  prefix: string;
  description: string;
}

/**
 * All button handlers for the giveaway module
 */
export const BUTTON_HANDLERS: HandlerConfig[] = [
  // Live Giveaway Handlers
  { prefix: GW_ENTER_BTN_PREFIX, description: 'Button entry for giveaways' },
  { prefix: GW_TRIVIA_ANSWER_BTN_PREFIX, description: 'Trivia answer button' },
  { prefix: GW_COMPETITION_ANSWER_BTN_PREFIX, description: 'Competition answer button' },
  { prefix: GW_CLAIM_PRIZE_BTN_PREFIX, description: 'Prize claim button' },

  // Create Panel Edit Handlers
  { prefix: GW_EDIT_BTN_PREFIX, description: 'Edit giveaway fields' },
  { prefix: GW_CHECK_PRIZE_BTN_PREFIX, description: 'Check prize (spoilered)' },

  // Prize Manager Handlers
  { prefix: GW_PRIZE_EDIT_BTN_PREFIX, description: 'Edit individual prize' },
  { prefix: GW_PRIZE_NAV_PREFIX, description: 'Prize manager navigation' },

  // Prize Results Handlers
  { prefix: GW_PRIZE_RESULTS_NAV_PREFIX, description: 'Prize results navigation' },
  { prefix: GW_PRIZE_RESULTS_BACK_PREFIX, description: 'Prize results back button' },
];

/**
 * All modal handlers for the giveaway module
 */
export const MODAL_HANDLERS: HandlerConfig[] = [
  { prefix: GW_TRIVIA_ANSWER_MODAL_PREFIX, description: 'Trivia answer submission' },
  { prefix: GW_COMPETITION_ANSWER_MODAL_PREFIX, description: 'Competition answer submission' },
  { prefix: GW_MODAL_PREFIX, description: 'Giveaway edit modal submissions' },
];

/**
 * Register all giveaway button and modal handlers with the client.
 * This centralizes handler registration and ensures consistency.
 *
 * @param client - Discord client instance
 */
export function registerGiveawayHandlers(client: Client): void {
  // === Live Giveaway Handlers ===
  // timeoutMs: null disables expiration (giveaways can run for days)

  // Button Entry
  registerButtonHandler(client, GW_ENTER_BTN_PREFIX, handleGiveawayEnterButton, { timeoutMs: null });

  // Trivia Entry
  registerButtonHandler(client, GW_TRIVIA_ANSWER_BTN_PREFIX, handleTriviaAnswerButton, { timeoutMs: null });
  registerModalHandler(client, GW_TRIVIA_ANSWER_MODAL_PREFIX, handleTriviaAnswerModalSubmit);

  // Competition Entry
  registerButtonHandler(client, GW_COMPETITION_ANSWER_BTN_PREFIX, handleCompetitionAnswerButton, { timeoutMs: null });
  registerModalHandler(client, GW_COMPETITION_ANSWER_MODAL_PREFIX, handleCompetitionAnswerModalSubmit);

  // Claim Prize
  registerButtonHandler(client, GW_CLAIM_PRIZE_BTN_PREFIX, handleClaimPrizeButton, { timeoutMs: null });

  // === Create Panel Edit Handlers ===
  // These bypass the panel system to allow modals
  // Uses gw_edit_ and gw_modal_ prefixes instead of panel_ prefix
  // timeoutMs: null disables expiration (needed for persistent panels)

  registerButtonHandler(client, GW_EDIT_BTN_PREFIX, handleEditButton, { timeoutMs: null });
  registerModalHandler(client, GW_MODAL_PREFIX, handleEditModalSubmit);

  // Check Prize button (shows ephemeral spoilered prize)
  registerButtonHandler(client, GW_CHECK_PRIZE_BTN_PREFIX, handleCheckPrizeButton, { timeoutMs: null });

  // === Prize Manager Handlers ===
  // Multi-prize system for creating/editing prizes

  registerButtonHandler(client, GW_PRIZE_EDIT_BTN_PREFIX, handlePrizeEditButton, { timeoutMs: null });
  registerButtonHandler(client, GW_PRIZE_NAV_PREFIX, handlePrizeNavButton, { timeoutMs: null });

  // === Prize Results Handlers ===
  // View mode for active/ended giveaways

  registerButtonHandler(client, GW_PRIZE_RESULTS_NAV_PREFIX, handlePrizeResultsNavButton, { timeoutMs: null });
  registerButtonHandler(client, GW_PRIZE_RESULTS_BACK_PREFIX, handlePrizeResultsBackButton, { timeoutMs: null });

  // === Create Panel Dropdown Handlers ===
  // Mode selection dropdown
  // timeoutMs: null disables expiration (needed for persistent panels)

  registerDropdownHandler(client, CREATE_MODE_DROPDOWN_PREFIX, async (client: Client, interaction: StringSelectMenuInteraction) => {
    const guildId = interaction.guildId;
    if (!guildId) {
      logger.debug('[Dropdown] No guildId, ignoring');
      return;
    }

    // Parse pendingId from customId: gw_create_mode_{pendingId}
    const customId = interaction.customId;
    const pendingId = customId.slice(CREATE_MODE_DROPDOWN_PREFIX.length + 1);
    logger.debug(`[Dropdown] Mode dropdown - customId: ${customId}, pendingId: ${pendingId}, selected: ${interaction.values[0]}`);

    if (!pendingId) {
      console.log('[GiveawayDropdown] No pendingId parsed from customId');
      return;
    }

    const selectedMode = interaction.values[0] as 'button' | 'reaction' | 'trivia' | 'competition';
    const pending = getPendingGiveaway(guildId, pendingId);
    if (!pending) {
      console.log(`[GiveawayDropdown] Pending giveaway not found: ${pendingId}`);
      await interaction.reply({ content: 'Giveaway not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Update the mode
    updatePendingGiveaway(guildId, pendingId, { entryMode: selectedMode });
    const updatedPending = getPendingGiveaway(guildId, pendingId);
    if (!updatedPending) {
      console.log('[GiveawayDropdown] Failed to get updated pending after update');
      return;
    }

    // Build context for panel response
    const panelManager = getPanelManager(client);
    const context = panelManager.createDirectCommandContext('giveaway', interaction, client);

    const response = buildCreatePanelResponse(context, updatedPending);
    console.log(`[GiveawayDropdown] Updating panel with new mode: ${selectedMode}`);
    await interaction.update({ embeds: response.embeds, components: response.components });
  }, null); // null = never expires (needed for persistent panels)
}

/**
 * Get all registered handler prefixes (for debugging/documentation)
 */
export function getRegisteredPrefixes(): { buttons: string[]; modals: string[] } {
  return {
    buttons: BUTTON_HANDLERS.map(h => h.prefix),
    modals: MODAL_HANDLERS.map(h => h.prefix),
  };
}
