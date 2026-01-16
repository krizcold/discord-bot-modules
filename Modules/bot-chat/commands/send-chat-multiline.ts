import {
  Client,
  CommandInteraction,
  ChatInputCommandInteraction,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  MessageFlags,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { registerModalHandler } from '@internal/events/interactionCreate/modalSubmitHandler';
import { resolveEmojisInText } from '@internal/utils/emojiHandler';
import { addMessageRecord } from '../utils/historyManager';
import { SentMessageRecord } from '../types/botChat';

const MODAL_ID_PREFIX = 'bot_chat_multiline_modal';

const sendChatMultilineCommand: CommandOptions = {
  name: 'send-chat-multiline',
  description: 'Send a multiline message as the bot using a modal',
  testOnly: true,
  dm_permission: false,
  permissionsRequired: [PermissionFlagsBits.ManageMessages],
  requiredIntents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],

  options: [
    {
      name: 'channel',
      description: 'Channel to send the message (defaults to current channel)',
      type: ApplicationCommandOptionType.Channel,
      required: false,
    },
  ],

  initialize: (client: Client) => {
    registerModalHandler(client, MODAL_ID_PREFIX, handleModalSubmit);
  },

  callback: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const chatInteraction = interaction as ChatInputCommandInteraction;
    const targetChannel = (chatInteraction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({
        content: 'Invalid channel specified.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`${MODAL_ID_PREFIX}_${targetChannel.id}`)
      .setTitle('Send Message as Bot');

    const messageInput = new TextInputBuilder()
      .setCustomId('message_content')
      .setLabel('Message')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter your message here...')
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
  const channelId = customIdParts[customIdParts.length - 1];

  const targetChannel = interaction.guild.channels.cache.get(channelId) as TextChannel;

  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.reply({
      content: 'Target channel no longer exists or is invalid.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const messageContent = interaction.fields.getTextInputValue('message_content');
  const resolvedContent = resolveEmojisInText(messageContent, client, interaction.guild);

  try {
    const sentMessage = await targetChannel.send(resolvedContent);

    const record: SentMessageRecord = {
      messageId: sentMessage.id,
      channelId: targetChannel.id,
      guildId: interaction.guild.id,
      content: resolvedContent,
      sentBy: interaction.user.id,
      sentByTag: interaction.user.tag,
      sentAt: Date.now(),
      isReply: false,
    };

    addMessageRecord(interaction.guild.id, record);

    // Silent acknowledgment - defer and delete
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.deleteReply();
  } catch (error) {
    console.error('[send-chat-multiline] Error sending message:', error);
    await interaction.reply({
      content: 'Failed to send the message. Check bot permissions.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export default sendChatMultilineCommand;
