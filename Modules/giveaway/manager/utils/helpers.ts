export function formatDuration(ms: number): string {
  if (ms <= 0) return 'Not Set';
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const m = Math.floor((ms / (1000 * 60)) % 60);
  const s = Math.floor((ms / 1000) % 60);
  let parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && parts.length < 2 && !(d > 0 || h > 0)) {
    parts.push(`${s}s`);
  } else if (parts.length === 0 && s <= 0) {
    return "0s";
  }
  if (parts.length === 0) {
    if (ms > 0) return 'Less than 1s';
    return "0s";
  }
  return parts.join(' ');
}

export function parseDuration(str: string): number | null {
  let totalMs = 0;
  const parts = str.toLowerCase().match(/(\d+)([dhms])/g);
  if (!parts) {
    const timeParts = str.split(':').map(Number);
    if (timeParts.some(isNaN)) return null;
    if (timeParts.length === 3) { totalMs += timeParts[0]*3600000 + timeParts[1]*60000 + timeParts[2]*1000; }
    else if (timeParts.length === 2) { totalMs += timeParts[0]*60000 + timeParts[1]*1000; }
    else if (timeParts.length === 1 && !str.match(/[dhms]/i)) { totalMs += timeParts[0]*60000; } // Assume minutes if single number without unit
    else { return null; } return totalMs > 0 ? totalMs : null;
  }
  for (const part of parts) {
    const value = parseInt(part.slice(0, -1)); const unit = part.slice(-1); if (isNaN(value)) return null;
    switch (unit) {
      case 'd': totalMs += value * 86400000; break; case 'h': totalMs += value * 3600000; break;
      case 'm': totalMs += value * 60000; break; case 's': totalMs += value * 1000; break; default: return null;
    }
  } return totalMs > 0 ? totalMs : null;
}

export function getSessionIdFromCustomId(customId: string, prefix: string): string | null {
  if (customId.startsWith(prefix + '_')) {
    const parts = customId.substring(prefix.length + 1).split('_');
    return parts[0]; // The first part after prefix_ is assumed to be the session/giveaway ID
  }
  return null;
}
