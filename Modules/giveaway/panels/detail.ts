/**
 * Detail Panel Builder for Giveaway Module
 *
 * Uses the same clean inline format as the Create Panel for consistency.
 * IMPORTANT: Prize is CONFIDENTIAL - never show the actual prize value!
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { Giveaway } from '@bot/types/commandTypes';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { getConfigColor } from '../utils/configUtils';
import {
  getStatusEmoji,
  getDisplayStatus,
  getModeDisplay,
  getPrizeDisplay,
  formatDiscordTimestamp,
} from '../utils/displayFormatters';
import {
  buildBackButton,
  buildDangerButton,
  buildPrimaryButton,
  buildSecondaryButton,
} from '../utils/componentBuilders';
import {
  buildDetailButtonId,
  DETAIL_BTN_BACK,
  DETAIL_BTN_CANCEL,
  DETAIL_BTN_FINISH,
  DETAIL_BTN_REMOVE,
  DETAIL_BTN_VIEW_PRIZES,
} from '../constants';

/**
 * Get accent color based on giveaway status
 */
function getDetailColor(giveaway: Giveaway): number {
  const status = getDisplayStatus(giveaway);
  switch (status) {
    case 'cancelled':
      return V2Colors.danger;
    case 'ended':
      return V2Colors.secondary;
    default:
      return V2Colors.success;
  }
}

/**
 * Get status line for the giveaway
 */
function getStatusLine(giveaway: Giveaway): string {
  const status = getDisplayStatus(giveaway);
  switch (status) {
    case 'active':
      return `🟢 Active - Ends ${formatDiscordTimestamp(giveaway.endTime, 'R')}`;
    case 'ended':
      return `⚫ Ended - ${formatDiscordTimestamp(giveaway.endTime, 'R')}`;
    case 'cancelled':
      return `🔴 Cancelled`;
    default:
      return `🟡 ${status}`;
  }
}

/**
 * Build the detail panel response for viewing an existing giveaway
 * Uses V2 components with clean inline format
 */
export function buildDetailPanelResponse(
  context: PanelContext,
  giveaway: Giveaway,
  returnPage: number = 0
): PanelResponse {
  const statusEmoji = getStatusEmoji(giveaway);

  // Build V2 container
  const container = new ContainerBuilder()
    .setAccentColor(getDetailColor(giveaway));

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${statusEmoji} ${giveaway.title}`)
  );

  // Status line
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(getStatusLine(giveaway))
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Build info lines
  const infoLines: string[] = [
    `🎁 Prize ${getPrizeDisplay(giveaway.prizes, giveaway.winnerCount)}`,
    `👥 Participants \`${giveaway.participants.length}\``,
    `🏆 Winners \`${giveaway.winnerCount}\``,
    `🔄 Mode \`${getModeDisplay(giveaway.entryMode)}\``,
  ];

  // Add mode-specific lines
  if (giveaway.entryMode === 'reaction' && giveaway.reactionDisplayEmoji) {
    infoLines.push(`😀 Emoji ${giveaway.reactionDisplayEmoji}`);
  } else if (giveaway.entryMode === 'trivia') {
    const hasQA = giveaway.triviaQuestion && giveaway.triviaAnswer;
    infoLines.push(`❓ Q&A ${hasQA ? '✅ Configured' : '❌ Not Set'}`);
    if (giveaway.maxTriviaAttempts && giveaway.maxTriviaAttempts > 0) {
      infoLines.push(`🔢 Attempts \`${giveaway.maxTriviaAttempts}\``);
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoLines.join('\n'))
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
  );

  // Time info
  const timeLines: string[] = [
    `🏳 Started ${formatDiscordTimestamp(giveaway.startTime, 'f')}`,
    `🏁 ${giveaway.ended ? 'Ended' : 'Ends'} ${formatDiscordTimestamp(giveaway.endTime, 'f')}`,
  ];

  // Add winners if ended
  if (giveaway.ended && !giveaway.cancelled) {
    timeLines.push('');
    if (giveaway.winners.length === 0) {
      timeLines.push(`🏆 Winners: *No winners selected*`);
    } else {
      const winnersDisplay = giveaway.winners.map(id => `<@${id}>`).join(', ');
      timeLines.push(`🏆 Winners: ${winnersDisplay}`);
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(timeLines.join('\n'))
  );

  // Footer info
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ID: ${giveaway.id.substring(0, 8)}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Build action buttons
  if (giveaway.ended || giveaway.cancelled) {
    // For ended/cancelled: show Remove button and View Prizes (if has prizes)
    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    // Add View Prizes button for ended giveaways with prizes
    if (giveaway.ended && !giveaway.cancelled && giveaway.prizes?.length > 0) {
      actionRow.addComponents(
        buildSecondaryButton({
          customId: buildDetailButtonId(giveaway.id, DETAIL_BTN_VIEW_PRIZES, returnPage),
          label: 'View Prizes',
          emoji: '\uD83C\uDF81',
        }),
      );
    }

    actionRow.addComponents(
      buildDangerButton({
        customId: buildDetailButtonId(giveaway.id, DETAIL_BTN_REMOVE, returnPage),
        label: 'Remove',
        emoji: '\uD83D\uDDD1\uFE0F',
      }),
    );

    container.addActionRowComponents(actionRow);
  } else {
    // For active: show Cancel, Finish, and View Prizes buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    // Add View Prizes button for active giveaways with multiple prizes
    if (giveaway.prizes?.length > 1) {
      actionRow.addComponents(
        buildSecondaryButton({
          customId: buildDetailButtonId(giveaway.id, DETAIL_BTN_VIEW_PRIZES, returnPage),
          label: 'View Prizes',
          emoji: '\uD83C\uDF81',
        }),
      );
    }

    actionRow.addComponents(
      buildDangerButton({
        customId: buildDetailButtonId(giveaway.id, DETAIL_BTN_CANCEL, returnPage),
        label: 'Cancel',
        emoji: '\u274C',
      }),
      buildPrimaryButton({
        customId: buildDetailButtonId(giveaway.id, DETAIL_BTN_FINISH, returnPage),
        label: 'Finish Now',
        emoji: '\uD83C\uDFC1',
      }),
    );

    container.addActionRowComponents(actionRow);
  }

  // Back button row
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      buildBackButton(buildDetailButtonId(giveaway.id, DETAIL_BTN_BACK, returnPage), 'Back to List'),
    )
  );

  return createV2Response([container]);
}
