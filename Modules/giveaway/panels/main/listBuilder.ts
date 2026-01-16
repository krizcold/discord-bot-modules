/**
 * Giveaway List Builder
 * Functions for building and formatting giveaway lists
 */

import type { Client } from 'discord.js';
import { GiveawayDisplayStatus, GiveawayListItem, StoredPendingGiveaway } from '../../types';
import { STATUS_EMOJI } from '../../constants';
import { formatDiscordTimestamp } from '../../utils/displayFormatters';
import * as giveawayManager from '../../manager/giveawayManager';
import { loadPendingGiveaways } from '../../state';
import { resolveBoxEmojis, getBoxEmoji } from './emojiResolver';

// Width constraints (in emoji segments, excluding corners and center)
const BOX_MIN_SEGMENTS = 4;  // Minimum horizontal segments per side
const BOX_MAX_SEGMENTS = 8;  // Maximum horizontal segments per side

/**
 * Build list of all giveaways for display
 * Combines active giveaways with pending giveaways
 */
export function buildGiveawayList(guildId: string): GiveawayListItem[] {
  const items: GiveawayListItem[] = [];
  const now = Date.now();

  // Get all active/ended giveaways
  const allGiveaways = giveawayManager.getAllGiveaways(guildId, false);
  for (const g of allGiveaways) {
    let status: GiveawayDisplayStatus;
    let timestamp: number;

    if (g.cancelled) {
      status = 'cancelled';
      timestamp = g.endTime;
    } else if (g.ended) {
      status = 'ended';
      timestamp = g.endTime;
    } else if (g.endTime > now) {
      status = 'active';
      timestamp = g.endTime;
    } else {
      // Processing...
      status = 'active';
      timestamp = g.endTime;
    }

    items.push({
      id: g.id,
      title: g.title,
      status,
      timestamp,
      winnerCount: g.ended ? g.winners.length : undefined,
      isPending: false,
    });
  }

  // Get all pending giveaways (ready to start)
  const pendingGiveaways = loadPendingGiveaways(guildId);
  for (const p of pendingGiveaways) {
    items.push({
      id: p.id,
      title: p.title || 'Untitled Giveaway',
      status: p.status === 'ready' ? 'pending' : 'pending', // Both draft and ready are 'pending' for display
      timestamp: p.createdAt,
      isPending: true,
    });
  }

  // Sort: Pending first, then Active (ongoing), then Ended/Cancelled
  // Within each group, sort by timestamp (newer first)
  const statusOrder: Record<GiveawayDisplayStatus, number> = {
    pending: 0,
    active: 1,
    ended: 2,
    cancelled: 3,
  };

  items.sort((a, b) => {
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    if (orderDiff !== 0) return orderDiff;
    return b.timestamp - a.timestamp;
  });

  return items;
}

/**
 * Get status emoji for a giveaway item
 */
export function getStatusEmoji(item: GiveawayListItem, pending?: StoredPendingGiveaway): string {
  if (item.isPending && pending) {
    return pending.status === 'ready' ? STATUS_EMOJI.pending : STATUS_EMOJI.draft;
  }
  return STATUS_EMOJI[item.status];
}

/**
 * Format a giveaway item for the list display
 * Uses ### heading for compact but visible display in sections
 */
export function formatGiveawayListItem(item: GiveawayListItem, pending?: StoredPendingGiveaway): string {
  const emoji = getStatusEmoji(item, pending);
  const title = item.title.length > 30 ? item.title.substring(0, 27) + '...' : item.title;
  const relativeTime = formatDiscordTimestamp(item.timestamp, 'R');

  switch (item.status) {
    case 'active':
      return `### ${emoji} \`${title}\` \u2022 Ends ${relativeTime}`;
    case 'pending':
      if (pending?.status === 'ready') {
        return `### ${emoji} \`${title}\` \u2022 Ready`;
      } else {
        return `### ${STATUS_EMOJI.draft} \`${title}\` \u2022 \`Draft\``;
      }
    case 'ended':
      // Show date ended (day/month/year) using 'd' style
      const endedDate = formatDiscordTimestamp(item.timestamp, 'd');
      return `### ${emoji} \`${title}\` \u2022 ${endedDate}`;
    case 'cancelled':
      return `### ${emoji} \`${title}\` \u2022 Cancelled`;
    default:
      return `### ${emoji} \`${title}\``;
  }
}

/**
 * Build separator lines using custom emojis
 * Spaces between all emojis EXCEPT: horizontals stick together, decorations stick together
 * Format: :ul: :uh::uh::uh: :ca::cb: :uh::uh::uh: :ur:
 */
export async function buildSeparatorBox(contentLines: string[], client: Client): Promise<{ top: string; bottom: string }> {
  // Ensure emojis are resolved
  await resolveBoxEmojis(client);

  // Calculate the longest line length (approximate - emojis count as 2)
  let maxLen = 0;
  for (const line of contentLines) {
    let len = 0;
    for (const char of line) {
      len += char.charCodeAt(0) > 0xFF ? 2 : 1;
    }
    if (len > maxLen) maxLen = len;
  }

  // Convert character width to emoji segment count
  // Each emoji is roughly 2 characters wide when rendered
  let segmentsPerSide = Math.ceil(maxLen / 4);

  // Clamp to bounds and ensure even number for symmetry
  segmentsPerSide = Math.min(BOX_MAX_SEGMENTS, Math.max(BOX_MIN_SEGMENTS, segmentsPerSide));

  // Get resolved emojis
  const UL = getBoxEmoji('ul');
  const UH = getBoxEmoji('uh');
  const CA = getBoxEmoji('ca');
  const CB = getBoxEmoji('cb');
  const UR = getBoxEmoji('ur');
  const DL = getBoxEmoji('dl');
  const DH = getBoxEmoji('dh');
  const DR = getBoxEmoji('dr');

  // Build horizontal segments (no spaces between them)
  const topSideSegments = UH.repeat(segmentsPerSide);
  const bottomSegments = DH.repeat(segmentsPerSide * 2 + 3); // +3 extra dh segments

  // Top: no spaces between corners and horizontals, extra spaces around decorations
  // Use en space (\u2002) for spacing around decorations
  const top = `${UL}${topSideSegments}\u2002${CA} ${CB}\u2002${topSideSegments}${UR}`;

  // Bottom: no spaces between corners and horizontals
  const bottom = `${DL}${bottomSegments}${DR}`;

  return { top, bottom };
}
