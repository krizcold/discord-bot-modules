import { GuildMember, Role, Guild } from 'discord.js';

export function getMemberHighestRolePosition(member: GuildMember): number {
  return member.roles.highest.position;
}

export function getAssignableRoles(member: GuildMember, guild: Guild): Role[] {
  const memberHighest = getMemberHighestRolePosition(member);

  // Only filter by USER hierarchy (security: prevents privilege escalation)
  // Bot hierarchy is not checked - if bot can't assign at runtime, Discord will reject
  return guild.roles.cache
    .filter(role => {
      if (role.managed) return false;
      if (role.id === guild.id) return false;
      if (role.position >= memberHighest) return false;
      return true;
    })
    .sort((a, b) => b.position - a.position)
    .map(r => r);
}

export function canAssignRole(member: GuildMember, role: Role): boolean {
  if (role.managed) return false;
  if (role.id === role.guild.id) return false;

  const memberHighest = getMemberHighestRolePosition(member);
  return role.position < memberHighest;
}

export function botCanAssignRole(guild: Guild, roleId: string): boolean {
  const role = guild.roles.cache.get(roleId);
  if (!role) return false;
  if (role.managed) return false;

  const bot = guild.members.me;
  if (!bot) return false;

  return role.position < bot.roles.highest.position;
}

export function validateRoleHierarchy(
  member: GuildMember,
  roleIds: string[]
): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const guild = member.guild;

  for (const roleId of roleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      invalid.push(roleId);
      continue;
    }

    if (canAssignRole(member, role) && botCanAssignRole(guild, roleId)) {
      valid.push(roleId);
    } else {
      invalid.push(roleId);
    }
  }

  return { valid, invalid };
}

export function roleExists(guild: Guild, roleId: string): boolean {
  return guild.roles.cache.has(roleId);
}

export function getRolesSortedByPosition(guild: Guild, roleIds: string[]): Role[] {
  return roleIds
    .map(id => guild.roles.cache.get(id))
    .filter((r): r is Role => r !== undefined)
    .sort((a, b) => b.position - a.position);
}
