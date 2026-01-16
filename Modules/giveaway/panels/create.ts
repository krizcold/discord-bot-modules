/**
 * Create Panel Builder for Giveaway Module
 *
 * Uses shared utilities for consistent display and reduced duplication.
 * IMPORTANT: Prize is CONFIDENTIAL - never show the actual prize value!
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
} from 'discord.js';
import { PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { StoredPendingGiveaway } from '../types';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { isValidEmojiFormat } from '@internal/utils/emojiHandler';
import {
  getModeDisplay,
  getPrizeDisplay,
  formatDurationDisplay,
  formatTriviaAttempts,
} from '../utils/displayFormatters';
import {
  buildSecondaryButton,
  buildSuccessButton,
  buildBackButton,
  buildDeleteButton,
  buildDropdown,
} from '../utils/componentBuilders';
import {
  buildCreateButtonId,
  buildEditButtonId,
  CREATE_BTN_READY,
  CREATE_BTN_START,
  CREATE_BTN_DELETE,
  CREATE_BTN_BACK,
  CREATE_MODE_DROPDOWN_PREFIX,
  CREATE_BTN_COMPETITION_LEADERBOARD,
  MODAL_TITLE,
  MODAL_PRIZE,
  MODAL_DURATION,
  MODAL_WINNERS,
  MODAL_REACTION,
  MODAL_TRIVIA_QA,
  MODAL_TRIVIA_ATTEMPTS,
  STATUS_EMOJI,
  PRIZE_PANEL_PREFIX,
} from '../constants';

/**
 * Entry mode options for dropdown
 */
const ENTRY_MODE_OPTIONS = [
  { value: 'button', label: 'Button', emoji: '\uD83D\uDD18', description: 'Click a button to enter' },
  { value: 'reaction', label: 'Reaction', emoji: '\uD83D\uDE00', description: 'React to enter' },
  { value: 'trivia', label: 'Trivia', emoji: '\u2753', description: 'Answer a question to enter (random winner)' },
  { value: 'competition', label: 'Competition', emoji: '\uD83C\uDFC6', description: 'First correct answers win (ordered prizes)' },
];

/**
 * Check if giveaway has all required fields
 * For multi-winner giveaways, all prizes must be configured (exact match)
 */
export function isReadyToStart(pending: StoredPendingGiveaway): boolean {
  if (!pending.title || pending.title === 'Untitled Giveaway') return false;
  if (!pending.durationMs || pending.durationMs <= 0) return false;
  if (!pending.winnerCount || pending.winnerCount <= 0) return false;

  // Prize validation: multi-prize for 2+ winners, single prize for 1 winner
  const winnerCount = pending.winnerCount || 1;
  if (winnerCount > 1) {
    // Multi-prize: must have exactly winnerCount prizes configured
    const configuredPrizes = pending.prizes?.filter(p => p && p.trim()).length || 0;
    if (configuredPrizes !== winnerCount) return false;
  } else {
    // Single winner: check prizes array
    const singlePrize = pending.prizes?.[0];
    if (!singlePrize || singlePrize.trim() === '') return false;
  }

  if (pending.entryMode === 'trivia' || pending.entryMode === 'competition') {
    if (!pending.triviaQuestion || !pending.triviaAnswer) return false;
  }
  if (pending.entryMode === 'reaction') {
    if (!isValidEmojiFormat(pending.reactionDisplayEmoji)) return false;
  }

  return true;
}

/**
 * Build the create panel response with V2 components
 */
