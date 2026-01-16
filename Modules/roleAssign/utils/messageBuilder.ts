import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageCreateOptions,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import {
  RoleAssignmentGroup,
  RoleAssignmentEntry,
  PendingRoleAssignment,
  LIMITS,
} from '../types/roleAssign';
import { RA_ROLE_BTN_PREFIX } from '../constants/prefixes';

export function calculateMessageCount(
  roleCount: number,
  interactionMode: 'button' | 'reaction'
): number {
  const limit = interactionMode === 'button'
    ? LIMITS.BUTTONS_PER_MESSAGE
    : LIMITS.REACTIONS_PER_MESSAGE;
  return Math.ceil(roleCount / limit);
}

export function buildRoleButtons(
  groupId: string,
  roles: RoleAssignmentEntry[]
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonsInRow = 0;

  for (const role of roles) {
    const button = new ButtonBuilder()
      .setCustomId(`${RA_ROLE_BTN_PREFIX}_${groupId}_${role.roleId}`)
      .setLabel(role.label)
      .setStyle(role.style || ButtonStyle.Secondary);

    if (role.emoji) {
      button.setEmoji(role.emoji);
    }

    currentRow.addComponents(button);
    buttonsInRow++;

    if (buttonsInRow === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonsInRow = 0;
    }
  }

  if (buttonsInRow > 0) {
    rows.push(currentRow);
  }

  return rows;
}

export function buildRoleEmbed(
  group: RoleAssignmentGroup | PendingRoleAssignment
): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (group.embedTitle) {
    embed.setTitle(group.embedTitle);
  }

  if (group.embedDescription) {
    embed.setDescription(group.embedDescription);
  }

  if (group.embedColor) {
    const colorInt = parseInt(group.embedColor.replace('0x', ''), 16);
    embed.setColor(colorInt);
  } else {
    embed.setColor(0x5865F2);
  }

  if (group.embedThumbnail) {
    embed.setThumbnail(group.embedThumbnail);
  }

  if (group.embedFooter) {
    embed.setFooter({ text: group.embedFooter });
  }

  return embed;
}

// Invisible character for "empty" messages that can still have reactions
// Experiment options:
// '\u200B' - Zero-width space
// '\u2800' - Braille blank pattern (designed to display as empty)
// '\u2060' - Word joiner
// '\u200C' - Zero-width non-joiner
// '\u200D' - Zero-width joiner
const INVISIBLE_CHAR = '\u2060'; // Currently testing: Word joiner

export interface GroupMessagePayload {
  content?: string;
  embeds?: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
  container?: ContainerBuilder;
  useV2?: boolean;
  roleSubset: RoleAssignmentEntry[];
}

function buildV2Container(
  group: RoleAssignmentGroup | PendingRoleAssignment,
  groupId: string,
  roleSubset: RoleAssignmentEntry[],
  interactionMode: 'button' | 'reaction'
): ContainerBuilder {
  const container = new ContainerBuilder();

  if (group.embedColor) {
    const colorInt = parseInt(group.embedColor.replace('0x', ''), 16);
    container.setAccentColor(colorInt);
  } else {
    container.setAccentColor(0x5865F2);
  }

  const textParts = [
    group.embedTitle ? `# ${group.embedTitle}` : '',
    group.embedDescription || '',
  ].filter(Boolean);

  if (textParts.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(textParts.join('\n'))
    );
  }

  // Only add buttons for button interaction mode, NOT for reactions
  if (interactionMode === 'button') {
    const buttonRows = buildRoleButtons(groupId, roleSubset);
    for (const row of buttonRows) {
      container.addActionRowComponents(row);
    }
  }

  return container;
}

export function buildGroupMessages(
  group: RoleAssignmentGroup | PendingRoleAssignment,
  groupId: string
): GroupMessagePayload[] {
  const roles = group.roles || [];
  const displayMode = group.displayMode || 'embed-inside';
  const interactionMode = group.interactionMode || 'button';

  if (roles.length === 0) {
    return [];
  }

  const limit = interactionMode === 'button'
    ? LIMITS.BUTTONS_PER_MESSAGE
    : LIMITS.REACTIONS_PER_MESSAGE;

  const messageCount = calculateMessageCount(roles.length, interactionMode);
  const messages: GroupMessagePayload[] = [];

  for (let i = 0; i < messageCount; i++) {
    const startIdx = i * limit;
    const roleSubset = roles.slice(startIdx, startIdx + limit);
    const payload: GroupMessagePayload = {
      components: [],
      roleSubset,
    };

    if (displayMode === 'embed-inside') {
      if (i === 0) {
        payload.useV2 = true;
        payload.container = buildV2Container(group, groupId, roleSubset, interactionMode);
      }
    } else if (displayMode === 'embed-outside') {
      if (i === 0) {
        payload.embeds = [buildRoleEmbed(group)];
      } else if (interactionMode === 'reaction') {
        // Overflow messages for reaction mode use invisible character
        payload.content = INVISIBLE_CHAR;
      }
      if (interactionMode === 'button') {
        payload.components = buildRoleButtons(groupId, roleSubset);
      }
    } else if (displayMode === 'text-only') {
      if (i === 0 && group.textContent) {
        payload.content = group.textContent;
      } else if (i > 0 && interactionMode === 'reaction') {
        // Overflow messages for reaction mode use invisible character
        payload.content = INVISIBLE_CHAR;
      }
      if (interactionMode === 'button') {
        payload.components = buildRoleButtons(groupId, roleSubset);
      }
    }

    messages.push(payload);
  }

  return messages;
}

export function toMessageCreateOptions(payload: GroupMessagePayload): MessageCreateOptions {
  const options: MessageCreateOptions = {};

  if (payload.useV2 && payload.container) {
    options.components = [payload.container];
    options.flags = MessageFlags.IsComponentsV2;
    return options;
  }

  if (payload.content) {
    options.content = payload.content;
  }

  if (payload.embeds && payload.embeds.length > 0) {
    options.embeds = payload.embeds;
  }

  if (payload.components && payload.components.length > 0) {
    options.components = payload.components;
  }

  return options;
}

export function getSelectionModeDescription(mode: string): string {
  switch (mode) {
    case 'single':
      return 'One role only (cannot change once assigned)';
    case 'exclusive':
      return 'One at a time (selecting another removes previous)';
    case 'multiple':
      return 'Multiple allowed (toggle on/off)';
    default:
      return 'Unknown mode';
  }
}

export function getDisplayModeDescription(mode: string): string {
  switch (mode) {
    case 'embed-inside':
      return 'Embed with buttons (no overflow)';
    case 'embed-outside':
      return 'Embed + buttons below (overflow enabled)';
    case 'text-only':
      return 'Plain text (overflow enabled)';
    default:
      return 'Unknown mode';
  }
}

export function getInteractionModeDescription(mode: string): string {
  switch (mode) {
    case 'button':
      return 'Click buttons to assign roles';
    case 'reaction':
      return 'React with emojis to assign roles';
    default:
      return 'Unknown mode';
  }
}
