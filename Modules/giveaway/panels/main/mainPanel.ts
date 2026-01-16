/**
 * Giveaway Main Panel
 * Core panel definition with button, modal, and dropdown handlers
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
} from 'discord.js';
import { PanelOptions, PanelContext, PanelResponse } from '@bot/types/panelTypes';
import { PAGINATION_DEFAULTS } from '@internal/utils/panel/paginationUtils';
import { createV2Response, V2Colors } from '@internal/utils/panel/v2';
import { createPanelCloseButton } from '@internal/utils/panel/panelResponseUtils';
import { createPendingGiveaway, getPendingGiveaway } from '../../state';
import { loadPendingGiveaways } from '../../state';
import { getGiveawayConfig } from '../../utils/configUtils';
import { buildSecondaryButton, buildSuccessButton, buildDangerButton } from '../../utils/componentBuilders';
import {
  MAIN_PANEL_ID,
  ITEMS_PER_PAGE,
  MAX_ITEMS_PER_PAGE,
  GW_PAGE_BTN,
  buildPaginationButtonId,
  parsePaginationButtonId,
  parseDetailButtonId,
} from '../../constants';
import { buildCreatePanelResponse } from '../create';
import { buildDetailPanelResponse } from '../detail';
import { buildPrizeResultsResponse, buildPrizeManagerResponse } from '../prizeManager';
import { handleCreatePanelButton, handleCreatePanelModal, handleCreatePanelDropdown } from '../createPanel';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');
import * as giveawayManager from '../../manager/giveawayManager';
import { getPageState, setPageState } from './pageState';
import { buildGiveawayList, getStatusEmoji, formatGiveawayListItem } from './listBuilder';

/**
 * Build an error response using V2 components
 */
function buildErrorResponse(
  message: string,
  options?: { showNavigation?: boolean; page?: number; context?: PanelContext }
): PanelResponse {
  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.danger);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ❌ Error\n${message}`)
  );

  if (options?.showNavigation) {
    const page = options.page ?? 0;
    const backButton = buildSecondaryButton({
      customId: `panel_${MAIN_PANEL_ID}_btn_error_back_${page}`,
      label: 'Back',
    });

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    // Only add close button for direct command access
    if (options.context) {
      const closeButton = createPanelCloseButton(options.context);
      if (closeButton) navRow.addComponents(closeButton);
    }
    container.addActionRowComponents(navRow);
  }

  return createV2Response([container]);
}

/**
 * Build the main panel response with V2 components
 */
export async function buildMainPanelResponse(context: PanelContext, page: number = 0): Promise<PanelResponse> {
  const guildId = context.guildId!;
  const config = getGiveawayConfig(guildId);
  const itemsPerPage = Math.min(config.itemsPerPage || ITEMS_PER_PAGE, MAX_ITEMS_PER_PAGE);

  const allItems = buildGiveawayList(guildId);
  const pendingGiveaways = loadPendingGiveaways(guildId);

  // Calculate pagination
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  // Get items for current page
  const startIndex = currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageItems = allItems.slice(startIndex, endIndex);

  // Count by status
  const activeCount = allItems.filter(i => i.status === 'active').length;
  const pendingCount = allItems.filter(i => i.status === 'pending').length;
  const endedCount = allItems.filter(i => i.status === 'ended').length;

  // Build V2 container
  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.primary);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## 🎉 Giveaway Manager')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Build list content
  if (pageItems.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('*No giveaways found.*\nClick **Create** to get started!')
    );
  } else {
    // Build sections for each item with view button accessory
    for (const item of pageItems) {
      const pending = item.isPending ? pendingGiveaways.find(p => p.id === item.id) : undefined;
      const itemText = formatGiveawayListItem(item, pending);
      const itemType = item.isPending ? 'pending' : 'giveaway';

      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(itemText)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`panel_${MAIN_PANEL_ID}_btn_view_${itemType}_${item.id}`)
            .setLabel('View')
            .setStyle(ButtonStyle.Secondary)
        );

      container.addSectionComponents(section);
    }

    // Build status summary as vertical subtext (one per line)
    const summaryLines: string[] = [];
    if (pendingCount > 0) summaryLines.push(`-# *\`${pendingCount}\` Pending*`);
    if (activeCount > 0) summaryLines.push(`-# *\`${activeCount}\` Ongoing*`);
    if (endedCount > 0) summaryLines.push(`-# *\`${endedCount}\` Ended*`);

    if (summaryLines.length > 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(summaryLines.join('\n'))
      );
    }
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Pagination row - always visible but disabled at boundaries
  const prevButton = buildSecondaryButton({
    customId: buildPaginationButtonId('prev', currentPage),
    label: PAGINATION_DEFAULTS.prevLabel,
    disabled: currentPage === 0,
  });

  const pageIndicator = buildSecondaryButton({
    customId: `${GW_PAGE_BTN}_${currentPage}_${totalPages}`,
    label: PAGINATION_DEFAULTS.pageFormat(currentPage + 1, totalPages),
    disabled: totalPages <= 1, // Only clickable if there are multiple pages
  });

  const nextButton = buildSecondaryButton({
    customId: buildPaginationButtonId('next', currentPage),
    label: PAGINATION_DEFAULTS.nextLabel,
    disabled: currentPage >= totalPages - 1,
  });

  const createButton = buildSuccessButton({
    customId: `panel_${MAIN_PANEL_ID}_btn_create`,
    label: 'Create',
    emoji: '➕',
  });

  // Close button only shown for direct command access
  // For guild_panel/system_panel access, injected row handles close
  const closeButton = createPanelCloseButton(context);

  // Always show navigation row
  const navRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(prevButton, pageIndicator, nextButton, createButton);
  if (closeButton) navRow.addComponents(closeButton);
  container.addActionRowComponents(navRow);

  return createV2Response([container]);
}

