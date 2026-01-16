/**
 * Prize Manager Panel for Multi-Prize Giveaways
 *
 * Displays a paginated list of prizes for giveaways with multiple winners.
 * Each winner gets their own unique prize (exact match: prizes.length === winnerCount).
 *
 * Also provides Prize Results view for active/ended giveaways showing claim status.
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import { PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { Giveaway } from '@bot/types/commandTypes';
import { paginate, PAGINATION_DEFAULTS } from '@internal/utils/panel/paginationUtils';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { createPanelCloseButton } from '@internal/utils/panel/panelResponseUtils';
import { StoredPendingGiveaway } from '../types';
import { getPendingGiveaway } from '../state';
import * as giveawayManager from '../manager/giveawayManager';
import {
  PRIZES_PER_PAGE,
  buildPrizeEditButtonId,
  buildPrizeNavButtonId,
  buildPrizeResultsBackButtonId,
  MAIN_PANEL_ID,
  CREATE_PANEL_PREFIX,
} from '../constants';

interface PrizeSlot {
  index: number;
  prize: string | null;
}

/**
 * Build the Prize Manager panel response with V2 components
 *
 * @param context - Panel context
 * @param pendingId - The pending giveaway ID
 * @param page - Current page number (0-indexed)
 */
export function buildPrizeManagerResponse(
  context: PanelContext,
  pendingId: string,
  page: number = 0
): PanelResponse {
  const guildId = context.guildId;
  if (!guildId) {
    const container = new ContainerBuilder()
      .setAccentColor(V2Colors.danger)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## ❌ Error\nThis panel can only be used in a server.')
      );
    return createV2Response([container]);
  }

  const pending = getPendingGiveaway(guildId, pendingId);
  if (!pending) {
    const container = new ContainerBuilder()
      .setAccentColor(V2Colors.danger)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## ❌ Error\nGiveaway not found. It may have been deleted.')
      );
    return createV2Response([container]);
  }

  const winnerCount = pending.winnerCount || 1;
  const prizes = pending.prizes || [];

  // Create prize slots (fill empty slots up to winnerCount)
  const prizeSlots: PrizeSlot[] = [];
  for (let i = 0; i < winnerCount; i++) {
    prizeSlots.push({
      index: i,
      prize: prizes[i] || null,
    });
  }

  // Paginate the prize slots
  const paginated = paginate(prizeSlots, page, {
    itemsPerPage: PRIZES_PER_PAGE,
    buttonPrefix: `gw_prize_nav_${pendingId}`,
  });

  // Count configured prizes
  const configuredCount = prizes.filter(p => p && p.trim()).length;
  const isComplete = configuredCount === winnerCount;

  // Build V2 container
  const container = new ContainerBuilder()
    .setAccentColor(isComplete ? V2Colors.success : V2Colors.warning);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Prize Manager - ${pending.title || 'Untitled'}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Prize list description
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(buildPrizeListDescription(paginated.items, configuredCount, winnerCount))
  );

  // Footer info
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${configuredCount}/${winnerCount} prizes configured`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Prize edit buttons (one per prize on current page)
  if (paginated.items.length > 0) {
    const editRow = new ActionRowBuilder<ButtonBuilder>();
    for (const slot of paginated.items) {
      editRow.addComponents(
        new ButtonBuilder()
          .setCustomId(buildPrizeEditButtonId(pendingId, slot.index))
          .setLabel(slot.prize ? `Edit #${slot.index + 1}` : `Set #${slot.index + 1}`)
          .setStyle(slot.prize ? ButtonStyle.Secondary : ButtonStyle.Primary)
      );
    }
    container.addActionRowComponents(editRow);
  }

  // Navigation row with pagination and back button
  const navRow = new ActionRowBuilder<ButtonBuilder>();

  // Previous button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(buildPrizeNavButtonId(pendingId, 'prev', paginated.currentPage))
      .setLabel(PAGINATION_DEFAULTS.prevLabel)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!paginated.hasPrev)
  );

  // Page indicator
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_prize_page_${pendingId}`)
      .setLabel(PAGINATION_DEFAULTS.pageFormat(paginated.currentPage + 1, paginated.totalPages))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  // Next button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(buildPrizeNavButtonId(pendingId, 'next', paginated.currentPage))
      .setLabel(PAGINATION_DEFAULTS.nextLabel)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!paginated.hasNext)
  );

  // Back button (returns to create panel)
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`panel_${MAIN_PANEL_ID}_btn_${CREATE_PANEL_PREFIX}_${pendingId}_back_from_prizes`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  container.addActionRowComponents(navRow);

  return createV2Response([container]);
}

/**
 * Build the description text for the prize list
 */
function buildPrizeListDescription(
  slots: PrizeSlot[],
  configuredCount: number,
  winnerCount: number
): string {
  const lines: string[] = [];

  // Status header
  if (configuredCount === winnerCount) {
    lines.push(`\u2705 **All prizes configured!**\n`);
  } else {
    lines.push(`\u26A0\uFE0F **${winnerCount - configuredCount} prize(s) still needed**\n`);
  }

  // Prize list
  for (const slot of slots) {
    const num = slot.index + 1;
    if (slot.prize) {
      // Show prize with spoiler tags (hidden by default)
      lines.push(`**${num}.** ||${slot.prize}||`);
    } else {
      lines.push(`**${num}.** \u274C *Not Set*`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Prize Results Panel (for active/ended giveaways)
// =============================================================================

interface PrizeResultSlot {
  index: number;
  prize: string;
  winnerId: string | null;
  claimed: boolean;
}

/**
 * Build the Prize Results panel for active/ended giveaways with V2 components
 * Shows prizes with winners and claim status
 *
 * @param context - Panel context
 * @param giveawayId - The giveaway ID
 * @param page - Current page number (0-indexed)
 * @param returnPage - Page to return to in detail panel
 */
export function buildPrizeResultsResponse(
  context: PanelContext,
  giveawayId: string,
  page: number = 0,
  returnPage: number = 0
): PanelResponse {
  const guildId = context.guildId;
  if (!guildId) {
    const container = new ContainerBuilder()
      .setAccentColor(V2Colors.danger)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## ❌ Error\nThis panel can only be used in a server.')
      );
    return createV2Response([container]);
  }

  const giveaway = giveawayManager.getGiveaway(giveawayId, guildId);
  if (!giveaway) {
    const container = new ContainerBuilder()
      .setAccentColor(V2Colors.danger)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## ❌ Error\nGiveaway not found. It may have been deleted.')
      );
    return createV2Response([container]);
  }

  const prizes = giveaway.prizes || [];
  const winners = giveaway.winners || [];
  const claimedPrizes = giveaway.claimedPrizes || [];
  const prizeAssignments = giveaway.prizeAssignments || {};

  // Create prize result slots
  const prizeSlots: PrizeResultSlot[] = [];
  for (let i = 0; i < prizes.length; i++) {
    // Find winner for this prize slot
    let winnerId: string | null = null;

    // Check prizeAssignments first (maps winner -> prize)
    for (const [userId, assignedPrize] of Object.entries(prizeAssignments)) {
      if (assignedPrize === prizes[i]) {
        winnerId = userId;
        break;
      }
    }

    // Fallback: use index-based mapping if no assignment found
    if (!winnerId && winners[i]) {
      winnerId = winners[i];
    }

    prizeSlots.push({
      index: i,
      prize: prizes[i],
      winnerId,
      claimed: winnerId ? claimedPrizes.includes(winnerId) : false,
    });
  }

  // Paginate
  const paginated = paginate(prizeSlots, page, {
    itemsPerPage: PRIZES_PER_PAGE,
    buttonPrefix: `gw_prize_results_${giveawayId}`,
  });

  // Count stats
  const totalPrizes = prizes.length;
  const claimedCount = prizeSlots.filter(s => s.claimed).length;
  const assignedCount = prizeSlots.filter(s => s.winnerId).length;

  // Determine color and title
  const isEnded = giveaway.ended;
  const title = isEnded
    ? `# Prize Results - ${giveaway.title}`
    : `# Prizes - ${giveaway.title}`;

  // Determine accent color
  const accentColor = isEnded
    ? (claimedCount === totalPrizes ? V2Colors.success : V2Colors.warning)
    : V2Colors.primary;

  // Build V2 container
  const container = new ContainerBuilder()
    .setAccentColor(accentColor);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(title)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Prize results description
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(buildPrizeResultsDescription(paginated.items, giveaway))
  );

  // Footer info
  const footerText = isEnded
    ? `${claimedCount}/${assignedCount} prizes claimed`
    : `${totalPrizes} prizes configured`;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${footerText}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Navigation row
  const navRow = new ActionRowBuilder<ButtonBuilder>();

  // Previous button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_prize_results_nav_${giveawayId}_prev_${paginated.currentPage}`)
      .setLabel(PAGINATION_DEFAULTS.prevLabel)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!paginated.hasPrev)
  );

  // Page indicator
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_prize_results_page_${giveawayId}`)
      .setLabel(PAGINATION_DEFAULTS.pageFormat(paginated.currentPage + 1, paginated.totalPages))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  // Next button
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_prize_results_nav_${giveawayId}_next_${paginated.currentPage}`)
      .setLabel(PAGINATION_DEFAULTS.nextLabel)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!paginated.hasNext)
  );

  // Back button (returns to detail panel)
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(buildPrizeResultsBackButtonId(giveawayId, returnPage))
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  // Close button - only for direct command access
  // For guild_panel/system_panel access, injected row handles close
  const closeButton = createPanelCloseButton(context);
  if (closeButton) navRow.addComponents(closeButton);

  container.addActionRowComponents(navRow);

  return createV2Response([container]);
}

