// Timezone and Timestamp Calculation Utilities

import { TimestampFormat, TimestampFormatResult, TimestampComboFormat, TimestampInput, TimeFormatOption, DateFormatOption, MONTH_NAMES, UserTimestampPrefs } from '../types/timestamp';
import { calculateUnixTimestampFromIANA, getCurrentTimeInTimezone, getTimezoneOffsetString, getTimezoneDisplayName, getTimezoneOffsetMinutes } from './timezoneUtils';

// Time constants
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/**
 * Get the machine's UTC offset in hours
 * Note: getTimezoneOffset() returns minutes, and is inverted (negative for UTC+ zones)
 */
export function getMachineUtcOffset(): number {
  const offset = new Date().getTimezoneOffset() / 60;
  return -offset;
}

/**
 * Calculate Unix timestamp from parsed input and user's timezone settings
 */
export function calculateUnixTimestamp(
  input: TimestampInput,
  userUtcOffset: number,
  minuteModifier: number = 0
): number {
  const now = new Date();

  // Build the date/time from input, using current values as defaults
  const year = input.year ?? now.getFullYear();
  const month = (input.month ?? (now.getMonth() + 1)) - 1; // JS months are 0-indexed
  const day = input.day ?? now.getDate();
  const hour = input.hour ?? now.getHours();
  const minute = input.minute ?? now.getMinutes();
  const second = input.second ?? 0;

  // Create date object - this is interpreted in machine's local timezone
  const inputDate = new Date(year, month, day, hour, minute, second);

  // Calculate user's total UTC offset
  const adjustedUtcOffset = userUtcOffset + minuteModifier / 60;

  // Get machine's UTC offset
  const machineOffset = getMachineUtcOffset();

  // Convert: machine local → UTC → user's intended UTC time
  // Formula from original: inputDate + machineOffset - userOffset
  const adjustedTime = inputDate.getTime() + (machineOffset * MS_PER_HOUR) - (adjustedUtcOffset * MS_PER_HOUR);

  return Math.floor(adjustedTime / MS_PER_SECOND);
}

/**
 * Determine smart format based on what input was provided
 */
export function determineSmartFormat(input: TimestampInput): TimestampFormat {
  const hasDate = input.day !== undefined || input.month !== undefined || input.year !== undefined;
  const hasSeconds = input.second !== undefined && input.second !== 0;

  if (hasDate) {
    // Date + Time provided
    return 'f';
  } else if (hasSeconds) {
    // Time with seconds
    return 'T';
  } else {
    // Time only
    return 't';
  }
}

/**
 * Generate UTC offset options for dropdown
 * Returns options from UTC-12 to UTC+14
 */
export function generateUtcOptions(): Array<{ label: string; value: string; description?: string }> {
  const options: Array<{ label: string; value: string; description?: string }> = [];
  const now = new Date();

  // Common offsets from UTC-12 to UTC+14
  for (let offset = -12; offset <= 14; offset++) {
    // Calculate preview time for this offset
    const previewDate = new Date(now.getTime() + (offset * MS_PER_HOUR) - (getMachineUtcOffset() * MS_PER_HOUR));
    const previewTime = previewDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const sign = offset >= 0 ? '+' : '';
    options.push({
      label: `UTC${sign}${offset}`,
      value: String(offset),
      description: `Current time: ${previewTime}`,
    });
  }

  return options;
}

/**
 * Generate minute modifier options for dropdown
 * For half-hour and quarter-hour timezones
 */
export function generateMinuteOptions(): Array<{ label: string; value: string; description: string }> {
  return [
    { label: '+0 minutes', value: '0', description: 'No additional offset' },
    { label: '+15 minutes', value: '15', description: 'Quarter-hour offset' },
    { label: '+30 minutes', value: '30', description: 'Half-hour timezone (e.g., India)' },
    { label: '+45 minutes', value: '45', description: 'Three-quarter offset (e.g., Nepal)' },
  ];
}

/**
 * Generate format options for dropdown
 */
