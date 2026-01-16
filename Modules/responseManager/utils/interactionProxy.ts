/**
 * Message Interaction Proxy
 *
 * A proxy class that mimics CommandInteraction interface but uses Message data.
 * This allows triggering slash command callbacks from message-based triggers.
 *
 * Limitations:
 * - getUser/getChannel/getRole/getMentionable return null (not supported via text)
 * - getAttachment returns null (not supported via text)
 * - Subcommands not supported
 */

import {
  Client,
  Message,
  Guild,
  GuildMember,
  User,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  InteractionType,
  ApplicationCommandType,
  Locale,
  MessageFlags,
  InteractionReplyOptions,
  InteractionEditReplyOptions,
  MessagePayload,
} from 'discord.js';
import { ResponseGroup, ArgumentMapping } from '../types/responseManager';

/**
 * Options passed to command via the proxy
 */
class ProxyOptions {
  private args: Record<string, string>;
  private mapping: Record<string, ArgumentMapping>;

  constructor(parsedVars: Record<string, string>, mapping: Record<string, ArgumentMapping>) {
    this.args = parsedVars;
    this.mapping = mapping;
  }

  /**
   * Get the mapped value for an argument
   */
  private getMappedValue(name: string): string | null {
    const argMapping = this.mapping[name];
    if (!argMapping) return null;

    if (argMapping.source === 'static') {
      return argMapping.value;
    }

    // Source is 'variable' - get from parsed vars
    return this.args[argMapping.value] ?? null;
  }

  getString(name: string, required?: boolean): string | null {
    return this.getMappedValue(name);
  }

  getInteger(name: string, required?: boolean): number | null {
    const val = this.getMappedValue(name);
    if (val === null) return null;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  }

  getNumber(name: string, required?: boolean): number | null {
    const val = this.getMappedValue(name);
    if (val === null) return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }

  getBoolean(name: string, required?: boolean): boolean | null {
    const val = this.getMappedValue(name)?.toLowerCase();
    if (val === 'true' || val === 'yes' || val === '1') return true;
    if (val === 'false' || val === 'no' || val === '0') return false;
    return null;
  }

  // These require Discord-specific resolution, not supported via text
  getUser(name: string, required?: boolean): User | null {
    return null;
  }

  getMember(name: string): GuildMember | null {
    return null;
  }

  getChannel(name: string, required?: boolean): TextChannel | NewsChannel | ThreadChannel | null {
    return null;
  }

  getRole(name: string, required?: boolean): null {
    return null;
  }

  getMentionable(name: string, required?: boolean): null {
    return null;
  }

  getAttachment(name: string, required?: boolean): null {
    return null;
  }

  // Subcommands not supported
  getSubcommand(required?: boolean): string | null {
    return null;
  }

  getSubcommandGroup(required?: boolean): string | null {
    return null;
  }

  getFocused(getFull?: boolean): string | { name: string; type: string; value: string } {
    return '';
  }

  get data() {
    return { options: [] };
  }

  get resolved() {
    return null;
  }
}

/**
 * MessageInteractionProxy
 *
 * Mimics a CommandInteraction using Message data, allowing slash command
 * callbacks to be executed from message triggers.
 */
export class MessageInteractionProxy {
  readonly client: Client;
  readonly message: Message;
  readonly commandName: string;
  readonly options: ProxyOptions;

  private replyMessage: Message | null = null;
  private _deferred: boolean = false;
  private _replied: boolean = false;
  private _ephemeral: boolean = false;

  constructor(
    client: Client,
    message: Message,
    commandName: string,
    parsedVars: Record<string, string>,
    argumentMapping: Record<string, ArgumentMapping>
  ) {
    this.client = client;
    this.message = message;
    this.commandName = commandName;
    this.options = new ProxyOptions(parsedVars, argumentMapping);
  }

  // Identity properties
  get id(): string {
    return `proxy-${this.message.id}`;
  }

  get type(): InteractionType {
    return InteractionType.ApplicationCommand;
  }

  get commandType(): ApplicationCommandType {
    return ApplicationCommandType.ChatInput;
  }

  get applicationId(): string {
    return this.client.application?.id || '';
  }

  get token(): string {
    return `proxy-token-${this.message.id}`;
  }

  get createdAt(): Date {
    return this.message.createdAt;
  }

  get createdTimestamp(): number {
    return this.message.createdTimestamp;
  }

  // User and member properties
  get user(): User {
    return this.message.author;
  }

  get member(): GuildMember | null {
    return this.message.member;
  }

  // Guild and channel properties
  get guild(): Guild | null {
    return this.message.guild;
  }

  get guildId(): string | null {
    return this.message.guildId;
  }

  get channel(): TextChannel | NewsChannel | ThreadChannel {
    return this.message.channel as TextChannel | NewsChannel | ThreadChannel;
  }

