export interface SentMessageRecord {
  messageId: string;
  channelId: string;
  guildId: string;
  content: string;
  sentBy: string;
  sentByTag: string;
  sentAt: number;
  isReply: boolean;
  replyToMessageId?: string;
}

export interface BotChatHistory {
  messages: SentMessageRecord[];
}