export function generateFormatOptions(): Array<{ label: string; value: string; description: string }> {
  return [
    { label: 'Short Time', value: 't', description: '16:20' },
    { label: 'Long Time', value: 'T', description: '16:20:30' },
    { label: 'Short Date', value: 'd', description: '20/04/2021' },
    { label: 'Long Date', value: 'D', description: '20 April 2021' },
    { label: 'Date + Time', value: 'f', description: '20 April 2021 16:20' },
    { label: 'Full Date + Time', value: 'F', description: 'Tuesday, 20 April 2021 16:20' },
    { label: 'Relative', value: 'R', description: '2 months ago' },
  ];
}

/**
 * Generate hour options for dropdown (0-23)
 */
export function generateHourOptions(): Array<{ label: string; value: string }> {
  return Array.from({ length: 24 }, (_, i) => ({
    label: String(i).padStart(2, '0'),
    value: String(i),
  }));
}

/**
 * Generate minute options for time selection (0-59)
 */
export function generateMinuteSelectOptions(): Array<{ label: string; value: string }> {
  return Array.from({ length: 60 }, (_, i) => ({
    label: String(i).padStart(2, '0'),
    value: String(i),
  }));
}

/**
 * Generate day options for dropdown (1-31)
 */
export function generateDayOptions(): Array<{ label: string; value: string }> {
  return Array.from({ length: 31 }, (_, i) => ({
    label: String(i + 1),
    value: String(i + 1),
  }));
}

/**
 * Generate month options for dropdown
 */
export function generateMonthOptions(): Array<{ label: string; value: string }> {
  return MONTH_NAMES.map((name, index) => ({
    label: name,
    value: String(index + 1),
  }));
}

/**
 * Get current year and surrounding years for dropdown
 */
export function generateYearOptions(): Array<{ label: string; value: string }> {
  const currentYear = new Date().getFullYear();
  const years: Array<{ label: string; value: string }> = [];

  // Previous year, current year, and next 5 years
  for (let year = currentYear - 1; year <= currentYear + 5; year++) {
    years.push({
      label: String(year),
      value: String(year),
    });
  }

  return years;
}

/**
 * Format the Discord timestamp string
 */
export function formatTimestamp(unixTimestamp: number, format: TimestampFormat): string {
  return `<t:${unixTimestamp}:${format}>`;
}

/**
 * Get user's current time preview based on their UTC offset
 */