  get channelId(): string {
    return this.message.channelId;
  }

  // Locale (fallback to en-US)
  get locale(): Locale {
    return Locale.EnglishUS;
  }

  get guildLocale(): Locale | null {
    return this.guild?.preferredLocale || null;
  }

  // State checks
  isCommand(): boolean {
    return true;
  }

  isChatInputCommand(): boolean {
    return true;
  }

  isContextMenuCommand(): boolean {
    return false;
  }

  isUserContextMenuCommand(): boolean {
    return false;
  }

  isMessageContextMenuCommand(): boolean {
    return false;
  }

  isAutocomplete(): boolean {
    return false;
  }

  isButton(): boolean {
    return false;
  }

  isStringSelectMenu(): boolean {
    return false;
  }

  isModalSubmit(): boolean {
    return false;
  }

  isRepliable(): boolean {
    return true;
  }

  inGuild(): boolean {
    return this.guildId !== null;
  }

  inCachedGuild(): boolean {
    return this.guild !== null;
  }

  inRawGuild(): boolean {
    return this.guildId !== null && this.guild === null;
  }

  // Reply state
  get deferred(): boolean {
    return this._deferred;
  }

  get replied(): boolean {
    return this._replied;
  }

  get ephemeral(): boolean {
    return this._ephemeral;
  }

  /**
   * Reply to the interaction (sends a reply to the original message)
   */
  async reply(options: string | InteractionReplyOptions | MessagePayload): Promise<Message> {
    if (this._replied || this._deferred) {
      throw new Error('Already replied to this interaction');
    }

    const replyOptions = typeof options === 'string' ? { content: options } : options;

    // Check for ephemeral flag
    if (typeof replyOptions === 'object' && 'flags' in replyOptions) {
      const flags = replyOptions.flags;
      if (typeof flags === 'number' && (flags & MessageFlags.Ephemeral)) {
        this._ephemeral = true;
      }
    }

    // For ephemeral, we can't truly make it ephemeral via message reply
    // Best we can do is send a regular reply
    this.replyMessage = await this.message.reply(replyOptions as any);
    this._replied = true;

    return this.replyMessage;
  }

  /**
   * Defer the reply (show typing indicator)
   */
  async deferReply(options?: { ephemeral?: boolean; fetchReply?: boolean }): Promise<Message | null> {
    if (this._replied || this._deferred) {
      throw new Error('Already replied to this interaction');
    }

    this._deferred = true;
    this._ephemeral = options?.ephemeral || false;

    // Show typing indicator
    if ('sendTyping' in this.message.channel) {
      await this.message.channel.sendTyping();
    }

    return null;
  }

  /**
   * Edit the reply (edit the reply message, or send if deferred)
   */
  async editReply(options: string | InteractionEditReplyOptions | MessagePayload): Promise<Message> {
    if (!this._replied && !this._deferred) {
      throw new Error('No reply to edit');
    }

    const editOptions = typeof options === 'string' ? { content: options } : options;

    if (this.replyMessage) {
      // Edit existing reply
      return await this.replyMessage.edit(editOptions as any);
    } else {
      // Was deferred, send as reply
      this.replyMessage = await this.message.reply(editOptions as any);
      this._replied = true;
      return this.replyMessage;
    }
  }

  /**
   * Delete the reply
   */
  async deleteReply(): Promise<void> {
    if (this.replyMessage && this.replyMessage.deletable) {
      await this.replyMessage.delete();
      this.replyMessage = null;
    }
  }

  /**
   * Fetch the reply (return the reply message)
   */
  async fetchReply(): Promise<Message | null> {
    return this.replyMessage;
  }

  /**
   * Follow up with another message
   */
  async followUp(options: string | InteractionReplyOptions | MessagePayload): Promise<Message> {
    const followUpOptions = typeof options === 'string' ? { content: options } : options;
    if ('send' in this.message.channel) {
      return await this.message.channel.send(followUpOptions as any);
    }
    throw new Error('Cannot send follow-up in this channel type');
  }

  /**
   * Show a modal (not supported via message proxy)
   */
  async showModal(): Promise<void> {
    throw new Error('Modals are not supported via message-triggered commands');
  }

  /**
   * Await modal submit (not supported)
   */
  async awaitModalSubmit(): Promise<never> {
    throw new Error('Modals are not supported via message-triggered commands');
  }
}

/**
 * Create a MessageInteractionProxy for a response group's command execution
 */
export function createCommandProxy(
  client: Client,
  message: Message,
  group: ResponseGroup,
  parsedVars: Record<string, string>
): MessageInteractionProxy | null {
  if (!group.commandName) {
    return null;
  }

  return new MessageInteractionProxy(
    client,
    message,
    group.commandName,
    parsedVars,
    group.argumentMapping || {}
  );
}
