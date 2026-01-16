/**
 * Message building utilities for the Giveaway module (Components V2)
 * This file provides centralized functions for creating consistent V2 containers
 * and helps reduce duplication across different handlers.
 *
 * IMPORTANT: Prize is CONFIDENTIAL - never show actual prize content!
 * Prize is only revealed to winners when they claim it via ephemeral response.
 *
 * NOTE: V2 TextDisplay mentions WILL ping users (unlike embeds)!
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  User,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { Giveaway } from '@bot/types/commandTypes';
import { getConfigColor, getConfigLabel } from './configUtils';
import {
  GW_ENTER_BTN_PREFIX,
  GW_TRIVIA_ANSWER_BTN_PREFIX,
  GW_COMPETITION_ANSWER_BTN_PREFIX,
  GW_CLAIM_PRIZE_BTN_PREFIX,
} from '../constants';

// Re-export MessageFlags for V2
export { MessageFlags };

/**
 * Build action row components for giveaway announcement
 *
 * @param giveaway - The giveaway data
 * @param guildId - The guild ID for configuration
 * @returns Array of action row builders with buttons
 */
export function buildGiveawayAnnouncementComponents(
  giveaway: Giveaway,
  guildId: string
): ActionRowBuilder<ButtonBuilder>[] {
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (giveaway.entryMode === 'button') {
    const entryButton = new ButtonBuilder()
      .setCustomId(`${GW_ENTER_BTN_PREFIX}_${giveaway.id}`)
      .setLabel(getConfigLabel('enterButton', guildId))
      .setStyle(ButtonStyle.Success);

    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(entryButton));
  } else if (giveaway.entryMode === 'trivia') {
    const triviaButton = new ButtonBuilder()
      .setCustomId(`${GW_TRIVIA_ANSWER_BTN_PREFIX}_${giveaway.id}`)
      .setLabel(getConfigLabel('triviaButton', guildId))
      .setStyle(ButtonStyle.Primary);

    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(triviaButton));
  } else if (giveaway.entryMode === 'competition') {
    // Competition has its own dedicated handler
    const competitionButton = new ButtonBuilder()
      .setCustomId(`${GW_COMPETITION_ANSWER_BTN_PREFIX}_${giveaway.id}`)
      .setLabel('🏆 Answer')
      .setStyle(ButtonStyle.Primary);

    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(competitionButton));
  }

  return components;
}

// ============================================================================
// COMPONENTS V2 BUILDERS
// These use Container/Section/TextDisplay instead of Embeds
// NOTE: Mentions in TextDisplay WILL ping users!
// ============================================================================

/**
 * Get placement medal emoji
 */
function getPlacementEmoji(placement: number): string {
  switch (placement) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return '🎗️';
  }
}

/**
 * Build V2 container for giveaway announcement (active giveaway)
 *
 * @param giveaway - The giveaway data
 * @param creator - The user who created the giveaway (optional for Web-UI)
 * @param guildId - The guild ID for configuration
 * @returns V2 container with action row
 */
export function buildGiveawayAnnouncementV2(
  giveaway: Giveaway,
  creator: User | undefined,
  guildId: string
): { container: ContainerBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const container = new ContainerBuilder()
    .setAccentColor(getConfigColor('activeGiveaway', guildId));

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 🎉 ${giveaway.title} 🎉`)
  );

  // Entry mode description
  let description = 'A new giveaway has started!';
  if (giveaway.entryMode === 'button') {
    description += '\nClick the button below to participate.';
  } else if (giveaway.entryMode === 'reaction') {
    description += `\nReact with ${giveaway.reactionDisplayEmoji} to participate.`;
  } else if (giveaway.entryMode === 'trivia') {
    description += '\nAnswer the trivia question to participate.';
    if (giveaway.maxTriviaAttempts && giveaway.maxTriviaAttempts > 0) {
      description += ` *You have ${giveaway.maxTriviaAttempts} attempt(s).*`;
    }
  } else if (giveaway.entryMode === 'competition') {
    description += `\n🏆 **Competition Mode** - First ${giveaway.winnerCount} correct answers win!`;
    if (giveaway.maxTriviaAttempts && giveaway.maxTriviaAttempts > 0) {
      description += ` *You have ${giveaway.maxTriviaAttempts} attempt(s).*`;
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(description)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Ends In section
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Ends:** <t:${Math.floor(giveaway.endTime / 1000)}:R>`)
  );

  // Trivia/Competition question
  if ((giveaway.entryMode === 'trivia' || giveaway.entryMode === 'competition') && giveaway.triviaQuestion) {
    const questionLabel = giveaway.entryMode === 'competition' ? 'Competition Question' : 'Trivia Question';
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${questionLabel}:**\n${giveaway.triviaQuestion}`)
    );
  }

  // Live leaderboard for competition mode
  if (giveaway.entryMode === 'competition' && giveaway.liveLeaderboard !== false) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**🏆 Leaderboard:**\n*No winners yet*')
    );
  }

  // Footer
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Started by ${creator?.tag || 'Unknown'}`)
  );

  // Build action row with entry button
  const components = buildGiveawayAnnouncementComponents(giveaway, guildId);

  return { container, components };
}