export function getUserCurrentTime(utcOffset: number, minuteModifier: number = 0): string {
  const now = new Date();
  const totalOffsetMinutes = (utcOffset * 60) + minuteModifier;
  const machineOffsetMinutes = getMachineUtcOffset() * 60;

  const userDate = new Date(now.getTime() + ((totalOffsetMinutes - machineOffsetMinutes) * MS_PER_MINUTE));

  return userDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format input for display in embed
 */
export function formatInputDisplay(input: TimestampInput): string {
  const parts: string[] = [];

  if (input.hour !== undefined || input.minute !== undefined) {
    const hour = String(input.hour ?? 0).padStart(2, '0');
    const minute = String(input.minute ?? 0).padStart(2, '0');
    const second = input.second !== undefined ? `:${String(input.second).padStart(2, '0')}` : '';
    parts.push(`${hour}:${minute}${second}`);
  }

  if (input.day !== undefined || input.month !== undefined || input.year !== undefined) {
    const day = input.day ?? new Date().getDate();
    const month = input.month ?? (new Date().getMonth() + 1);
    const year = input.year ?? new Date().getFullYear();
    const monthName = MONTH_NAMES[month - 1] ?? 'Unknown';
    parts.push(`${day} ${monthName} ${year}`);
  }

  return parts.join(' - ') || 'Current time';
}

/**
 * Get user's adjusted Date object based on their UTC offset
 */
export function getUserAdjustedDate(utcOffset: number, minuteModifier: number = 0): Date {
  const now = new Date();
  const totalOffsetMinutes = (utcOffset * 60) + minuteModifier;
  const machineOffsetMinutes = getMachineUtcOffset() * 60;

  return new Date(now.getTime() + ((totalOffsetMinutes - machineOffsetMinutes) * MS_PER_MINUTE));
}

/**
 * Format time with ANSI color codes for Discord
 */
export function formatTimeWithANSI(timeStr: string): string {
  // ANSI escape codes for Discord
  // \u001b[36m = cyan, \u001b[0m = reset
  return `\`\`\`ansi\n\u001b[36m${timeStr}\u001b[0m\n\`\`\``;
}

/**
 * Format date and time with ANSI color codes
 */
export function formatDateTimeWithANSI(
  day: number,
  month: number,
  year: number,
  timeStr: string
): string {
  const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  return `\`\`\`ansi\n\u001b[34m${dateStr}\u001b[0m \u001b[36m${timeStr}\u001b[0m\n\`\`\``;
}

/**
 * Format time only with ANSI color codes
 */
export function formatTimeOnlyWithANSI(timeStr: string): string {
  return `\`\`\`ansi\n\u001b[36m${timeStr}\u001b[0m\n\`\`\``;
}

/**
 * Generate time.is link for the user's current time
 */
export function getTimeIsLink(userDate: Date): string {
  const isoStr = userDate.toISOString().replace(/[-:]/g, '').slice(0, -5);
  return `https://time.is/${isoStr}`;
}

/**
 * Map time and date format options to Discord timestamp format code
 * Returns null for truly invalid combinations, combo codes for combined formats
 *
 * Single formats:
 * - t/T = Time only
 * - d/D = Date only
 * - f = Long Date + Short Time
 * - F = Full Date + Short Time
 * - R = Relative
 *
 * Combo formats (two timestamps):
 * - d+t = Short Date + Short Time
 * - d+T = Short Date + Long Time
 * - D+T = Long Date + Long Time
 */
export function getFormatFromOptions(
  timeFormat: TimeFormatOption,
  dateFormat: DateFormatOption,
  relative: boolean
): TimestampFormatResult | null {
  if (relative) return 'R';

  // Invalid: both none
  if (timeFormat === 'none' && dateFormat === 'none') return null;

  // Time only
  if (dateFormat === 'none') {
    return timeFormat === 'short' ? 't' : 'T';
  }

  // Date only (Full date without time doesn't exist in Discord)
  if (timeFormat === 'none') {
    if (dateFormat === 'full') return null;
    return dateFormat === 'short' ? 'd' : 'D';
  }

  // Date + Time combinations:

  // Short date + time = combo format
  if (dateFormat === 'short') {
    return timeFormat === 'short' ? 'd+t' : 'd+T';
  }

  // Long time + date = combo format (Long Date + Long Time)
  if (timeFormat === 'long') {
    if (dateFormat === 'full') return null; // Can't get weekday alone
    return 'D+T';
  }

  // Valid single format: Short time + Long/Full date
  return dateFormat === 'full' ? 'F' : 'f';
}

/**
 * Check if a format result is a combo (two timestamps)
 */
export function isComboFormat(format: TimestampFormatResult | null): format is TimestampComboFormat {
  return format === 'd+t' || format === 'd+T' || format === 'D+T';
}

/**
 * Format a timestamp result (handles both single and combo formats)
 */
export function formatTimestampResult(timestamp: number, format: TimestampFormatResult): string {
  if (isComboFormat(format)) {
    const [fmt1, fmt2] = format.split('+') as [TimestampFormat, TimestampFormat];
    return `<t:${timestamp}:${fmt1}><t:${timestamp}:${fmt2}>`;
  }
  return `<t:${timestamp}:${format}>`;
}

/**
 * Check if a format combination is valid
 */
export function isValidFormatCombination(
  timeFormat: TimeFormatOption,
  dateFormat: DateFormatOption,
  relative: boolean
): boolean {
  return getFormatFromOptions(timeFormat, dateFormat, relative) !== null;
}

/** Result of format option validation */
export type FormatOptionStatus = 'valid' | 'combo' | 'invalid';

/**
 * Check status of selecting a time option
 */
export function getTimeOptionStatus(
  timeOption: TimeFormatOption,
  currentDateFormat: DateFormatOption
): FormatOptionStatus {
  // Both none = invalid
  if (timeOption === 'none' && currentDateFormat === 'none') return 'invalid';
  // No time + full date = invalid (can't get weekday alone)
  if (timeOption === 'none' && currentDateFormat === 'full') return 'invalid';
  // Long time + full date = invalid (can't get weekday alone)
  if (timeOption === 'long' && currentDateFormat === 'full') return 'invalid';
  // Long time + long date = combo (D+T)
  if (timeOption === 'long' && currentDateFormat === 'long') return 'combo';
  // Any time + short date = combo (d+t or d+T)
  if (timeOption !== 'none' && currentDateFormat === 'short') return 'combo';
  return 'valid';
}

/**
 * Check status of selecting a date option
 */
export function getDateOptionStatus(
  dateOption: DateFormatOption,
  currentTimeFormat: TimeFormatOption
): FormatOptionStatus {
  // Both none = invalid
  if (dateOption === 'none' && currentTimeFormat === 'none') return 'invalid';
  // Full date without time = invalid (can't get weekday alone)
  if (dateOption === 'full' && currentTimeFormat === 'none') return 'invalid';
  // Full date + long time = invalid (can't get weekday alone)
  if (dateOption === 'full' && currentTimeFormat === 'long') return 'invalid';
  // Short date + any time = combo (d+t or d+T)
  if (dateOption === 'short' && currentTimeFormat !== 'none') return 'combo';
  // Long date + long time = combo (D+T)
  if (dateOption === 'long' && currentTimeFormat === 'long') return 'combo';
  return 'valid';
}

// ============================================================================
// Unified Functions - Dispatch based on timezone method
// ============================================================================

/**
 * Calculate Unix timestamp using user's preferred timezone method
 */
export function calculateUnixTimestampFromPrefs(
  input: TimestampInput,
  prefs: UserTimestampPrefs
): number {
  if (prefs.timezoneMethod === 'region' && prefs.ianaTimezone) {
    return calculateUnixTimestampFromIANA(input, prefs.ianaTimezone);
  }
  return calculateUnixTimestamp(input, prefs.utcOffset, prefs.minuteModifier);
}

/**
 * Get user's current time based on their preferred timezone method
 */
export function getUserCurrentTimeFromPrefs(prefs: UserTimestampPrefs): string {
  if (prefs.timezoneMethod === 'region' && prefs.ianaTimezone) {
    return getCurrentTimeInTimezone(prefs.ianaTimezone);
  }
  return getUserCurrentTime(prefs.utcOffset, prefs.minuteModifier);
}

/**
 * Get timezone display string based on user's preferred method
 * Returns either "UTC+5:30" or "New York (UTC-5)"
 */
export function getTimezoneDisplayFromPrefs(prefs: UserTimestampPrefs): string {
  if (prefs.timezoneMethod === 'region' && prefs.ianaTimezone) {
    const displayName = getTimezoneDisplayName(prefs.ianaTimezone);
    const offset = getTimezoneOffsetString(prefs.ianaTimezone);
    return `${displayName} (${offset})`;
  }

  const sign = prefs.utcOffset >= 0 ? '+' : '';
  const minuteSuffix = prefs.minuteModifier > 0 ? `:${String(prefs.minuteModifier).padStart(2, '0')}` : '';
  return `UTC${sign}${prefs.utcOffset}${minuteSuffix}`;
}

/**
 * Get user's adjusted Date object based on their preferred timezone method
 */
export function getUserAdjustedDateFromPrefs(prefs: UserTimestampPrefs): Date {
  if (prefs.timezoneMethod === 'region' && prefs.ianaTimezone) {
    // For IANA timezone, calculate the user's current date
    const now = new Date();
    const offsetMinutes = getTimezoneOffsetMinutes(prefs.ianaTimezone);
    const machineOffsetMinutes = -now.getTimezoneOffset();
    return new Date(now.getTime() + ((offsetMinutes - machineOffsetMinutes) * MS_PER_MINUTE));
  }
  return getUserAdjustedDate(prefs.utcOffset, prefs.minuteModifier);
}
