/**
 * Shared component builders for the giveaway module
 * Standardizes button and component creation
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

// ============================================================================
// Button Builders
// ============================================================================

export interface ButtonConfig {
  customId: string;
  label: string;
  emoji?: string;
  disabled?: boolean;
}

/**
 * Create a primary style button
 */
export function buildPrimaryButton(config: ButtonConfig): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(config.customId)
    .setLabel(config.label)
    .setStyle(ButtonStyle.Primary);

  if (config.emoji) button.setEmoji(config.emoji);
  if (config.disabled) button.setDisabled(true);

  return button;
}

/**
 * Create a secondary style button
 */
export function buildSecondaryButton(config: ButtonConfig): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(config.customId)
    .setLabel(config.label)
    .setStyle(ButtonStyle.Secondary);

  if (config.emoji) button.setEmoji(config.emoji);
  if (config.disabled) button.setDisabled(true);

  return button;
}

/**
 * Create a success style button
 */
export function buildSuccessButton(config: ButtonConfig): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(config.customId)
    .setLabel(config.label)
    .setStyle(ButtonStyle.Success);

  if (config.emoji) button.setEmoji(config.emoji);
  if (config.disabled) button.setDisabled(true);

  return button;
}

/**
 * Create a danger style button
 */
export function buildDangerButton(config: ButtonConfig): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(config.customId)
    .setLabel(config.label)
    .setStyle(ButtonStyle.Danger);

  if (config.emoji) button.setEmoji(config.emoji);
  if (config.disabled) button.setDisabled(true);

  return button;
}

// ============================================================================
// Pagination Buttons
// ============================================================================

/**
 * Create pagination buttons (prev/next)
 */
export function buildPaginationButtons(
  currentPage: number,
  totalPages: number,
  buildPrevId: (page: number) => string,
  buildNextId: (page: number) => string
): ActionRowBuilder<ButtonBuilder> {
  const prevButton = buildSecondaryButton({
    customId: buildPrevId(currentPage - 1),
    label: 'Prev',
    emoji: '\u25C0\uFE0F',
    disabled: currentPage === 0,
  });

  const pageIndicator = buildSecondaryButton({
    customId: 'page_indicator_disabled',
    label: `Page ${currentPage + 1}/${totalPages}`,
    disabled: true,
  });

  const nextButton = buildSecondaryButton({
    customId: buildNextId(currentPage + 1),
    label: 'Next',
    emoji: '\u25B6\uFE0F',
    disabled: currentPage >= totalPages - 1,
  });

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageIndicator, nextButton);
}

// ============================================================================
// Navigation Buttons
// ============================================================================

/**
 * Create a back button
 */
export function buildBackButton(customId: string, label = 'Back'): ButtonBuilder {
  return buildSecondaryButton({
    customId,
    label,
    emoji: '\u2B05\uFE0F',
  });
}

/**
 * Create a cancel button
 */
export function buildCancelButton(customId: string, label = 'Cancel'): ButtonBuilder {
  return buildSecondaryButton({
    customId,
    label,
    emoji: '\u274C',
  });
}

/**
 * Create a confirm button
 */
export function buildConfirmButton(customId: string, label = 'Confirm'): ButtonBuilder {
  return buildSuccessButton({
    customId,
    label,
    emoji: '\u2705',
  });
}

// ============================================================================
// Action Buttons
// ============================================================================

/**
 * Create action buttons row with common actions
 */
export function buildActionButtonsRow(
  buttons: Array<{
    id: string;
    label: string;
    emoji?: string;
    style: 'primary' | 'secondary' | 'success' | 'danger';
    disabled?: boolean;
  }>
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const btn of buttons) {
    const config: ButtonConfig = {
      customId: btn.id,
      label: btn.label,
      emoji: btn.emoji,
      disabled: btn.disabled,
    };

    switch (btn.style) {
      case 'primary':
        row.addComponents(buildPrimaryButton(config));
        break;
      case 'secondary':
        row.addComponents(buildSecondaryButton(config));
        break;
      case 'success':
        row.addComponents(buildSuccessButton(config));
        break;
      case 'danger':
        row.addComponents(buildDangerButton(config));
        break;
    }
  }

  return row;
}

// ============================================================================
// Dropdown Builders
// ============================================================================

export interface DropdownOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  isDefault?: boolean;
}

/**
 * Create a string select menu
 */
export function buildDropdown(
  customId: string,
  placeholder: string,
  options: DropdownOption[]
): StringSelectMenuBuilder {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder);

  for (const opt of options) {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(opt.label)
      .setValue(opt.value);

    if (opt.description) option.setDescription(opt.description);
    if (opt.emoji) option.setEmoji(opt.emoji);
    if (opt.isDefault) option.setDefault(true);

    menu.addOptions(option);
  }

  return menu;
}

/**
 * Create a dropdown row
 */
export function buildDropdownRow(
  customId: string,
  placeholder: string,
  options: DropdownOption[]
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    buildDropdown(customId, placeholder, options)
  );
}

// ============================================================================
// Giveaway-Specific Buttons
// ============================================================================

/**
 * Create the "Create New Giveaway" button
 */
export function buildCreateButton(customId: string): ButtonBuilder {
  return buildSuccessButton({
    customId,
    label: 'Create New Giveaway',
    emoji: '\u2795',
  });
}

/**
 * Create the "Mark Ready" button
 */
export function buildReadyButton(customId: string, disabled = false): ButtonBuilder {
  return buildSuccessButton({
    customId,
    label: 'Mark Ready',
    emoji: '\u2705',
    disabled,
  });
}

/**
 * Create the "Delete" button
 */
export function buildDeleteButton(customId: string): ButtonBuilder {
  return buildDangerButton({
    customId,
    label: 'Delete',
    emoji: '\uD83D\uDDD1\uFE0F',
  });
}

/**
 * Create the "Start Giveaway" button
 */
export function buildStartButton(customId: string): ButtonBuilder {
  return buildSuccessButton({
    customId,
    label: 'Start Giveaway Here!',
    emoji: '\uD83D\uDE80',
  });
}

/**
 * Create the "Finish Now" button
 */
export function buildFinishButton(customId: string): ButtonBuilder {
  return buildPrimaryButton({
    customId,
    label: 'Finish Now',
    emoji: '\uD83C\uDFC1',
  });
}

/**
 * Create the "Remove" button
 */
export function buildRemoveButton(customId: string): ButtonBuilder {
  return buildDangerButton({
    customId,
    label: 'Remove',
    emoji: '\uD83D\uDDD1\uFE0F',
  });
}
