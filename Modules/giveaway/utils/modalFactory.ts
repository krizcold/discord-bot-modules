/**
 * Modal factory for the giveaway module
 * Reduces duplication in modal creation across handlers
 */

import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { buildGwModalId, MODAL_TITLE, MODAL_PRIZE, MODAL_DURATION, MODAL_WINNERS, MODAL_REACTION, MODAL_TRIVIA_QA, MODAL_TRIVIA_ATTEMPTS } from '../constants';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/** Type guard for checking if interaction supports showing modals */
function hasShowModal(interaction: unknown): interaction is { showModal: (modal: ModalBuilder) => Promise<void> } {
  return (
    interaction !== null &&
    interaction !== undefined &&
    typeof interaction === 'object' &&
    'showModal' in interaction &&
    typeof (interaction as { showModal: unknown }).showModal === 'function'
  );
}

// ============================================================================
// Modal Configuration Types
// ============================================================================

export interface TextInputConfig {
  customId: string;
  label: string;
  style?: 'short' | 'paragraph';
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

export interface ModalConfig {
  customId: string;
  title: string;
  inputs: TextInputConfig[];
}

// ============================================================================
// Generic Modal Builder
// ============================================================================

/**
 * Create a modal from configuration
 */
export function createModal(config: ModalConfig): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(config.customId)
    .setTitle(config.title);

  for (const input of config.inputs) {
    const textInput = new TextInputBuilder()
      .setCustomId(input.customId)
      .setLabel(input.label)
      .setStyle(input.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short);

    if (input.placeholder) textInput.setPlaceholder(input.placeholder);
    if (input.value !== undefined) textInput.setValue(input.value);
    if (input.required !== undefined) textInput.setRequired(input.required);
    if (input.minLength !== undefined) textInput.setMinLength(input.minLength);
    if (input.maxLength !== undefined) textInput.setMaxLength(input.maxLength);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
  }

  return modal;
}

/**
 * Create a simple single-input modal
 */
export function createSingleInputModal(
  customId: string,
  title: string,
  inputConfig: TextInputConfig
): ModalBuilder {
  return createModal({
    customId,
    title,
    inputs: [inputConfig],
  });
}

// ============================================================================
// Giveaway-Specific Modal Builders
// ============================================================================

/**
 * Create title edit modal
 */
export function createTitleModal(pendingId: string, currentTitle?: string): ModalBuilder {
  return createSingleInputModal(
    buildGwModalId(pendingId, MODAL_TITLE),
    'Set Giveaway Title',
    {
      customId: 'title',
      label: 'Giveaway Title',
      placeholder: 'Enter the giveaway title...',
      value: currentTitle !== 'Untitled Giveaway' ? currentTitle || '' : '',
      required: true,
      maxLength: 100,
    }
  );
}

/**
 * Create prize edit modal
 */
export function createPrizeModal(pendingId: string, currentPrize?: string): ModalBuilder {
  return createSingleInputModal(
    buildGwModalId(pendingId, MODAL_PRIZE),
    'Set Prize (Confidential)',
    {
      customId: 'prize',
      label: 'Prize (will be hidden until claimed)',
      style: 'paragraph',
      placeholder: 'Enter the prize (e.g., game key, gift card code)...',
      value: currentPrize || '',
      required: true,
      maxLength: 1000,
    }
  );
}

/**
 * Create duration edit modal
 */
export function createDurationModal(pendingId: string, currentDuration?: string): ModalBuilder {
  return createSingleInputModal(
    buildGwModalId(pendingId, MODAL_DURATION),
    'Set Duration',
    {
      customId: 'duration',
      label: 'Duration (e.g., 1h, 30m, 1d, 2h30m)',
      placeholder: '1h, 30m, 1d, 2h30m...',
      value: currentDuration || '',
      required: true,
      maxLength: 20,
    }
  );
}

/**
 * Create winner count modal
 */
export function createWinnersModal(pendingId: string, currentCount?: number): ModalBuilder {
  return createSingleInputModal(
    buildGwModalId(pendingId, MODAL_WINNERS),
    'Set Winner Count',
    {
      customId: 'winners',
      label: 'Number of Winners (1-100)',
      placeholder: '1',
      value: String(currentCount || 1),
      required: true,
      maxLength: 3,
    }
  );
}

/**
 * Create reaction emoji modal
 */
export function createReactionModal(pendingId: string, currentEmoji?: string): ModalBuilder {
  return createSingleInputModal(
    buildGwModalId(pendingId, MODAL_REACTION),
    'Set Reaction Emoji',
    {
      customId: 'emoji',
      label: 'Emoji (:name: or :name:id)',
      placeholder: '\uD83C\uDF89 or :myEmoji: or myEmoji:123456',
      value: currentEmoji || '',
      required: true,
      maxLength: 50,
    }
  );
}

/**
 * Create trivia Q&A modal
 */
export function createTriviaQAModal(
  pendingId: string,
  currentQuestion?: string,
  currentAnswer?: string
): ModalBuilder {
  return createModal({
    customId: buildGwModalId(pendingId, MODAL_TRIVIA_QA),
    title: 'Set Trivia Question & Answer',
    inputs: [
      {
        customId: 'question',
        label: 'Trivia Question',
        style: 'paragraph',
        placeholder: 'What is the capital of France?',
        value: currentQuestion || '',
        required: true,
        maxLength: 500,
      },
      {
        customId: 'answer',
        label: 'Correct Answer (case-insensitive)',
        placeholder: 'Paris',
        value: currentAnswer || '',
        required: true,
        maxLength: 100,
      },
    ],
  });
}

/**
 * Create max trivia attempts modal
 */
export function createTriviaAttemptsModal(pendingId: string, currentAttempts?: number): ModalBuilder {
  const value = currentAttempts && currentAttempts > 0 ? String(currentAttempts) : '';

  return createSingleInputModal(
    buildGwModalId(pendingId, MODAL_TRIVIA_ATTEMPTS),
    'Set Max Trivia Attempts',
    {
      customId: 'attempts',
      label: 'Max Attempts (0 or empty = unlimited)',
      placeholder: '3',
      value,
      required: false,
      maxLength: 3,
    }
  );
}

// ============================================================================
// Modal Show Helper
// ============================================================================

/**
 * Show a modal on the interaction
 * @param interaction - Must be an interaction that supports showing modals (button, select menu, etc.)
 * @param modal - The modal to show
 */
export async function showModal(
  interaction: unknown,
  modal: ModalBuilder
): Promise<void> {
  if (!hasShowModal(interaction)) {
    logger.error('Cannot show modal - interaction missing showModal method');
    return;
  }
  await interaction.showModal(modal);
}
