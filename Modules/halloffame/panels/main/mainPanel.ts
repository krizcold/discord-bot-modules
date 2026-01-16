/**
 * Hall of Fame Main Panel
 * Board list view with pagination
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
import {
  HOF_PANEL_ID,
  HOF_PAGE_BTN,
  buildPaginationButtonId,
  parsePaginationButtonId,
  parseViewButtonId,
  parseToggleButtonId,
  parseDeleteButtonId,
  buildViewButtonId,
} from '../../constants';
import {
  getBoard,
  updateBoard,
  deleteBoard,
  getFeaturedCount,
  syncBoard,
} from '../../manager/boardManager';
import { buildBoardList, formatBoardListItem } from './listBuilder';
import { getPageState, setPageState } from './pageState';
import { buildBoardCreateResponse, handleBoardCreateButton, handleBoardCreateModal, handleBoardCreateDropdown } from '../boardCreate';
import { buildBoardDetailResponse } from '../boardDetail';
import { getHofConfig } from '../../utils/configUtils';

/**
 * Build an error response
 */
function buildErrorResponse(
  message: string,
  options?: { showNavigation?: boolean; page?: number; context?: PanelContext }
): PanelResponse {
  const container = new ContainerBuilder()
    .setAccentColor(V2Colors.danger);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Error\n${message}`)
  );

  if (options?.showNavigation) {
    const page = options.page ?? 0;
    const backButton = new ButtonBuilder()
      .setCustomId(`panel_${HOF_PANEL_ID}_btn_back_${page}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary);

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    if (options.context) {
      const closeButton = createPanelCloseButton(options.context);
      if (closeButton) navRow.addComponents(closeButton);
    }
    container.addActionRowComponents(navRow);
  }

  return createV2Response([container]);
}

/**
 * Build the main panel response
 */
export async function buildMainPanelResponse(context: PanelContext, page: number = 0): Promise<PanelResponse> {
  const guildId = context.guildId!;

  // Get config for this guild
  const config = getHofConfig(guildId);
  const itemsPerPage = config.itemsPerPage;

  const allItems = buildBoardList(guildId);

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
  const disabledCount = allItems.filter(i => i.status === 'disabled').length;

  // Build V2 container with config color
  const container = new ContainerBuilder()
    .setAccentColor(config.colors.mainPanel);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Hall of Fame')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Build list content
  if (pageItems.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('*No boards found.*\nClick **Create** to get started!')
    );
  } else {
    // Build sections for each item with view button accessory
    for (const item of pageItems) {
      const itemText = formatBoardListItem(item, config.nameDisplayCap);

      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(itemText)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`panel_${HOF_PANEL_ID}_btn_view_${item.id}`)
            .setLabel('View')
            .setStyle(ButtonStyle.Secondary)
        );

      container.addSectionComponents(section);
    }

    // Build status summary
    const summaryLines: string[] = [];
    if (activeCount > 0) summaryLines.push(`-# *\`${activeCount}\` Active*`);
    if (disabledCount > 0) summaryLines.push(`-# *\`${disabledCount}\` Disabled*`);

    if (summaryLines.length > 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(summaryLines.join('\n'))
      );
    }
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Pagination row
  const prevButton = new ButtonBuilder()
    .setCustomId(buildPaginationButtonId('prev', currentPage))
    .setLabel(PAGINATION_DEFAULTS.prevLabel)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 0);

  const pageIndicator = new ButtonBuilder()
    .setCustomId(`${HOF_PAGE_BTN}_${currentPage}_${totalPages}`)
    .setLabel(PAGINATION_DEFAULTS.pageFormat(currentPage + 1, totalPages))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(totalPages <= 1);

  const nextButton = new ButtonBuilder()
    .setCustomId(buildPaginationButtonId('next', currentPage))
    .setLabel(PAGINATION_DEFAULTS.nextLabel)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages - 1);

  const createButton = new ButtonBuilder()
    .setCustomId(`panel_${HOF_PANEL_ID}_btn_create`)
    .setLabel('Create')
    .setEmoji('\u2795')
    .setStyle(ButtonStyle.Success);

  const closeButton = createPanelCloseButton(context);

  const navRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(prevButton, pageIndicator, nextButton, createButton);
  if (closeButton) navRow.addComponents(closeButton);
  container.addActionRowComponents(navRow);

  return createV2Response([container]);
}

/**
 * Main Hall of Fame Panel
 */
