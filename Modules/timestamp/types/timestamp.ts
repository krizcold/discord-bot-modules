// Timestamp Module Type Definitions

/**
 * Discord timestamp format codes
 * t = Short Time (16:20)
 * T = Long Time (16:20:30)
 * d = Short Date (20/04/2021)
 * D = Long Date (20 April 2021)
 * f = Long Date + Short Time (20 April 2021 16:20)
 * F = Long Date + Day of Week + Short Time (Tuesday, 20 April 2021 16:20)
 * R = Relative Time (2 months ago)
 */
export type TimestampFormat = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

/** Combined format codes (two timestamps) */
export type TimestampComboFormat = 'd+t' | 'd+T' | 'D+T';

/** All possible format results */
export type TimestampFormatResult = TimestampFormat | TimestampComboFormat;

/** Time format toggle options */
export type TimeFormatOption = 'none' | 'short' | 'long';

/** Date format toggle options */
export type DateFormatOption = 'none' | 'short' | 'long' | 'full';

/** Timezone selection method */
export type TimezoneMethod = 'utc' | 'region';

/** IANA timezone regions */
export type TimezoneRegion = 'Africa' | 'America' | 'Asia' | 'Atlantic' | 'Australia' | 'Europe' | 'Pacific';

/**
 * User's stored timezone preferences (global per user)
 */
export interface UserTimestampPrefs {
  /** Timezone selection method */
  timezoneMethod: TimezoneMethod;
  /** UTC offset in hours (-12 to +14) - used when timezoneMethod is 'utc' */
  utcOffset: number;
  /** Additional minute adjustment (0, 15, 30, 45) for half-hour timezones */
  minuteModifier: number;
  /** IANA timezone ID (e.g., 'America/New_York') - used when timezoneMethod is 'region' */
  ianaTimezone?: string;
  /** User's preferred default format */
  defaultFormat: TimestampFormat;
  /** Whether user has completed first-time setup */
  setupComplete: boolean;
  /** ISO timestamp of last usage */
  lastUsed: string;
}

/**
 * Input parameters from slash command
 */
export interface TimestampInput {
  hour?: number;
  minute?: number;
  second?: number;
  day?: number;
  month?: number;  // 1-12
  year?: number;
}

/**
 * Session state for the timestamp panel
 */
export interface TimestampSessionState {
  /** Current input values */
  input: TimestampInput;
  /** Time format selection */
  timeFormat: TimeFormatOption;
  /** Date format selection */
  dateFormat: DateFormatOption;
  /** Relative mode enabled */
  relative: boolean;
}

/**
 * Month name to number mapping
 */
export const MONTH_MAP: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

/**
 * Month number to name mapping (for display)
 */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format code descriptions for dropdown
 */
export const FORMAT_DESCRIPTIONS: Record<TimestampFormat, string> = {
  't': 'Short Time (16:20)',
  'T': 'Long Time (16:20:30)',
  'd': 'Short Date (20/04/2021)',
  'D': 'Long Date (20 April 2021)',
  'f': 'Date + Time (20 April 2021 16:20)',
  'F': 'Full Date + Time (Tuesday, 20 April 2021 16:20)',
  'R': 'Relative (2 months ago)',
};

/**
 * Default user preferences
 */
export const DEFAULT_USER_PREFS: UserTimestampPrefs = {
  timezoneMethod: 'utc',
  utcOffset: 0,
  minuteModifier: 0,
  ianaTimezone: undefined,
  defaultFormat: 'f',
  setupComplete: false,
  lastUsed: new Date().toISOString(),
};
