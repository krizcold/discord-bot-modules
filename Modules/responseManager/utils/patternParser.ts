/**
 * Pattern Parser Utilities
 *
 * Handles extraction of variables from patterns like "ts {hour}:{min}"
 * and matching messages against patterns.
 */

import { KeywordPattern, MatchMode, ResponseGroup, PatternMatchResult } from '../types/responseManager';

/**
 * Extract variable names from a pattern string
 * e.g., "ts {hour}:{min}" -> ["hour", "min"]
 */
export function extractVariables(pattern: string): string[] {
  const regex = /\{(\w+)\}/g;
  const vars: string[] = [];
  let match;
  while ((match = regex.exec(pattern)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

/**
 * Parse a pattern string into a KeywordPattern object
 */
export function parsePattern(pattern: string): KeywordPattern {
  return {
    pattern: pattern.trim(),
    variables: extractVariables(pattern),
  };
}

/**
 * Parse multiple patterns (newline or comma separated)
 */
export function parsePatterns(input: string): KeywordPattern[] {
  return input
    .split(/[\n,]/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(parsePattern);
}

/**
 * Check if a pattern has variables
 */
export function hasVariables(pattern: KeywordPattern): boolean {
  return pattern.variables.length > 0;
}

/**
 * Match a message against a pattern and extract variable values
 * Returns null if no match, or a record of variable -> value mappings
 */
export function matchPattern(
  pattern: KeywordPattern,
  message: string,
  matchMode: MatchMode
): Record<string, string> | null {
  const patternStr = pattern.pattern;

  // If pattern has no variables, do simple matching
  if (!hasVariables(pattern)) {
    const matched = simpleMatch(patternStr, message, matchMode);
    return matched ? {} : null;
  }

  // Build regex from pattern with variable capture groups
  // Escape special regex chars, then replace \{var\} with capture groups
  // Use (\S+) for non-whitespace matching which handles most cases better
  let regexStr = patternStr
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
    .replace(/\\{(\w+)\\}/g, '(\\S+)');       // Replace {var} with non-whitespace capture

  // Apply match mode
  switch (matchMode) {
    case 'exact':
      regexStr = `^${regexStr}$`;
      break;
    case 'startsWith':
      // Add word boundary at end to ensure full token matching
      regexStr = `^${regexStr}(?=\\s|$)`;
      break;
    case 'word':
      // Word boundary matching
      regexStr = `(?:^|\\s)${regexStr}(?=\\s|$)`;
      break;
    case 'contains':
      // Add word boundary at end to ensure full token matching
      regexStr = `${regexStr}(?=\\s|$)`;
      break;
  }

  try {
    const regex = new RegExp(regexStr, 'i');
    const match = message.match(regex);

    if (!match) return null;

    // Extract variable values from capture groups
    const result: Record<string, string> = {};
    pattern.variables.forEach((varName, index) => {
      // For word mode, captured content starts at index 1
      // For other modes, it also starts at index 1
      result[varName] = match[index + 1]?.trim() || '';
    });

    return result;
  } catch (e) {
    // Invalid regex - shouldn't happen but be safe
    return null;
  }
}

/**
 * Simple string matching without variables
 */
function simpleMatch(pattern: string, message: string, matchMode: MatchMode): boolean {
  const lowerPattern = pattern.toLowerCase();
  const lowerMessage = message.toLowerCase();

  switch (matchMode) {
    case 'exact':
      return lowerMessage === lowerPattern;

    case 'startsWith':
      return lowerMessage.startsWith(lowerPattern);

    case 'contains':
      return lowerMessage.includes(lowerPattern);

    case 'word':
      // Check if pattern appears as a word (with word boundaries)
      const wordRegex = new RegExp(`(?:^|\\s)${escapeRegex(lowerPattern)}(?:\\s|$)`, 'i');
      return wordRegex.test(lowerMessage);

    default:
      return false;
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Try to match a message against a group's keywords
 * Returns the first matching pattern and extracted variables
 */
export function matchGroup(
  group: ResponseGroup,
  message: string,
  channelId: string
): PatternMatchResult {
  // Check channel restrictions
  if (group.enabledChannels.length > 0 && !group.enabledChannels.includes(channelId)) {
    return { matched: false };
  }

  // Try each keyword pattern
  for (const pattern of group.keywords) {
    const variables = matchPattern(pattern, message, group.matchMode);
    if (variables !== null) {
      return {
        matched: true,
        group,
        variables,
        pattern,
      };
    }
  }

  return { matched: false };
}

/**
 * Find the first matching group from a list of groups
 */
export function findMatchingGroup(
  groups: ResponseGroup[],
  message: string,
  channelId: string
): PatternMatchResult {
  for (const group of groups) {
    if (!group.enabled) continue;

    const result = matchGroup(group, message, channelId);
    if (result.matched) {
      return result;
    }
  }

  return { matched: false };
}

/**
 * Get the display string for a pattern (showing variables highlighted)
 */
export function formatPatternDisplay(pattern: KeywordPattern): string {
  if (!hasVariables(pattern)) {
    return pattern.pattern;
  }

  // Highlight variables with backticks
  return pattern.pattern.replace(/\{(\w+)\}/g, '`{$1}`');
}

/**
 * Validate a pattern string
 * Returns error message if invalid, null if valid
 */
export function validatePattern(pattern: string): string | null {
  if (!pattern || pattern.trim().length === 0) {
    return 'Pattern cannot be empty';
  }

  if (pattern.length > 200) {
    return 'Pattern cannot exceed 200 characters';
  }

  // Check for unmatched braces
  const openBraces = (pattern.match(/\{/g) || []).length;
  const closeBraces = (pattern.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    return 'Unmatched braces in pattern';
  }

  // Check for empty variable names
  if (/\{\s*\}/.test(pattern)) {
    return 'Empty variable name in pattern';
  }

  // Check for invalid variable names (must be alphanumeric)
  const vars = extractVariables(pattern);
  for (const v of vars) {
    if (!/^\w+$/.test(v)) {
      return `Invalid variable name: ${v}`;
    }
  }

  return null;
}
