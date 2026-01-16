/**
 * Giveaway Create Panel Handlers
 *
 * Handles button and modal interactions for the create panel sub-panel.
 * Uses modal factory for consistent modal creation.
 */

import {
  ModalSubmitInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonInteraction,
} from 'discord.js';
import { PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { StoredPendingGiveaway, isSendableChannel } from '../types';
import { Giveaway } from '@bot/types/commandTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { closePanelWithSuccess } from '@internal/utils/panel/panelResponseUtils';
import { registerReactionHandler } from '@internal/events/messageReactionAdd/reactionHandler';
import * as giveawayManager from '../manager/giveawayManager';
import { buildGiveawayAnnouncementV2, MessageFlags } from '../utils/embedBuilder';
import {
  getPendingGiveaway,
  updatePendingGiveaway,
  deletePendingGiveaway,
} from '../state';
import { buildCreatePanelResponse } from './create';
import { buildMainPanelResponse } from './main';
import { buildPrizeManagerResponse } from './prizeManager';
import {
  parseCreateButtonId,
  parseCreateModalId,
  CREATE_BTN_TITLE,
  CREATE_BTN_PRIZE,
  CREATE_BTN_DURATION,
  CREATE_BTN_WINNERS,
  CREATE_BTN_READY,
  CREATE_BTN_START,
  CREATE_BTN_DELETE,
  CREATE_BTN_BACK,
  CREATE_BTN_REACTION,
  CREATE_BTN_TRIVIA_QA,
  CREATE_BTN_TRIVIA_ATTEMPTS,
  CREATE_BTN_COMPETITION_LEADERBOARD,
  CREATE_MODE_DROPDOWN_PREFIX,
  MODAL_TITLE,
  MODAL_PRIZE,
  MODAL_DURATION,
  MODAL_WINNERS,
  MODAL_REACTION,
  MODAL_TRIVIA_QA,
  MODAL_TRIVIA_ATTEMPTS,
  PRIZE_PANEL_PREFIX,
} from '../constants';
import {
  createTitleModal,
  createPrizeModal,
  createDurationModal,
  createWinnersModal,
  createReactionModal,
  createTriviaQAModal,
  createTriviaAttemptsModal,
  showModal,
} from '../utils/modalFactory';
import { formatDurationDisplay } from '../utils/displayFormatters';
import { parseEmoji, resolveEmojisInText } from '@internal/utils/emojiHandler';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/**
 * Start a giveaway from the create panel
 * Sends announcement to the current channel and registers the giveaway
 */
async function handleStartGiveaway(
  context: PanelContext,
  pending: StoredPendingGiveaway
): Promise<PanelResponse> {
  const guildId = context.guildId!;
  const { client, interaction, channelId } = context;

  // Get the channel - prefer context.channelId (Web-UI), fall back to interaction.channel (Discord)
  let channel: any = null;

  if (channelId && client) {
    try {
      const fetchedChannel = await client.channels.fetch(channelId);
      if (fetchedChannel && isSendableChannel(fetchedChannel)) {
        channel = fetchedChannel as any;
      }
    } catch (error) {
      logger.error('Failed to fetch channel:', error);
      return buildErrorResponse('Could not access the selected channel. It may have been deleted.');
    }
  } else if (interaction && 'channel' in interaction && interaction.channel) {
    channel = interaction.channel as any;
  }

  if (!channel) {
    return buildErrorResponse('Could not determine the channel to start the giveaway in.');
  }

  if (!isSendableChannel(channel)) {
    return buildErrorResponse('Cannot start a giveaway in this channel type.');
  }

  // Create the giveaway object
  const actualEndTime = Date.now() + (pending.durationMs || 3600000);
  const winnerCount = pending.winnerCount || 1;
  const prizes: string[] = pending.prizes || [];

  const giveaway: Giveaway = {
    guildId,
    channelId: channel.id,
    messageId: '', // Will be set after sending
    id: pending.id,
    title: pending.title || 'Untitled Giveaway',
    prizes,
    endTime: actualEndTime,
    startTime: Date.now(),
    creatorId: pending.createdBy,
    entryMode: pending.entryMode || 'button',
    winnerCount,
    participants: [],
    winners: [],
    ended: false,
    cancelled: false,
    triviaQuestion: pending.triviaQuestion,
    triviaAnswer: pending.triviaAnswer,
    maxTriviaAttempts: (pending.maxTriviaAttempts === undefined || pending.maxTriviaAttempts <= 0) ? -1 : pending.maxTriviaAttempts,
    reactionIdentifier: pending.reactionIdentifier,
    reactionDisplayEmoji: pending.reactionDisplayEmoji,
    requiredRoles: pending.requiredRoles,
    blockedRoles: pending.blockedRoles,
    scheduledStartTime: undefined,
    liveLeaderboard: pending.liveLeaderboard,
    competitionPlacements: pending.entryMode === 'competition' ? {} : undefined,
  };

  // Get the user from interaction (Discord) or fetch by creatorId (Web-UI)
  let user = interaction?.user;
  if (!user && client && pending.createdBy) {
    try {
      user = await client.users.fetch(pending.createdBy);
    } catch (e) {
      logger.warn('Could not fetch user for giveaway announcement:', e);
    }
  }

  // Build V2 announcement container and components
  const { container, components } = buildGiveawayAnnouncementV2(giveaway, user, guildId);

  try {
    // Send the V2 announcement message
    const announcementMessage = await channel.send({
      components: components.length > 0 ? [container, ...components] : [container],
      flags: MessageFlags.IsComponentsV2,
    });

    if (!announcementMessage) {
      return buildErrorResponse('Failed to send giveaway announcement message.');
    }

    // Update giveaway with message ID and save
    giveaway.messageId = announcementMessage.id;
    giveaway.channelId = announcementMessage.channelId;

    const createdGiveaway = giveawayManager.addGiveaway(giveaway, guildId);
    if (!createdGiveaway) {
      return buildErrorResponse('Failed to create giveaway record.');
    }

    // Delete the pending giveaway
    deletePendingGiveaway(guildId, pending.id);

    // Register reaction handler if needed
    if (createdGiveaway.entryMode === 'reaction' && createdGiveaway.reactionIdentifier && createdGiveaway.reactionDisplayEmoji) {
      registerReactionHandler(
        context.client,
        createdGiveaway.messageId,
        createdGiveaway.reactionIdentifier,
        async (client, reaction, user) => {
          if (reaction.message.id === createdGiveaway.messageId && !user.bot) {
            giveawayManager.addParticipant(createdGiveaway.id, user.id, guildId);
          }
        },
        { endTime: createdGiveaway.endTime, guildId: createdGiveaway.guildId }
      );

      // Add initial reaction
      try {
        await announcementMessage.react(createdGiveaway.reactionDisplayEmoji);
      } catch (e) {
        logger.error('Failed to add reaction to giveaway:', e);
      }
    }

    // Schedule the giveaway end
    giveawayManager.scheduleGiveawayEnd(context.client, createdGiveaway);

    // Return success with notification - close the panel
    // Silent on Discord (just defer+delete), Web-UI still shows popup
    return closePanelWithSuccess('Giveaway started successfully!', undefined, true);
  } catch (error) {
    logger.error('Error starting giveaway:', error);
    return buildErrorResponse('An error occurred while starting the giveaway.');
  }
}

/**
 * Build an error response using V2 components
 */
function buildErrorResponse(message: string): PanelResponse {
  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.danger)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ❌ Error\n${message}`)
    );

  return createV2Response([container]);
}

/**
 * Handle create panel button interactions
 * @returns PanelResponse or null if button showed a modal
 */
export async function handleCreatePanelButton(
  context: PanelContext,
  buttonId: string
): Promise<PanelResponse | null> {
  const parsed = parseCreateButtonId(`panel_giveaway_btn_${buttonId}`);

  if (!parsed) {
    // Fallback: Try parsing directly from buttonId
    const parts = buttonId.split('_');
    if (parts[0] !== 'create' || parts.length < 3) {
      return null;
    }
    const pendingId = parts[1];
    const action = parts.slice(2).join('_');
    return handleCreateAction(context, pendingId, action);
  }

  return handleCreateAction(context, parsed.pendingId, parsed.action);
}

/**
 * Handle a specific create action
 */
async function handleCreateAction(
  context: PanelContext,
  pendingId: string,
  action: string
): Promise<PanelResponse | null> {
  const guildId = context.guildId!;
  const pending = getPendingGiveaway(guildId, pendingId);

  if (!pending) {
    return buildErrorResponse('Giveaway not found. It may have been deleted.');
  }

  // Handle modal-showing actions
  const modalActions: Record<string, () => Promise<void>> = {
    [CREATE_BTN_TITLE]: () => showModal(context.interaction, createTitleModal(pendingId, pending.title)),
    [CREATE_BTN_PRIZE]: () => showModal(context.interaction, createPrizeModal(pendingId, pending.prizes?.[0])),
    [CREATE_BTN_DURATION]: () => showModal(context.interaction, createDurationModal(pendingId, formatDurationDisplay(pending.durationMs))),
    [CREATE_BTN_WINNERS]: () => showModal(context.interaction, createWinnersModal(pendingId, pending.winnerCount)),
    [CREATE_BTN_REACTION]: () => showModal(context.interaction, createReactionModal(pendingId, pending.reactionEmojiInput || pending.reactionDisplayEmoji)),
    [CREATE_BTN_TRIVIA_QA]: () => showModal(context.interaction, createTriviaQAModal(pendingId, pending.triviaQuestion, pending.triviaAnswer)),
    [CREATE_BTN_TRIVIA_ATTEMPTS]: () => showModal(context.interaction, createTriviaAttemptsModal(pendingId, pending.maxTriviaAttempts)),
  };

  if (modalActions[action]) {
    await modalActions[action]();
    return null; // Modal shown, no update response
  }

  // Handle leaderboard toggle for competition mode
  if (action === CREATE_BTN_COMPETITION_LEADERBOARD) {
    const currentValue = pending.liveLeaderboard !== false; // Default true
    updatePendingGiveaway(guildId, pendingId, { liveLeaderboard: !currentValue });
    const updatedPending = getPendingGiveaway(guildId, pendingId);
    if (updatedPending) return buildCreatePanelResponse(context, updatedPending);
  }

  // Handle back button
  if (action === CREATE_BTN_BACK) {
    // Delete empty giveaway if going back
    const hasPrize = pending.prizes?.[0];
    if (pending.title === 'Untitled Giveaway' && !hasPrize) {
      deletePendingGiveaway(guildId, pendingId);
    }
    return buildMainPanelResponse(context, 0);
  }

  // Handle delete button
  if (action === CREATE_BTN_DELETE) {
    deletePendingGiveaway(guildId, pendingId);
    return buildMainPanelResponse(context, 0);
  }

  // Handle ready button (save for later)
  if (action === CREATE_BTN_READY) {
    updatePendingGiveaway(guildId, pendingId, { status: 'ready' });
    return buildMainPanelResponse(context, 0);
  }

  // Handle start button - actually start the giveaway in the current channel
  if (action === CREATE_BTN_START) {
    return await handleStartGiveaway(context, pending);
  }

  // Handle prizes button (navigate to Prize Manager for multi-winner)
  if (action === PRIZE_PANEL_PREFIX) {
    return buildPrizeManagerResponse(context, pendingId, 0);
  }

  // Handle back from Prize Manager
  if (action === 'back_from_prizes') {
    return buildCreatePanelResponse(context, pending);
  }

  // Default: refresh create panel
  return buildCreatePanelResponse(context, pending);
}

/**
 * Handle create panel modal submissions
 */
export async function handleCreatePanelModal(
  context: PanelContext,
  modalId: string
): Promise<PanelResponse> {
  const parsed = parseCreateModalId(`panel_giveaway_modal_${modalId}`);

  if (!parsed) {
    // Fallback: modalId format is {modalType}_{pendingId}
    // UUID is always 36 characters, modalType can contain underscores (e.g., trivia_qa)
    if (modalId.length < 38) { // at least 1 char + underscore + 36 UUID
      return buildErrorResponse('Invalid modal ID.');
    }
    const pendingId = modalId.slice(-36); // Last 36 chars is UUID
    const modalType = modalId.slice(0, modalId.length - 37); // Everything before underscore and UUID
    if (!modalType) {
      return buildErrorResponse('Invalid modal ID.');
    }
    return processModalSubmission(context, modalType, pendingId);
  }

  return processModalSubmission(context, parsed.modalType, parsed.pendingId);
}

/**
 * Process modal submission data
 */
async function processModalSubmission(
  context: PanelContext,
  modalType: string,
  pendingId: string
): Promise<PanelResponse> {
  const guildId = context.guildId!;
  const pending = getPendingGiveaway(guildId, pendingId);

  if (!pending) {
    return buildErrorResponse('Giveaway not found. It may have been deleted.');
  }

  const interaction = context.interaction;
  if (!interaction || !('fields' in interaction)) {
    return buildCreatePanelResponse(context, pending);
  }

  // Type-safe access to modal fields after type guard
  const modalInteraction = interaction as ModalSubmitInteraction;
  const fields = modalInteraction.fields;

  // Modal handlers mapped by type
  const handlers: Record<string, () => void> = {
    [MODAL_TITLE]: () => {
      const title = fields.getTextInputValue('title')?.trim();
      if (title) updatePendingGiveaway(guildId, pendingId, { title });
    },
    [MODAL_PRIZE]: () => {
      let prize = fields.getTextInputValue('prize')?.trim();
      if (prize && context.client) {
        // Resolve emoji shortcodes in prize text
        const guild = context.interaction && 'guild' in context.interaction
          ? context.interaction.guild
          : null;
        prize = resolveEmojisInText(prize, context.client, guild);
        // Always store in prizes array for consistency
        const prizes = [...(pending.prizes || [])];
        prizes[0] = prize;
        updatePendingGiveaway(guildId, pendingId, { prizes });
      }
    },
    [MODAL_DURATION]: () => {
      const durationStr = fields.getTextInputValue('duration')?.trim();
      if (durationStr) {
        const durationMs = giveawayManager.parseDuration(durationStr);
        if (durationMs && durationMs > 0) {
          updatePendingGiveaway(guildId, pendingId, { durationMs });
        }
      }
    },
    [MODAL_WINNERS]: () => {
      const winnersStr = fields.getTextInputValue('winners')?.trim();
      if (winnersStr) {
        const winnerCount = parseInt(winnersStr, 10);
        if (!isNaN(winnerCount) && winnerCount > 0 && winnerCount <= 100) {
          updatePendingGiveaway(guildId, pendingId, { winnerCount });
        }
      }
    },
    [MODAL_REACTION]: () => {
      const emojiInput = fields.getTextInputValue('emoji')?.trim();
      if (emojiInput && context.client) {
        // Get guild for emoji lookup
        const guild = context.interaction && 'guild' in context.interaction
          ? context.interaction.guild
          : null;

        // Use emoji parser to handle all formats
        const result = parseEmoji(emojiInput, context.client, guild);
        if (result.success && result.identifier && result.displayEmoji) {
          updatePendingGiveaway(guildId, pendingId, {
            reactionIdentifier: result.identifier,
            reactionDisplayEmoji: result.displayEmoji,
          });
        }
      }
    },
    [MODAL_TRIVIA_QA]: () => {
      const question = fields.getTextInputValue('question')?.trim();
      const answer = fields.getTextInputValue('answer')?.trim();
      if (question && answer) {
        updatePendingGiveaway(guildId, pendingId, { triviaQuestion: question, triviaAnswer: answer });
      }
    },
    [MODAL_TRIVIA_ATTEMPTS]: () => {
      const attemptsStr = fields.getTextInputValue('attempts')?.trim();
      if (attemptsStr) {
        const attempts = parseInt(attemptsStr, 10);
        const maxTriviaAttempts = isNaN(attempts) || attempts <= 0 ? -1 : attempts;
        updatePendingGiveaway(guildId, pendingId, { maxTriviaAttempts });
      }
    },
  };

  // Execute handler if exists
  if (handlers[modalType]) {
    handlers[modalType]();
  } else if (modalType.startsWith('prize_')) {
    // Handle prize_{index} modal submissions from Prize Manager
    const prizeIndex = parseInt(modalType.slice(6), 10);
    if (!isNaN(prizeIndex)) {
      let prize = fields.getTextInputValue('prize')?.trim();
      if (prize && context.client) {
        // Resolve emoji shortcodes in prize text
        const guild = context.interaction && 'guild' in context.interaction
          ? context.interaction.guild
          : null;
        prize = resolveEmojisInText(prize, context.client, guild);
        const prizes = [...(pending.prizes || [])];
        // Expand array if needed
        while (prizes.length <= prizeIndex) {
          prizes.push('');
        }
        prizes[prizeIndex] = prize;
        updatePendingGiveaway(guildId, pendingId, { prizes });

        // Return to Prize Manager panel after saving
        const updatedPending = getPendingGiveaway(guildId, pendingId);
        if (updatedPending) {
          return buildPrizeManagerResponse(context, pendingId, Math.floor(prizeIndex / 5)); // 5 prizes per page
        }
      }
    }
  }

  // Return updated panel
  const updatedPending = getPendingGiveaway(guildId, pendingId);
  if (!updatedPending) return buildMainPanelResponse(context, 0);
  return buildCreatePanelResponse(context, updatedPending);
}

/**
 * Handle create panel dropdown interactions (mode selection)
 * This handles the web UI path - Discord uses a direct handler in registry.ts
 */
export async function handleCreatePanelDropdown(
  context: PanelContext,
  dropdownId: string,
  values: string[]
): Promise<PanelResponse | null> {
  const guildId = context.guildId;
  if (!guildId) {
    return buildErrorResponse('This panel can only be used in a server.');
  }

  // Check if this is the mode dropdown
  // dropdownId format from panel system: "gw_create_mode_{pendingId}" or just the dropdown ID part
  let pendingId: string | null = null;

  if (dropdownId.startsWith(CREATE_MODE_DROPDOWN_PREFIX)) {
    // Full customId: gw_create_mode_{pendingId}
    pendingId = dropdownId.slice(CREATE_MODE_DROPDOWN_PREFIX.length + 1);
  } else if (dropdownId.startsWith('mode_')) {
    // Panel-style: mode_{pendingId}
    pendingId = dropdownId.slice(5);
  }

  if (!pendingId || values.length === 0) {
    logger.warn(`[CreatePanelDropdown] Invalid dropdown: id=${dropdownId}, values=${values}`);
    return null;
  }

  const selectedMode = values[0] as 'button' | 'reaction' | 'trivia' | 'competition';
  const pending = getPendingGiveaway(guildId, pendingId);

  if (!pending) {
    return buildErrorResponse('Giveaway not found. It may have been deleted.');
  }

  // Update the mode
  updatePendingGiveaway(guildId, pendingId, { entryMode: selectedMode });
  const updatedPending = getPendingGiveaway(guildId, pendingId);

  if (!updatedPending) {
    return buildErrorResponse('Failed to update giveaway mode.');
  }

  logger.info(`[CreatePanelDropdown] Updated mode to ${selectedMode} for pending ${pendingId}`);
  return buildCreatePanelResponse(context, updatedPending);
}
