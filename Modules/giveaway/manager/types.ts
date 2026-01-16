import { TextBasedChannel, ChannelType } from 'discord.js';

export type DefinitelySendableChannel = TextBasedChannel & {
  type: ChannelType.GuildText |
        ChannelType.DM |
        ChannelType.GuildNews |
        ChannelType.GuildNewsThread |
        ChannelType.GuildPublicThread |
        ChannelType.GuildPrivateThread |
        ChannelType.GuildVoice
};

export function isChannelDefinitelySendable(channel: any): channel is DefinitelySendableChannel {
  if (!channel) return false;
  return typeof channel.send === 'function' &&
         channel.isTextBased() &&
         !channel.partial &&
         channel.type !== ChannelType.GuildStageVoice;
}

export interface UserGiveawayEntry {
  triviaAttemptsMade?: number;
}

export interface UserGiveawayData {
  [giveawayId: string]: {
    [userId: string]: UserGiveawayEntry;
  }
}