/**
 * Build V2 container for giveaway ended announcement (results)
 * NOTE: Winner mentions in TextDisplay WILL ping them!
 *
 * @param giveaway - The giveaway data
 * @param winners - Array of winner User objects
 * @param isCompetition - Whether this is competition mode
 * @returns V2 container with claim button
 */
export function buildGiveawayEndedV2(
  giveaway: Giveaway,
  winners: User[],
  isCompetition: boolean
): { container: ContainerBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const accentColor = isCompetition ? 0xFFD700 : 0x00FFFF; // Gold for competition, Aqua for regular

  const container = new ContainerBuilder()
    .setAccentColor(accentColor);

  // Title
  const title = isCompetition
    ? `# 🏆 Competition Ended: ${giveaway.title} 🏆`
    : `# 🎉 Giveaway Ended: ${giveaway.title} 🎉`;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(title)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  if (winners.length > 0) {
    // Congratulations message (mentions will ping!)
    const winnerMentions = winners.map(w => `<@${w.id}>`).join(' ');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🎊 **Congratulations** ${winnerMentions}!`)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Click the button below to claim your prize.')
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Winners list
    if (isCompetition) {
      const winnerLines = winners.map((w, idx) => `${getPlacementEmoji(idx)} ${w.toString()}`);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**🏆 Final Standings:**\n${winnerLines.join('\n')}`)
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**🏆 Winners:**\n${winners.map(w => w.toString()).join(', ')}`)
      );
    }
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('*Unfortunately, there were no participants in this giveaway, so no winner could be chosen.*')
    );
  }

  // Footer
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${isCompetition ? 'Competition' : 'Giveaway'} Concluded • <t:${Math.floor(giveaway.endTime / 1000)}:f>`)
  );

  // Claim button
  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (winners.length > 0) {
    const claimButton = new ButtonBuilder()
      .setCustomId(`${GW_CLAIM_PRIZE_BTN_PREFIX}_${giveaway.id}`)
      .setLabel('🎁 Claim Prize')
      .setStyle(ButtonStyle.Success);

    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton));
  }

  return { container, components };
}

/**
 * Build V2 container for original message when giveaway ends
 * Shows "ended" state with link to results
 *
 * @param giveaway - The giveaway data
 * @param resultsUrl - URL to the results message
 * @returns V2 container (no buttons)
 */
export function buildGiveawayOriginalEndedV2(
  giveaway: Giveaway,
  resultsUrl: string
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(0x808080); // Grey

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 🎉 ${giveaway.title} 🎉`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`*This giveaway has ended! [View Results](${resultsUrl})*`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Ended • <t:${Math.floor(giveaway.endTime / 1000)}:f>`)
  );

  return container;
}

/**
 * Build V2 container for cancelled giveaway
 *
 * @param giveaway - The giveaway data
 * @returns V2 container (no buttons)
 */
export function buildGiveawayCancelledV2(
  giveaway: Giveaway
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(0xED4245); // Red

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 🚫 Giveaway Cancelled: ${giveaway.title} 🚫`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('*This giveaway has been cancelled.*')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Cancelled • <t:${Math.floor(Date.now() / 1000)}:f>`)
  );

  return container;
}

/**
 * Build V2 leaderboard text for competition mode live updates
 *
 * @param placements - Object mapping userId to placement index
 * @returns Formatted leaderboard string
 */
export function buildCompetitionLeaderboardText(
  placements: Record<string, number>
): string {
  const sortedPlacements = Object.entries(placements)
    .sort(([, a], [, b]) => a - b);

  if (sortedPlacements.length === 0) {
    return '**🏆 Leaderboard:**\n*No winners yet*';
  }

  const lines = sortedPlacements.map(([userId, placement]) =>
    `${getPlacementEmoji(placement)} <@${userId}>`
  );

  return `**🏆 Leaderboard:**\n${lines.join('\n')}`;
}