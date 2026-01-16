// IANA Timezone Utilities
// Uses Node.js Intl API for timezone handling with automatic DST support

import { TimezoneRegion, TimestampInput } from '../types/timestamp';

/**
 * Region option for dropdown
 */
export interface RegionOption {
  value: TimezoneRegion;
  label: string;
  emoji: string;
  description: string;
}

/**
 * Timezone option for dropdown
 */
export interface TimezoneOption {
  value: string;       // IANA ID (e.g., 'America/New_York')
  label: string;       // Display name (e.g., 'New York')
  description: string; // Current time preview
}

/**
 * Available regions (7 options - fits Discord's 25 option limit)
 */
export const TIMEZONE_REGIONS: RegionOption[] = [
  { value: 'America', label: 'Americas', emoji: '\uD83C\uDF0E', description: 'North & South America' },
  { value: 'Europe', label: 'Europe', emoji: '\uD83C\uDDEA\uD83C\uDDFA', description: 'European timezones' },
  { value: 'Asia', label: 'Asia', emoji: '\uD83C\uDF0F', description: 'Asian timezones' },
  { value: 'Africa', label: 'Africa', emoji: '\uD83C\uDF0D', description: 'African timezones' },
  { value: 'Australia', label: 'Australia/Oceania', emoji: '\uD83C\uDDE6\uD83C\uDDFA', description: 'Australia & Oceania' },
  { value: 'Pacific', label: 'Pacific', emoji: '\uD83C\uDDFA\uD83C\uDDF2', description: 'Pacific Islands' },
  { value: 'Atlantic', label: 'Atlantic', emoji: '\uD83C\uDF0A', description: 'Atlantic regions' },
];

/**
 * Curated major cities per region (max 25 each)
 * Prioritizes commonly used timezones
 */
const CURATED_TIMEZONES: Record<TimezoneRegion, string[]> = {
  America: [
    'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
    'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
    'America/Buenos_Aires', 'America/Lima', 'America/Bogota', 'America/Santiago',
    'America/Phoenix', 'America/Anchorage', 'America/Halifax', 'America/Edmonton',
    'America/Detroit', 'America/Caracas', 'America/Havana', 'America/Panama',
    'America/Monterrey', 'America/Guatemala', 'America/Costa_Rica', 'America/Jamaica',
    'America/Santo_Domingo',
  ],
  Europe: [
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
    'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Warsaw',
    'Europe/Prague', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Helsinki',
    'Europe/Athens', 'Europe/Lisbon', 'Europe/Dublin', 'Europe/Zurich',
    'Europe/Moscow', 'Europe/Istanbul', 'Europe/Kyiv', 'Europe/Bucharest',
    'Europe/Budapest', 'Europe/Copenhagen', 'Europe/Belgrade', 'Europe/Sofia',
  ],
  Asia: [
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
    'Asia/Taipei', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Manila', 'Asia/Kuala_Lumpur',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Mumbai', 'Asia/Delhi', 'Asia/Karachi',
    'Asia/Dhaka', 'Asia/Ho_Chi_Minh', 'Asia/Riyadh', 'Asia/Tehran', 'Asia/Jerusalem',
    'Asia/Baghdad', 'Asia/Kabul', 'Asia/Kathmandu', 'Asia/Yangon', 'Asia/Colombo',
  ],
  Africa: [
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
    'Africa/Casablanca', 'Africa/Algiers', 'Africa/Tunis', 'Africa/Accra',
    'Africa/Addis_Ababa', 'Africa/Khartoum', 'Africa/Dar_es_Salaam', 'Africa/Kampala',
    'Africa/Harare', 'Africa/Lusaka', 'Africa/Maputo', 'Africa/Tripoli',
    'Africa/Abidjan', 'Africa/Dakar', 'Africa/Kinshasa', 'Africa/Luanda',
    'Africa/Douala', 'Africa/Libreville', 'Africa/Windhoek', 'Africa/Gaborone',
  ],
  Australia: [
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
    'Australia/Adelaide', 'Australia/Hobart', 'Australia/Darwin', 'Australia/Canberra',
    'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam', 'Pacific/Port_Moresby',
    'Pacific/Noumea', 'Pacific/Tahiti', 'Pacific/Tongatapu', 'Pacific/Rarotonga',
  ],
  Pacific: [
    'Pacific/Honolulu', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam',
    'Pacific/Port_Moresby', 'Pacific/Noumea', 'Pacific/Tahiti', 'Pacific/Samoa',
    'Pacific/Tongatapu', 'Pacific/Rarotonga', 'Pacific/Palau', 'Pacific/Majuro',
    'Pacific/Kiritimati', 'Pacific/Pohnpei', 'Pacific/Kwajalein', 'Pacific/Tarawa',
    'Pacific/Nauru', 'Pacific/Funafuti', 'Pacific/Wake', 'Pacific/Marquesas',
  ],
  Atlantic: [
    'Atlantic/Azores', 'Atlantic/Canary', 'Atlantic/Cape_Verde', 'Atlantic/Reykjavik',
    'Atlantic/Bermuda', 'Atlantic/South_Georgia', 'Atlantic/Stanley', 'Atlantic/Faroe',
    'Atlantic/Madeira', 'Atlantic/St_Helena',
  ],
};

