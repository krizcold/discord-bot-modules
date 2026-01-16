/**
 * Overlap Detector
 *
 * Detects when keywords from different groups might conflict.
 */

import { ResponseGroup, OverlapInfo, KeywordPattern } from '../types/responseManager';
import { hasVariables } from './patternParser';

/**
 * Normalize a keyword for comparison
 * Strips variables and lowercases
 */
function normalizeKeyword(pattern: KeywordPattern): string {
  // Remove variable placeholders and normalize
  return pattern.pattern
    .replace(/\{[^}]+\}/g, '*')  // Replace variables with wildcard marker
    .toLowerCase()
    .trim();
}

/**
 * Check if two patterns might conflict
 */
function patternsConflict(a: KeywordPattern, b: KeywordPattern): boolean {
  const normA = normalizeKeyword(a);
  const normB = normalizeKeyword(b);

  // Exact match
  if (normA === normB) return true;

  // If either has variables (wildcards), check if they could overlap
  if (normA.includes('*') || normB.includes('*')) {
    // Simple heuristic: check if non-variable parts overlap
    const partsA = normA.split('*').filter(p => p.length > 0);
    const partsB = normB.split('*').filter(p => p.length > 0);

    // If any part of A is contained in B or vice versa, might conflict
    for (const partA of partsA) {
      if (normB.includes(partA)) return true;
    }
    for (const partB of partsB) {
      if (normA.includes(partB)) return true;
    }
  }

  // Check containment for non-variable patterns
  if (!hasVariables(a) && !hasVariables(b)) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect overlapping keywords across groups
 * Returns list of overlaps found
 */
export function detectOverlaps(groups: ResponseGroup[]): OverlapInfo[] {
  const overlaps: OverlapInfo[] = [];
  const seenOverlaps = new Set<string>();  // Prevent duplicates

  for (let i = 0; i < groups.length; i++) {
    const groupA = groups[i];
    if (!groupA.enabled) continue;

    for (let j = i + 1; j < groups.length; j++) {
      const groupB = groups[j];
      if (!groupB.enabled) continue;

      // Check all keyword combinations
      for (const keywordA of groupA.keywords) {
        for (const keywordB of groupB.keywords) {
          if (patternsConflict(keywordA, keywordB)) {
            // Create a normalized key to prevent duplicate reports
            const overlapKey = [groupA.name, groupB.name].sort().join('|') + ':' + normalizeKeyword(keywordA);

            if (!seenOverlaps.has(overlapKey)) {
              seenOverlaps.add(overlapKey);
              overlaps.push({
                keyword: keywordA.pattern,  // Show original pattern
                groups: [groupA.name, groupB.name],
              });
            }
          }
        }
      }
    }
  }

  return overlaps;
}

/**
 * Check if adding a keyword to a group would cause overlaps
 */
export function wouldCauseOverlap(
  groups: ResponseGroup[],
  targetGroupId: string,
  newKeyword: KeywordPattern
): OverlapInfo[] {
  const overlaps: OverlapInfo[] = [];
  const targetGroup = groups.find(g => g.id === targetGroupId);

  for (const group of groups) {
    if (group.id === targetGroupId) continue;
    if (!group.enabled) continue;

    for (const keyword of group.keywords) {
      if (patternsConflict(newKeyword, keyword)) {
        overlaps.push({
          keyword: newKeyword.pattern,
          groups: [targetGroup?.name || targetGroupId, group.name],
        });
      }
    }
  }

  return overlaps;
}

/**
 * Format overlaps for display
 */
export function formatOverlapWarning(overlaps: OverlapInfo[]): string {
  if (overlaps.length === 0) return '';

  if (overlaps.length === 1) {
    const o = overlaps[0];
    return `"${o.keyword}" overlaps with: ${o.groups.join(', ')}`;
  }

  return `${overlaps.length} keyword conflicts detected`;
}

/**
 * Get a summary of all overlaps for display
 */
export function getOverlapSummary(overlaps: OverlapInfo[]): string[] {
  return overlaps.map(o => `"${o.keyword}" conflicts between ${o.groups.join(' and ')}`);
}
