/**
 * Template variable utilities
 * Handles {{변수}} placeholder detection, extraction, and substitution
 */

/** Regex to match {{변수명}} placeholders */
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Extract all unique variable names from a template text
 * e.g. "계약금: {{계약금}}, 잔금: {{잔금}}" → ["계약금", "잔금"]
 */
export function extractVariables(text: string): string[] {
  if (!text) return [];
  const matches = new Set<string>();
  let match;
  const regex = new RegExp(VARIABLE_PATTERN.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1].trim());
  }
  return Array.from(matches);
}

/**
 * Replace all {{변수}} placeholders in text with their values
 * Unreplaced variables remain as {{변수}} for visibility
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string> | null | undefined
): string {
  if (!text || !variables) return text || '';
  return text.replace(VARIABLE_PATTERN, (fullMatch, varName) => {
    const trimmed = varName.trim();
    return variables[trimmed] !== undefined && variables[trimmed] !== ''
      ? variables[trimmed]
      : fullMatch;
  });
}

/**
 * Check if text contains any {{변수}} placeholders
 */
export function hasVariables(text: string): boolean {
  if (!text) return false;
  return VARIABLE_PATTERN.test(text);
}

/**
 * Build initial variables map from extracted variable names
 * Preserves existing values if provided
 */
export function buildVariablesMap(
  variableNames: string[],
  existingValues?: Record<string, string> | null
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of variableNames) {
    map[name] = existingValues?.[name] || '';
  }
  return map;
}
