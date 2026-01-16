import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { getModuleSetting } from '@internal/utils/settings/settingsStorage';
import { SentMessageRecord, BotChatHistory } from '../types/botChat';

const MODULE_NAME = 'bot-chat';
const MODULE_CATEGORY = 'moderation';
const HISTORY_FILE = 'history.json';
const DEFAULT_HISTORY_LIMIT = 30;

function getHistoryLimit(guildId: string): number {
  const limit = getModuleSetting<number>(MODULE_NAME, 'historyLimit', guildId, MODULE_CATEGORY);
  return limit ?? DEFAULT_HISTORY_LIMIT;
}

function getDefaultHistory(): BotChatHistory {
  return { messages: [] };
}

export function getHistory(guildId: string): BotChatHistory {
  return loadModuleData<BotChatHistory>(HISTORY_FILE, guildId, MODULE_NAME, getDefaultHistory());
}

export function saveHistory(guildId: string, history: BotChatHistory): void {
  saveModuleData(HISTORY_FILE, guildId, MODULE_NAME, history);
}

export function addMessageRecord(guildId: string, record: SentMessageRecord): void {
  const history = getHistory(guildId);
  const historyLimit = getHistoryLimit(guildId);

  history.messages.unshift(record);

  if (history.messages.length > historyLimit) {
    history.messages = history.messages.slice(0, historyLimit);
  }

  saveHistory(guildId, history);
}

export function getMessageRecords(guildId: string, limit?: number): SentMessageRecord[] {
  const history = getHistory(guildId);
  if (limit) {
    return history.messages.slice(0, limit);
  }
  return history.messages;
}

export function clearHistory(guildId: string): void {
  saveHistory(guildId, getDefaultHistory());
}

export function deleteMessageRecord(guildId: string, index: number): boolean {
  const history = getHistory(guildId);

  if (index < 0 || index >= history.messages.length) {
    return false;
  }

  history.messages.splice(index, 1);
  saveHistory(guildId, history);
  return true;
}