/**
 * Get curated timezones for a region (max 25)
 */
export function getCuratedTimezonesForRegion(region: TimezoneRegion): string[] {
  return CURATED_TIMEZONES[region] || [];
}

/**
 * Get display name from IANA timezone ID
 * 'America/New_York' -> 'New York'
 * 'America/Argentina/Buenos_Aires' -> 'Buenos Aires'
 */
export function getTimezoneDisplayName(ianaId: string): string {
  const parts = ianaId.split('/');
  const city = parts[parts.length - 1];
  return city.replace(/_/g, ' ');
}

/**
 * Get current time in a timezone
 */
export function getCurrentTimeInTimezone(ianaTimezone: string): string {
  try {
    return new Date().toLocaleTimeString('en-GB', {
      timeZone: ianaTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid timezone';
  }
}

/**
 * Get current UTC offset for a timezone (handles DST automatically)
 * Returns offset in minutes
 */
export function getTimezoneOffsetMinutes(ianaTimezone: string, forDate: Date = new Date()): number {
  try {
    const utcDate = new Date(forDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(forDate.toLocaleString('en-US', { timeZone: ianaTimezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
  } catch {
    return 0;
  }
}

/**
 * Get formatted offset string (e.g., 'UTC-5', 'UTC+5:30')
 */
export function getTimezoneOffsetString(ianaTimezone: string, forDate: Date = new Date()): string {
  const offsetMinutes = getTimezoneOffsetMinutes(ianaTimezone, forDate);
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? '+' : '-';

  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Build timezone dropdown options for a region
 * Sorted alphabetically by display name, max 25 options
 */
export function buildTimezoneOptions(region: TimezoneRegion): TimezoneOption[] {
  const timezones = getCuratedTimezonesForRegion(region);

  const options = timezones.map(tz => ({
    value: tz,
    label: getTimezoneDisplayName(tz),
    description: `${getCurrentTimeInTimezone(tz)} (${getTimezoneOffsetString(tz)})`,
  }));

  // Sort alphabetically by label
  options.sort((a, b) => a.label.localeCompare(b.label));

  // Ensure max 25 options (Discord limit)
  return options.slice(0, 25);
}

/**
 * Calculate Unix timestamp from input using IANA timezone
 * Handles DST automatically by using the timezone's offset for the target date
 */
export function calculateUnixTimestampFromIANA(
  input: TimestampInput,
  ianaTimezone: string
): number {
  const now = new Date();

  const year = input.year ?? now.getFullYear();
  const month = (input.month ?? (now.getMonth() + 1)) - 1; // JS months are 0-indexed
  const day = input.day ?? now.getDate();
  const hour = input.hour ?? now.getHours();
  const minute = input.minute ?? now.getMinutes();
  const second = input.second ?? 0;

  // Create date string in ISO format (without timezone)
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  // Create a reference date to get the offset for that specific date/time
  // This handles DST correctly because we get the offset for the target date
  const referenceDate = new Date(dateStr + 'Z');
  const offsetMinutes = getTimezoneOffsetMinutes(ianaTimezone, referenceDate);

  // Calculate the UTC timestamp
  // The user's input is in their local timezone, so we subtract the offset to get UTC
  const utcTime = referenceDate.getTime() - (offsetMinutes * 60 * 1000);

  return Math.floor(utcTime / 1000);
}

/**
 * Get user's adjusted Date object based on IANA timezone
 */
export function getUserAdjustedDateFromIANA(ianaTimezone: string): Date {
  const now = new Date();
  const offsetMinutes = getTimezoneOffsetMinutes(ianaTimezone);
  const machineOffsetMinutes = -now.getTimezoneOffset();

  return new Date(now.getTime() + ((offsetMinutes - machineOffsetMinutes) * 60 * 1000));
}

/**
 * Validate if a timezone ID is valid
 */
export function isValidTimezone(ianaTimezone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: ianaTimezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract region from IANA timezone ID
 * 'America/Santiago' → 'America'
 * 'Europe/London' → 'Europe'
 */
export function getRegionFromTimezone(ianaTimezone: string): TimezoneRegion | undefined {
  const region = ianaTimezone.split('/')[0];
  const validRegions: TimezoneRegion[] = ['Africa', 'America', 'Asia', 'Atlantic', 'Australia', 'Europe', 'Pacific'];
  return validRegions.includes(region as TimezoneRegion) ? region as TimezoneRegion : undefined;
}
