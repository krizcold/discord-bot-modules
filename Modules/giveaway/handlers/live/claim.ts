/**
 * Prize Claim Handler
 * Handles prize claim button for ended giveaways
 */

import { Client, ButtonInteraction, PermissionsBitField } from 'discord.js';
import * as giveawayManager from '../../manager/giveawayManager';
import { DISCORD_EPHEMERAL_FLAG } from '@bot/constants';

/**
 * Handle gw_claim_prize_btn_* button clicks - claim prize for winners
 */
export async function handleClaimPrizeButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  const giveawayId = giveawayManager.getSessionIdFromCustomId(interaction.customId, 'gw_claim_prize_btn');
  if (!giveawayId || !interaction.guildId) {
    await interaction.reply({ content: "Error identifying this giveaway.", flags: DISCORD_EPHEMERAL_FLAG });
    return;
  }

  const giveaway = giveawayManager.getGiveaway(giveawayId, interaction.guildId);
  if (!giveaway) {
    await interaction.reply({ content: "This giveaway could not be found.", flags: DISCORD_EPHEMERAL_FLAG });
    return;
  }
  if (!giveaway.ended) {
    await interaction.reply({ content: "This giveaway has not ended yet. Winners will be announced once it concludes.", flags: DISCORD_EPHEMERAL_FLAG });
    return;
  }
  if (giveaway.cancelled) {
    await interaction.reply({ content: "This giveaway was cancelled, so no prizes can be claimed.", flags: DISCORD_EPHEMERAL_FLAG });
    return;
  }

  const memberPermissions = interaction.member?.permissions as PermissionsBitField | undefined;
  const isAdmin = memberPermissions?.has(PermissionsBitField.Flags.ManageGuild);
  const isCreator = interaction.user.id === giveaway.creatorId;
  const isWinner = giveaway.winners.includes(interaction.user.id);

  if (isWinner) {
    // Check if already claimed
    const alreadyClaimed = giveaway.claimedPrizes?.includes(interaction.user.id);

    // Get this winner's specific prize from prizeAssignments, or fallback to prizes array
    const winnerIndex = giveaway.winners.indexOf(interaction.user.id);
    const myPrize = giveaway.prizeAssignments?.[interaction.user.id]
      || giveaway.prizes[winnerIndex]
      || 'Prize not available';

    // Mark as claimed if not already
    if (!alreadyClaimed) {
      const claimedPrizes = [...(giveaway.claimedPrizes || []), interaction.user.id];
      giveawayManager.updateGiveaway(giveawayId, { claimedPrizes }, interaction.guildId);
    }

    const claimStatus = alreadyClaimed ? ' (previously claimed)' : '';
    await interaction.reply({ content: `🎁 Congratulations! Your prize is: ||${myPrize}||${claimStatus}`, flags: DISCORD_EPHEMERAL_FLAG });
  } else if (isAdmin || isCreator) {
    // For admins, show all prizes
    const prizeInfo = giveaway.prizes.length > 0
      ? `||${giveaway.prizes.join(', ')}||`
      : 'No prizes set';

    const winnersText = giveaway.winners.length > 0
      ? giveaway.winners.map((id: string) => `<@${id}>`).join(', ')
      : 'None';

    await interaction.reply({
      content: `You didn't win this one. As an admin/creator, you can see the prize details: ${prizeInfo}. Winners: ${winnersText}.`,
      flags: DISCORD_EPHEMERAL_FLAG
    });
  } else {
    await interaction.reply({ content: "Nice try! But you are not a winner of this giveaway... Maybe next time!", flags: DISCORD_EPHEMERAL_FLAG });
  }
}
