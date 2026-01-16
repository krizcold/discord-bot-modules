import {
  Client,
  CommandInteraction,
  ChatInputCommandInteraction,
  GatewayIntentBits,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  MessageFlags,
  TextChannel,
} from 'discord.js';
import { CommandOptions } from '@bot/types/commandTypes';
import { resolveEmojisInText } from '@internal/utils/emojiHandler';
import { addMessageRecord } from '../utils/historyManager';
import { SentMessageRecord } from '../types/botChat';

const sendChatCommand: CommandOptions = {
  name: 'send-chat',
  description: 'Send a message as the bot',
  testOnly: true,
  dm_permission: false,
  permissionsRequired: [PermissionFlagsBits.ManageMessages],
  requiredIntents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],

  options: [
    {
      name: 'message',
      description: 'The message to send',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'channel',
      description: 'Channel to send the message (defaults to current channel)',
      type: ApplicationCommandOptionType.Channel,
      required: false,
    },
  ],

  callback: async (client: Client, interaction: CommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const chatInteraction = interaction as ChatInputCommandInteraction;
    const messageContent = chatInteraction.options.getString('message', true);
    const targetChannel = (chatInteraction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({
        content: 'Invalid channel specified.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const resolvedContent = resolveEmojisInText(messageContent, client, interaction.guild);
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

      // Silent acknowledgment - result is visible in channel
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.deleteReply();
    } catch (error) {
      console.error('[send-chat] Error sending message:', error);
      await interaction.reply({
        content: 'Failed to send the message. Check bot permissions.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default sendChatCommand;
