/**
 * Hall of Fame List Builder
 * Functions for building and formatting board lists
 */

import { Board, BoardListItem, BoardDisplayStatus } from '../../types';
import { getAllBoards, getFeaturedCount } from '../../manager/boardManager';
import { getHofConfig } from '../../utils/configUtils';

// Status emojis for boards
export const STATUS_EMOJI: Record<BoardDisplayStatus, string> = {
  active: '\u2705',     // Green checkmark
  disabled: '\u26D4',   // No entry
};

/**
 * Build list of all boards for display
 */
export function buildBoardList(guildId: string): BoardListItem[] {
  const boards = getAllBoards(guildId);
  const items: BoardListItem[] = [];

  for (const board of boards) {
    const status: BoardDisplayStatus = board.enabled ? 'active' : 'disabled';
    const featuredCount = getFeaturedCount(guildId, board.id);

    items.push({
      id: board.id,
      name: board.name,
      emojiDisplay: board.emojiDisplay,
      status,
      featuredCount,
    });
  }

  // Sort: Active first, then disabled
  // Within each group, sort by name
  items.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return items;
}

/**
 * Get status emoji for a board
 */
export function getStatusEmoji(status: BoardDisplayStatus): string {
  return STATUS_EMOJI[status];
}

/**
 * Format a board item for the list display
 * @param item - The board list item
 * @param nameDisplayCap - Max characters for name (from settings)
 */
export function formatBoardListItem(item: BoardListItem, nameDisplayCap: number = 25): string {
  const statusEmoji = getStatusEmoji(item.status);
  const truncateAt = Math.max(10, nameDisplayCap - 3); // Leave room for "..."
  const name = item.name.length > nameDisplayCap ? item.name.substring(0, truncateAt) + '...' : item.name;
  const featuredText = item.featuredCount === 1 ? '1 featured' : `${item.featuredCount} featured`;

  if (item.status === 'active') {
    return `### ${item.emojiDisplay} \`${name}\` \u2022 ${featuredText}`;
  } else {
    return `### ${statusEmoji} \`${name}\` \u2022 Disabled`;
  }
}