export function buildCreatePanelResponse(
  context: PanelContext,
  pending: StoredPendingGiveaway
): PanelResponse {
  const pendingId = pending.id;
  const isReady = isReadyToStart(pending);
  const winnerCount = pending.winnerCount || 1;

  // Build V2 container
  const container = new ContainerBuilder()
    .setAccentColor(isReady ? V2Colors.success : V2Colors.warning);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Create New Giveaway')
  );

  // Status line
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      isReady
        ? `${STATUS_EMOJI.pending} Ready to start`
        : `${STATUS_EMOJI.draft} Draft - missing required fields`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Helper to create a section with label and value button
  // Shows warning emoji if field is missing/invalid
  const createFieldSection = (
    label: string,
    value: string,
    customId: string,
    options?: { maxLength?: number; warning?: boolean }
  ) => {
    const maxLength = options?.maxLength ?? 20;
    const warning = options?.warning ?? false;
    const displayValue = value.length > maxLength ? value.substring(0, maxLength - 2) + '..' : value;
    const labelText = warning ? `**${label}** ⚠️` : `**${label}**`;
    return new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(labelText)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(customId)
          .setLabel(displayValue)
          .setStyle(ButtonStyle.Secondary)
      );
  };

  // Title section - warn if untitled
  const titleMissing = !pending.title || pending.title === 'Untitled Giveaway';
  container.addSectionComponents(
    createFieldSection('📝 Title', pending.title || 'Untitled', buildEditButtonId(pendingId, MODAL_TITLE), { warning: titleMissing })
  );

  // Prize section - warn if not set
  const prizeCustomId = winnerCount > 1
    ? buildCreateButtonId(pendingId, PRIZE_PANEL_PREFIX)
    : buildEditButtonId(pendingId, MODAL_PRIZE);
  const hasPrize = winnerCount > 1
    ? (pending.prizes?.filter(p => p && p.trim()).length || 0) === winnerCount
    : !!pending.prizes?.[0];
  const prizeLabel = winnerCount > 1
    ? `${pending.prizes?.filter(p => p && p.trim()).length || 0}/${winnerCount} set`
    : (pending.prizes?.[0] ? '✓ Set' : 'Not set');
  container.addSectionComponents(
    createFieldSection('🎁 Prize', prizeLabel, prizeCustomId, { warning: !hasPrize })
  );

  // Duration section
  container.addSectionComponents(
    createFieldSection('⏱️ Duration', formatDurationDisplay(pending.durationMs) || 'Not set', buildEditButtonId(pendingId, MODAL_DURATION))
  );

  // Winners section
  container.addSectionComponents(
    createFieldSection('🏆 Winners', String(winnerCount), buildEditButtonId(pendingId, MODAL_WINNERS))
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Mode selection dropdown (keep as dropdown for easy selection)
  const modeDropdown = buildDropdown(
    `${CREATE_MODE_DROPDOWN_PREFIX}_${pendingId}`,
    'Select entry mode...',
    ENTRY_MODE_OPTIONS.map(opt => ({
      ...opt,
      isDefault: opt.value === (pending.entryMode || 'button'),
    }))
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(modeDropdown)
  );

  // Mode-specific sections
  if (pending.entryMode === 'reaction') {
    const hasValidEmoji = isValidEmojiFormat(pending.reactionDisplayEmoji);
    const emojiLabel = hasValidEmoji ? '**😀 Emoji**' : '**😀 Emoji** ⚠️';
    const buttonEmoji = hasValidEmoji ? pending.reactionDisplayEmoji! : '❓';

    const emojiSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(emojiLabel)
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(buildEditButtonId(pendingId, MODAL_REACTION))
          .setLabel(hasValidEmoji ? 'Change' : 'Not set')
          .setEmoji(buttonEmoji)
          .setStyle(ButtonStyle.Secondary)
      );
    container.addSectionComponents(emojiSection);
  } else if (pending.entryMode === 'trivia' || pending.entryMode === 'competition') {
    const hasQA = pending.triviaQuestion && pending.triviaAnswer;
    container.addSectionComponents(
      createFieldSection('❓ Q&A', hasQA ? '✓ Set' : 'Not set', buildEditButtonId(pendingId, MODAL_TRIVIA_QA), { warning: !hasQA })
    );
    container.addSectionComponents(
      createFieldSection('🔢 Attempts', formatTriviaAttempts(pending.maxTriviaAttempts), buildEditButtonId(pendingId, MODAL_TRIVIA_ATTEMPTS))
    );

    if (pending.entryMode === 'competition') {
      const leaderboardEnabled = pending.liveLeaderboard !== false;
      container.addSectionComponents(
        createFieldSection('📊 Leaderboard', leaderboardEnabled ? 'ON' : 'OFF', buildCreateButtonId(pendingId, CREATE_BTN_COMPETITION_LEADERBOARD))
      );
    }
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Footer info
  const createdDate = new Date(pending.createdAt);
  const formattedDate = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Created: ${formattedDate} • ID: ${pendingId.substring(0, 8)}`)
  );

  // Row 4: Action buttons
  // "Ready" marks giveaway as ready to start later
  // "Start" button actually starts the giveaway in the current channel
  const actionButtons: ButtonBuilder[] = [
    buildBackButton(buildCreateButtonId(pendingId, CREATE_BTN_BACK)),
    buildDeleteButton(buildCreateButtonId(pendingId, CREATE_BTN_DELETE)),
  ];

  if (isReady) {
    // Show both Ready and Start buttons
    actionButtons.push(
      buildSecondaryButton({ customId: buildCreateButtonId(pendingId, CREATE_BTN_READY), label: 'Save', emoji: '💾' }),
      buildSuccessButton({ customId: buildCreateButtonId(pendingId, CREATE_BTN_START), label: 'Start', emoji: '🏳' }),
    );
  } else {
    // Show disabled Not Ready button
    actionButtons.push(
      buildSecondaryButton({ customId: buildCreateButtonId(pendingId, CREATE_BTN_READY), label: 'Not Ready', emoji: '❌', disabled: true }),
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...actionButtons)
  );

  return createV2Response([container]);
}
