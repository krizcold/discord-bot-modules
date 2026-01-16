import {
  Client,
  MessageContextMenuCommandInteraction,
  ApplicationCommandType,
  GatewayIntentBits,
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  TextChannel,
} from 'discord.js';
import { ContextMenuCommandOptions } from '@bot/types/commandTypes';
import { registerModalHandler } from '@internal/events/interactionCreate/modalSubmitHandler';
import { resolveEmojisInText } from '@internal/utils/emojiHandler';
import { addMessageRecord } from '../utils/historyManager';
import { SentMessageRecord } from '../types/botChat';

const MODAL_ID_PREFIX = 'bot_chat_reply_modal';

const sendReplyCommand: ContextMenuCommandOptions<MessageContextMenuCommandInteraction> = {
  name: 'Send Reply',
  type: ApplicationCommandType.Message,
  testOnly: true,
  dm_permission: false,
  permissionsRequired: [PermissionFlagsBits.ManageMessages],
  requiredIntents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],

  initialize: (client: Client) => {
    registerModalHandler(client, MODAL_ID_PREFIX, handleModalSubmit);
  },

  callback: async (client: Client, interaction: MessageContextMenuCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetMessage = interaction.targetMessage;

    const modal = new ModalBuilder()
      .setCustomId(`${MODAL_ID_PREFIX}_${targetMessage.channelId}_${targetMessage.id}`)
      .setTitle('Send Reply as Bot');

    const messageInput = new TextInputBuilder()
      .setCustomId('reply_content')
      .setLabel('Reply Message')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter your reply here...')
      .setRequired(true)
      .setMaxLength(2000);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  },
};

async function handleModalSubmit(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const customIdParts = interaction.customId.split('_');
  const replyToMessageId = customIdParts[customIdParts.length - 1];
  const channelId = customIdParts[customIdParts.length - 2];

  const targetChannel = interaction.guild.channels.cache.get(channelId) as TextChannel;

  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.reply({
      content: 'Target channel no longer exists or is invalid.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const replyContent = interaction.fields.getTextInputValue('reply_content');
  const resolvedContent = resolveEmojisInText(replyContent, client, interaction.guild);

  try {
    const targetMessage = await targetChannel.messages.fetch(replyToMessageId);

    const sentMessage = await targetMessage.reply({
      content: resolvedContent,
      allowedMentions: { repliedUser: false },
    });

    const record: SentMessageRecord = {
      messageId: sentMessage.id,
      channelId: targetChannel.id,
      guildId: interaction.guild.id,
      content: resolvedContent,
      sentBy: interaction.user.id,
      sentByTag: interaction.user.tag,
      sentAt: Date.now(),
      isReply: true,
      replyToMessageId: replyToMessageId,
    };

    addMessageRecord(interaction.guild.id, record);

    // Silent acknowledgment - defer and delete
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.deleteReply();
  } catch (error) {
    console.error('[sendReply] Error sending reply:', error);
    await interaction.reply({
      content: 'Failed to send the reply. The original message may have been deleted or bot lacks permissions.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export default sendReplyCommand;
