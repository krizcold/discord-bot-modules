/**
 * Button Entry Handler
 * Handles button-based giveaway entry (entryMode: 'button')
 */

import { Client, ButtonInteraction } from 'discord.js';
import * as giveawayManager from '../../manager/giveawayManager';
import { DISCORD_EPHEMERAL_FLAG } from '@bot/constants';
import { validateGiveawayEntry, replyWithError } from './validation';

/**
 * Handle gw_enter_btn_* button clicks - enter giveaway via button
 */
export async function handleGiveawayEnterButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  // Validate entry
  const validation = await validateGiveawayEntry(interaction, 'gw_enter_btn', {
    expectedModes: ['button'],
  });

  if (!validation.valid || !validation.giveaway) {
    await replyWithError(interaction, validation.error || "Could not process entry.");
    return;
  }

  const giveaway = validation.giveaway;

  // Check if already entered
  if (giveaway.participants.includes(interaction.user.id)) {
    await interaction.reply({ content: "You are already entered in this giveaway!", flags: DISCORD_EPHEMERAL_FLAG });
    return;
  }

  // Add participant
  const added = giveawayManager.addParticipant(giveaway.id, interaction.user.id, interaction.guildId!);

  if (added) {
    await interaction.reply({ content: "You have successfully entered the giveaway! 🎉", flags: DISCORD_EPHEMERAL_FLAG });
  } else {
    await interaction.reply({ content: "Could not enter the giveaway at this time.", flags: DISCORD_EPHEMERAL_FLAG });
  }
}