/**
 * Build description for prize results
 */
function buildPrizeResultsDescription(
  slots: PrizeResultSlot[],
  giveaway: Giveaway
): string {
  const lines: string[] = [];
  const isEnded = giveaway.ended;

  // Status header
  if (isEnded) {
    const totalPrizes = slots.length;
    const assignedCount = slots.filter(s => s.winnerId).length;
    const claimedCount = slots.filter(s => s.claimed).length;
    const unassignedCount = totalPrizes - assignedCount;
    const unclaimedCount = assignedCount - claimedCount;

    if (assignedCount === 0) {
      lines.push(`⚠️ **No winners selected**\n`);
    } else if (assignedCount === totalPrizes && claimedCount === assignedCount) {
      // All prizes have winners AND all are claimed
      lines.push(`✅ **All prizes claimed!**\n`);
    } else {
      // Build status message based on what's missing
      const issues: string[] = [];
      if (unassignedCount > 0) {
        issues.push(`${unassignedCount} without winner`);
      }
      if (unclaimedCount > 0) {
        issues.push(`${unclaimedCount} unclaimed`);
      }
      lines.push(`⚠️ **${issues.join(', ')}**\n`);
    }
  } else {
    lines.push(`🔄 **Giveaway in progress**\n`);
  }

  // Prize list with winners and claim status
  for (const slot of slots) {
    const num = slot.index + 1;
    const prizeText = `||${slot.prize}||`;

    if (isEnded) {
      if (slot.winnerId) {
        const claimIcon = slot.claimed ? '\u2705' : '\u23F3';
        const claimText = slot.claimed ? 'Claimed' : 'Unclaimed';
        lines.push(`**${num}.** <@${slot.winnerId}> \u2192 ${prizeText} ${claimIcon} *${claimText}*`);
      } else {
        lines.push(`**${num}.** *No winner* \u2192 ${prizeText}`);
      }
    } else {
      // Active giveaway - just show prizes
      lines.push(`**${num}.** ${prizeText}`);
    }
  }

  return lines.join('\n');
}
