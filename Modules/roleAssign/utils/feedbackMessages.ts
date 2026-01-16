import { User, GuildMember, Role } from 'discord.js';
import { getModuleSetting } from '@internal/utils/settings/settingsStorage';
import type { SettingValue } from '@bot/types/settingsTypes';

const MODULE_NAME = 'role-assign';
const CATEGORY = 'moderation';

function getSetting<T extends SettingValue>(key: string, guildId: string, defaultValue: T): T {
  const value = getModuleSetting<T>(MODULE_NAME, key, guildId, CATEGORY);
  return value !== undefined ? value : defaultValue;
}

export function formatFeedbackMessage(
  template: string,
  role: Role,
  user: User | GuildMember,
  forDM: boolean = false
): string {
  const roleText = forDM ? `\`${role.name}\`` : `<@&${role.id}>`;
  return template
    .replace(/\{role\}/gi, roleText)
    .replace(/\{user\}/gi, `<@${user.id}>`);
}

export function getRoleAddedMessage(guildId: string, role: Role, user: User | GuildMember, forDM: boolean = false): string | null {
  if (!getSetting('feedback.enabled', guildId, true)) return null;
  const template = getSetting('feedback.roleAdded', guildId, '✅ Added {role} to {user}');
  return formatFeedbackMessage(template, role, user, forDM);
}

export function getRoleRemovedMessage(guildId: string, role: Role, user: User | GuildMember, forDM: boolean = false): string | null {
  if (!getSetting('feedback.enabled', guildId, true)) return null;
  const template = getSetting('feedback.roleRemoved', guildId, '❌ Removed {role} from {user}');
  return formatFeedbackMessage(template, role, user, forDM);
}

export function getAlreadyHasRoleMessage(guildId: string): string | null {
  if (!getSetting('feedback.enabled', guildId, true)) return null;
  return getSetting('feedback.alreadyHasRole', guildId, '⚠️ You already have a role from this group');
}

export function isReactionDMEnabled(guildId: string): boolean {
  return getSetting('feedback.enabled', guildId, true) && getSetting('feedback.reactionDM', guildId, true);
}