const hofMainPanel: PanelOptions = {
  id: HOF_PANEL_ID,
  name: 'Hall of Fame',
  description: 'Manage Hall of Fame boards for your server',
  category: 'Fun',
  panelScope: 'guild',

  showInAdminPanel: true,
  adminPanelOrder: 15,
  adminPanelIcon: '\u2B50',

  requiredPermissions: [PermissionFlagsBits.ManageGuild],
  requiredIntents: [GatewayIntentBits.Guilds],

  callback: async (context: PanelContext): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    const currentPage = getPageState(context.userId, context.guildId);
    return await buildMainPanelResponse(context, currentPage);
  },

  handleButton: async (context: PanelContext, buttonId: string): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    const currentPage = getPageState(context.userId, context.guildId);

    // Handle pagination buttons
    const paginationParsed = parsePaginationButtonId(`panel_${HOF_PANEL_ID}_btn_${buttonId}`);
    if (paginationParsed || buttonId.startsWith('prev_') || buttonId.startsWith('next_')) {
      let newPage: number;

      if (buttonId.startsWith('prev_')) {
        const page = parseInt(buttonId.split('_')[1], 10);
        newPage = Math.max(0, page - 1);
      } else if (buttonId.startsWith('next_')) {
        const page = parseInt(buttonId.split('_')[1], 10);
        newPage = page + 1;
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

    // Handle back button
    if (buttonId.startsWith('back_') || buttonId === 'back') {
      const page = buttonId.startsWith('back_')
        ? parseInt(buttonId.split('_')[1], 10) || 0
        : currentPage;
      return await buildMainPanelResponse(context, page);
    }

    // Handle create button
    if (buttonId === 'create') {
      return buildBoardCreateResponse(context, null);
    }

    // Delegate to board create panel handlers FIRST (handles form fields)
    // This must come before edit_/toggle_ handlers to avoid collision with edit_{boardId}/toggle_{boardId}
    const result = await handleBoardCreateButton(context, buttonId);
    if (result !== null) return result;

    // Handle view button (view_{boardId})
    if (buttonId.startsWith('view_')) {
      const boardId = buttonId.slice(5); // Remove 'view_'
      const board = getBoard(context.guildId, boardId);
      if (!board) {
        return buildErrorResponse('Board not found.', { showNavigation: true, page: currentPage, context });
      }
      return buildBoardDetailResponse(context, board, currentPage);
    }

    // Handle toggle button for board enable/disable (toggle_{boardId} where boardId is UUID)
    if (buttonId.startsWith('toggle_')) {
      const boardId = buttonId.slice(7); // Remove 'toggle_'
      // Only handle if it looks like a UUID (36 chars with hyphens)
      if (boardId.length === 36 && boardId.includes('-')) {
        const board = getBoard(context.guildId, boardId);
        if (!board) {
          return buildErrorResponse('Board not found.', { showNavigation: true, page: currentPage, context });
        }
        updateBoard(context.guildId, boardId, { enabled: !board.enabled });
        const updatedBoard = getBoard(context.guildId, boardId);
        if (updatedBoard) {
          return buildBoardDetailResponse(context, updatedBoard, currentPage);
        }
        return await buildMainPanelResponse(context, currentPage);
      }
    }

    // Handle delete button (delete_{boardId})
    if (buttonId.startsWith('delete_')) {
      const boardId = buttonId.slice(7); // Remove 'delete_'
      deleteBoard(context.guildId, boardId);
      return await buildMainPanelResponse(context, currentPage);
    }

    // Handle edit button for board editing (edit_{boardId} where boardId is UUID)
    if (buttonId.startsWith('edit_')) {
      const boardId = buttonId.slice(5); // Remove 'edit_'
      // Only handle if it looks like a UUID (36 chars with hyphens)
      if (boardId.length === 36 && boardId.includes('-')) {
        const board = getBoard(context.guildId, boardId);
        if (!board) {
          return buildErrorResponse('Board not found.', { showNavigation: true, page: currentPage, context });
        }
        return buildBoardCreateResponse(context, board);
      }
    }

    // Handle reload button (reload_{boardId})
    if (buttonId.startsWith('reload_')) {
      const boardId = buttonId.slice(7); // Remove 'reload_'
      if (boardId.length === 36 && boardId.includes('-')) {
        const board = getBoard(context.guildId, boardId);
        if (!board) {
          return buildErrorResponse('Board not found.', { showNavigation: true, page: currentPage, context });
        }

        // Perform sync
        const result = await syncBoard(context.client, context.guildId, boardId);

        // Build response with sync results
        const container = new ContainerBuilder()
          .setAccentColor(V2Colors.success);

        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${board.emojiDisplay} ${board.name}\n### Sync Complete`)
        );

        const resultLines: string[] = [];
        if (result.removedFeatured > 0) {
          resultLines.push(`Removed **${result.removedFeatured}** stale featured records`);
        }
        if (result.addedReactions > 0) {
          resultLines.push(`Added **${result.addedReactions}** missing reactions`);
        }
        if (resultLines.length === 0) {
          resultLines.push('Everything is in sync!');
        }
        if (result.errors.length > 0) {
          resultLines.push(`\n-# ${result.errors.length} error(s) occurred`);
        }

        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(resultLines.join('\n'))
        );

        const backButton = new ButtonBuilder()
          .setCustomId(`panel_${HOF_PANEL_ID}_btn_view_${boardId}`)
          .setLabel('Back to Board')
          .setStyle(ButtonStyle.Secondary);

        container.addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
        );

        return createV2Response([container]);
      }
    }

    // Default: return to main panel
    return await buildMainPanelResponse(context, currentPage);
  },

  handleModal: async (context: PanelContext, modalId: string): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    // Delegate to board create modal handler (handles both create and edit)
    return handleBoardCreateModal(context, modalId);
  },

  handleDropdown: async (context: PanelContext, values: string[], dropdownId?: string): Promise<PanelResponse> => {
    if (!context.guildId) {
      return buildErrorResponse('This panel can only be used in a server.');
    }

    // Delegate to board create dropdown handler (handles both create and edit)
    if (dropdownId) {
      const result = await handleBoardCreateDropdown(context, dropdownId, values);
      if (result) return result;
    }

    // Default: return to main panel
    return await buildMainPanelResponse(context, getPageState(context.userId, context.guildId));
  },
};

export default hofMainPanel;
