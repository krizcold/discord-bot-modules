/**
 * Check Prize Button Handler
 * Shows prize as ephemeral spoilered message
 */

import { ButtonInteraction, Client, MessageFlags } from 'discord.js';
import { parseCheckPrizeButtonId } from '../../constants';
import { getPendingGiveaway } from '../../state';
import { createLogger } from '@internal/utils/logger';

const logger = createLogger('Giveaway');

/**
 * Handle gw_check_prize_* button clicks - show prize as ephemeral spoilered message
 * Supports both single prize and multi-prize giveaways
 */
export async function handleCheckPrizeButton(
  client: Client,
  interaction: ButtonInteraction
): Promise<void> {
  const pendingId = parseCheckPrizeButtonId(interaction.customId);
  if (!pendingId) {
    logger.error('Failed to parse check prize button ID:', interaction.customId);
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const pending = getPendingGiveaway(guildId, pendingId);
  if (!pending) {
    await interaction.reply({ content: 'Giveaway not found. It may have been deleted.', flags: MessageFlags.Ephemeral });
    return;
  }

  const winnerCount = pending.winnerCount || 1;

  // Multi-prize giveaway: show all prizes
  if (winnerCount > 1) {
    const prizes = pending.prizes || [];
    const lines: string[] = [];

    for (let i = 0; i < winnerCount; i++) {
      const prize = prizes[i];
      if (prize && prize.trim()) {
        lines.push(`**${i + 1}.** ||${prize}||`);
      } else {
        lines.push(`**${i + 1}.** *Not set*`);
      }
    }

    await interaction.reply({
      content: lines.join('\n'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Single prize mode
  const singlePrize = pending.prizes?.[0];
  const prizeText = singlePrize && singlePrize.trim()
    ? `||${singlePrize}||`
    : '*No prize set*';

  await interaction.reply({
    content: prizeText,
    flags: MessageFlags.Ephemeral,
  });
}