/**
 * Main Giveaway Panel - List View with Pagination
 */
const giveawayMainPanel: PanelOptions = {
  id: MAIN_PANEL_ID,
  name: 'Giveaway Manager',
  description: 'Manage giveaways for your server',
  category: 'Fun',
  panelScope: 'guild',

  showInAdminPanel: true,
  adminPanelOrder: 10,
  adminPanelIcon: '\uD83C\uDF89',
  requiresChannel: true,  // Giveaway announcements need a target channel

  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    // Get stored page or default to 0
    const currentPage = getPageState(context.userId, context.guildId);
    return await buildMainPanelResponse(context, currentPage);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    // Handle pagination buttons
    const paginationParsed = parsePaginationButtonId(`panel_${MAIN_PANEL_ID}_btn_${buttonId}`);
    if (paginationParsed || buttonId.startsWith('prev_') || buttonId.startsWith('next_')) {
      let newPage: number;

      if (buttonId.startsWith('prev_')) {
        const currentPage = parseInt(buttonId.split('_')[1], 10);
        newPage = Math.max(0, currentPage - 1);
      } else if (buttonId.startsWith('next_')) {
        const currentPage = parseInt(buttonId.split('_')[1], 10);
        newPage = currentPage + 1;
      } else if (paginationParsed) {
        newPage = paginationParsed.direction === 'prev'
          ? Math.max(0, paginationParsed.page - 1)
          : paginationParsed.page + 1;
      } else {
        newPage = 0;
      }

      setPageState(context.userId, context.guildId, newPage);
      return await buildMainPanelResponse(context, newPage);
    }

    // Handle error back button
    if (buttonId.startsWith('error_back_')) {
      const page = parseInt(buttonId.split('_')[2], 10) || 0;
      return await buildMainPanelResponse(context, page);
    }

    // Note: Close button uses admin_panel_close (handled by admin panel system)

    // Handle create button (from main panel)
    if (buttonId === 'create') {
      const pending = createPendingGiveaway(context.guildId, context.userId);
      return buildCreatePanelResponse(context, pending);
    }

    // Handle view buttons (from list sections)
    // Format: view_pending_{id} or view_giveaway_{id}
    if (buttonId.startsWith('view_')) {
      const parts = buttonId.split('_');
      if (parts.length >= 3) {
        const type = parts[1]; // 'pending' or 'giveaway'
        const id = parts.slice(2).join('_'); // Handle IDs with underscores
        const currentPage = getPageState(context.userId, context.guildId);

        if (type === 'pending') {
          const pending = getPendingGiveaway(context.guildId, id);
          if (pending) {
            return buildCreatePanelResponse(context, pending);
          }
          // Check if it was started (now an active giveaway)
          const startedGiveaway = giveawayManager.getGiveaway(id, context.guildId);
          if (startedGiveaway) {
            return buildDetailPanelResponse(context, startedGiveaway, currentPage);
          }
          return buildErrorResponse('Giveaway not found. It may have been deleted.', { showNavigation: true, page: currentPage });
        } else if (type === 'giveaway') {
          const giveaway = giveawayManager.getGiveaway(id, context.guildId);
          if (giveaway) {
            return buildDetailPanelResponse(context, giveaway, currentPage);
          }
          // Check if it's back in pending (edge case)
          const pending = getPendingGiveaway(context.guildId, id);
          if (pending) {
            return buildCreatePanelResponse(context, pending);
          }
          return buildErrorResponse('Giveaway not found. It may have been removed.', { showNavigation: true, page: currentPage });
        }
      }
    }

    // Handle gw_edit_ buttons (Web-UI only - Discord uses separate button handler)
    // These bypass the panel system in Discord to avoid deferUpdate issues with modals
    if (buttonId.startsWith('gw_edit_')) {
      const { parseEditButtonId, MODAL_TITLE, MODAL_PRIZE, MODAL_DURATION, MODAL_WINNERS, MODAL_REACTION, MODAL_TRIVIA_QA, MODAL_TRIVIA_ATTEMPTS } = await import('../../constants');
      const { createTitleModal, createPrizeModal, createDurationModal, createWinnersModal, createReactionModal, createTriviaQAModal, createTriviaAttemptsModal, showModal } = await import('../../utils/modalFactory');
      const { formatDurationDisplay } = await import('../../utils/displayFormatters');

      const parsed = parseEditButtonId(buttonId);
      if (!parsed) {
        logger.error('Failed to parse gw_edit_ button:', buttonId);
        return buildErrorResponse('Invalid button format.');
      }

      const { pendingId, modalType } = parsed;
      const pending = getPendingGiveaway(context.guildId, pendingId);
      if (!pending) {
        return buildErrorResponse('Giveaway not found. It may have been deleted.');
      }

      // Show the appropriate modal based on type
      switch (modalType) {
        case MODAL_TITLE:
          await showModal(context.interaction, createTitleModal(pendingId, pending.title));
          break;
        case MODAL_PRIZE:
          await showModal(context.interaction, createPrizeModal(pendingId, pending.prizes?.[0]));
          break;
        case MODAL_DURATION:
          await showModal(context.interaction, createDurationModal(pendingId, formatDurationDisplay(pending.durationMs)));
          break;
        case MODAL_WINNERS:
          await showModal(context.interaction, createWinnersModal(pendingId, pending.winnerCount));
          break;
        case MODAL_REACTION:
          await showModal(context.interaction, createReactionModal(pendingId, pending.reactionEmojiInput || pending.reactionDisplayEmoji));
          break;
        case MODAL_TRIVIA_QA:
          await showModal(context.interaction, createTriviaQAModal(pendingId, pending.triviaQuestion, pending.triviaAnswer));
          break;
        case MODAL_TRIVIA_ATTEMPTS:
          await showModal(context.interaction, createTriviaAttemptsModal(pendingId, pending.maxTriviaAttempts));
          break;
        default:
          logger.error('Unknown modal type:', modalType);
          return buildErrorResponse('Unknown action.');
      }

      // Return null to indicate modal was shown (captured by Web-UI adapter)
      return null as any;
    }

    // Handle gw_prize_nav_ buttons (Prize Manager navigation - Web-UI only)
    if (buttonId.startsWith('gw_prize_nav_')) {
      const { parsePrizeNavButtonId } = await import('../../constants');

      const parsed = parsePrizeNavButtonId(buttonId);
      if (!parsed) {
        logger.error('Failed to parse gw_prize_nav_ button:', buttonId);
        return buildErrorResponse('Invalid button format.');
      }

      const { pendingId, direction, page } = parsed;
      const pending = getPendingGiveaway(context.guildId, pendingId);
      if (!pending) {
        return buildErrorResponse('Giveaway not found. It may have been deleted.');
      }

      // Calculate new page
      const newPage = direction === 'prev' ? page - 1 : page + 1;

      return buildPrizeManagerResponse(context, pendingId, newPage);
    }

    // Handle gw_prize_edit_ buttons (Prize Manager edit - Web-UI only)
    if (buttonId.startsWith('gw_prize_edit_')) {
      const { parsePrizeEditButtonId } = await import('../../constants');
      const { createSinglePrizeModal } = await import('../../handlers/createEdit');
      const { showModal } = await import('../../utils/modalFactory');

      const parsed = parsePrizeEditButtonId(buttonId);
      if (!parsed) {
        logger.error('Failed to parse gw_prize_edit_ button:', buttonId);
        return buildErrorResponse('Invalid button format.');
      }

      const { pendingId, prizeIndex } = parsed;
      const pending = getPendingGiveaway(context.guildId, pendingId);
      if (!pending) {
        return buildErrorResponse('Giveaway not found. It may have been deleted.');
      }

      // Get current prize value if exists
      const currentValue = pending.prizes?.[prizeIndex];

      // Show modal for this prize
      await showModal(context.interaction, createSinglePrizeModal(pendingId, prizeIndex, currentValue));

      // Return null to indicate modal was shown (captured by Web-UI adapter)
      return null as any;
    }

    // Handle create panel buttons (delegated to createPanel handlers)
    if (buttonId.startsWith('create_')) {
      const result = await handleCreatePanelButton(context, buttonId);
      if (result !== null) {
        return result;
      }
      // null means modal was shown, return current panel (will be ignored due to modal)
      const pending = getPendingGiveaway(context.guildId, buttonId.split('_')[1]);
      if (pending) {
        return buildCreatePanelResponse(context, pending);
      }
      return await buildMainPanelResponse(context, getPageState(context.userId, context.guildId));
    }

    // Handle detail panel buttons
    const detailParsed = parseDetailButtonId(`panel_${MAIN_PANEL_ID}_btn_${buttonId}`);
    if (detailParsed) {
      if (detailParsed.action === 'back') {
        const page = detailParsed.page || getPageState(context.userId, context.guildId);
        return await buildMainPanelResponse(context, page);
      }
      // Handle cancel, finish, remove actions
      if (detailParsed.action === 'cancel' || detailParsed.action === 'finish') {
        const giveaway = giveawayManager.getGiveaway(detailParsed.giveawayId, context.guildId);
        if (giveaway && !giveaway.ended && !giveaway.cancelled) {
          if (detailParsed.action === 'cancel') {
            await giveawayManager.cancelGiveaway(context.client, detailParsed.giveawayId, context.guildId!);
          } else {
            await giveawayManager.processEndedGiveaway(context.client, detailParsed.giveawayId, context.guildId!);
          }
        }
        return await buildMainPanelResponse(context, detailParsed.page || 0);
      }
      if (detailParsed.action === 'remove') {
        giveawayManager.removeGiveaway(detailParsed.giveawayId, context.guildId);
        return await buildMainPanelResponse(context, detailParsed.page || 0);
      }
      if (detailParsed.action === 'viewprizes') {
        const giveaway = giveawayManager.getGiveaway(detailParsed.giveawayId, context.guildId);
        if (giveaway && giveaway.prizes?.length > 0) {
          return buildPrizeResultsResponse(context, detailParsed.giveawayId, 0, detailParsed.page || 0);
        }
        return buildErrorResponse('No prizes configured for this giveaway.');
      }
    }

    // Handle detail_ prefixed buttons (alternative format)
    if (buttonId.startsWith('detail_')) {
      const parts = buttonId.split('_');
      if (parts.length >= 3) {
        const giveawayId = parts[1];
        const action = parts[2];
        const page = parts[3] ? parseInt(parts[3], 10) : 0;

        if (action === 'back') {
          return await buildMainPanelResponse(context, page);
        }
        if (action === 'cancel' || action === 'finish') {
          const giveaway = giveawayManager.getGiveaway(giveawayId, context.guildId);
          if (giveaway && !giveaway.ended && !giveaway.cancelled) {
            if (action === 'cancel') {
              await giveawayManager.cancelGiveaway(context.client, giveawayId, context.guildId!);
            } else {
              await giveawayManager.processEndedGiveaway(context.client, giveawayId, context.guildId!);
            }
          }
          return await buildMainPanelResponse(context, page);
        }
        if (action === 'remove') {
          giveawayManager.removeGiveaway(giveawayId, context.guildId);
          return await buildMainPanelResponse(context, page);
        }
        if (action === 'viewprizes') {
          const giveaway = giveawayManager.getGiveaway(giveawayId, context.guildId);
          if (giveaway && giveaway.prizes?.length > 0) {
            return buildPrizeResultsResponse(context, giveawayId, 0, page);
          }
          return buildErrorResponse('No prizes configured for this giveaway.');
        }
      }
    }

    // Handle gw_prize_results_nav_ buttons (Prize Results navigation - Web-UI only)
    if (buttonId.startsWith('gw_prize_results_nav_')) {
      const { parsePrizeResultsNavButtonId } = await import('../../constants');

      const parsed = parsePrizeResultsNavButtonId(buttonId);
      if (!parsed) {
        logger.error('Failed to parse gw_prize_results_nav_ button:', buttonId);
        return buildErrorResponse('Invalid button format.');
      }

      const { giveawayId, direction, page } = parsed;
      const giveaway = giveawayManager.getGiveaway(giveawayId, context.guildId);
      if (!giveaway) {
        return buildErrorResponse('Giveaway not found. It may have been deleted.');
      }

      // Calculate new page
      const newPage = direction === 'prev' ? page - 1 : page + 1;
      return buildPrizeResultsResponse(context, giveawayId, newPage, 0);
    }

    // Handle gw_prize_results_back_ buttons (Prize Results back - Web-UI only)
    if (buttonId.startsWith('gw_prize_results_back_')) {
      const { parsePrizeResultsBackButtonId } = await import('../../constants');

      const parsed = parsePrizeResultsBackButtonId(buttonId);
      if (!parsed) {
        logger.error('Failed to parse gw_prize_results_back_ button:', buttonId);
        return buildErrorResponse('Invalid button format.');
      }

      const { giveawayId, returnPage } = parsed;
      const giveaway = giveawayManager.getGiveaway(giveawayId, context.guildId);
      if (!giveaway) {
        return buildErrorResponse('Giveaway not found. It may have been deleted.');
      }

      return buildDetailPanelResponse(context, giveaway, returnPage);
    }

    // Default: return to main panel
    return await buildMainPanelResponse(context, getPageState(context.userId, context.guildId));
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    // Delegate to createPanel modal handler
    return handleCreatePanelModal(context, modalId);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    if (values.length === 0) {
      return await buildMainPanelResponse(context, 0);
    }

    const selectedValue = values[0];

    // Handle mode selection dropdown (values: button, reaction, trivia, competition)
    const validModes = ['button', 'reaction', 'trivia', 'competition'];
    if (validModes.includes(selectedValue)) {
      logger.info(`[MainPanel] Mode dropdown selection: ${selectedValue}, dropdownId: ${dropdownId}`);

      // If dropdownId is provided (from Web-UI), use it directly
      if (dropdownId) {
        const result = await handleCreatePanelDropdown(context, dropdownId, values);
        if (result) return result;
      } else {
        // Fallback: find the pending giveaway by checking drafts
        const allPending = loadPendingGiveaways(context.guildId);
        const draftPending = allPending.filter(p => p.status === 'draft');

        if (draftPending.length === 1) {
          const pendingId = draftPending[0].id;
          const result = await handleCreatePanelDropdown(context, `mode_${pendingId}`, values);
          if (result) return result;
        } else if (draftPending.length === 0) {
          return buildErrorResponse('No giveaway is being created. Please click Create first.');
        } else {
          logger.warn(`[MainPanel] Multiple draft giveaways found, cannot determine which one for mode change`);
          return buildErrorResponse('Unable to determine which giveaway to update. Please go back and select the giveaway.');
        }
      }
    }

    // Default: return to main panel
    return await buildMainPanelResponse(context, getPageState(context.userId, context.guildId));
  },
};

export default giveawayMainPanel;
