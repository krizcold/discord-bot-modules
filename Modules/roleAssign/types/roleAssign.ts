import { ButtonStyle } from 'discord.js';

export type SelectionMode = 'single' | 'exclusive' | 'multiple';
export type InteractionMode = 'button' | 'reaction';
export type DisplayMode = 'embed-inside' | 'embed-outside' | 'text-only';
export type ReactionPersistMode = 'clear' | 'persistent';

export interface RoleAssignmentEntry {
  roleId: string;
  roleName?: string;      // Role name for Web-UI display (Discord shows mention naturally)
  label: string;
  emoji?: string;         // Identifier for storage/reactions (emoji ID or unicode)
  displayEmoji?: string;  // Full Discord format for display (<:name:id> or unicode)
  emojiInput?: string;    // Raw user input for editing
  style?: ButtonStyle;
}

export interface RoleAssignmentGroup {
  id: string;
  guildId: string;
  channelId: string;
  messageIds: string[];
  creatorId: string;

  displayMode: DisplayMode;
  interactionMode: InteractionMode;
  selectionMode: SelectionMode;
  reactionPersist?: ReactionPersistMode;

  embedTitle?: string;
  embedDescription?: string;
  embedColor?: string;
  embedThumbnail?: string;
  embedFooter?: string;
  textContent?: string;

  roles: RoleAssignmentEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface PendingRoleAssignment {
  id: string;
  guildId: string;
  creatorId: string;
  createdAt: number;
  status: 'draft' | 'ready';

  displayMode?: DisplayMode;
  interactionMode?: InteractionMode;
  selectionMode?: SelectionMode;
  reactionPersist?: ReactionPersistMode;

  embedTitle?: string;
  embedDescription?: string;
  embedColor?: string;
  embedThumbnail?: string;
  embedFooter?: string;
  textContent?: string;

  roles?: RoleAssignmentEntry[];

  isEditing?: boolean;
  originalGroupId?: string;
}

export const LIMITS = {
  BUTTONS_PER_MESSAGE: 25,
  REACTIONS_PER_MESSAGE: 20,
  MAX_MESSAGES_PER_GROUP: 10,
  MAX_ROLES_PER_GROUP: 100,
} as const;
