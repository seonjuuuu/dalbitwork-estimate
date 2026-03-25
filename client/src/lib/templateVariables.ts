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

/** Default preset values for common variables */
const VARIABLE_PRESETS: Record<string, string> = {
  '계좌번호': '국민은행 616337-04-005356',
  '예금주': '문선주(달빛워크)',
};

/** Variables that represent monetary amounts (should have comma formatting) */
const AMOUNT_VARIABLES = ['계약금', '잔금', '총금액'];

/** Variables that represent percentage ratios */
const RATIO_VARIABLES = ['계약금비율', '잔금비율'];

/**
 * Get the default preset value for a variable name
 */
export function getPresetValue(varName: string): string {
  return VARIABLE_PRESETS[varName] || '';
}

/**
 * Check if a variable is an amount variable (needs comma formatting)
 */
export function isAmountVariable(varName: string): boolean {
  return AMOUNT_VARIABLES.includes(varName) || varName.includes('금액') || varName.includes('금');
}

/**
 * Check if a variable is a ratio variable
 */
export function isRatioVariable(varName: string): boolean {
  return RATIO_VARIABLES.includes(varName) || varName.includes('비율');
}

/**
 * Format a number string with commas (e.g., 325000 -> 325,000)
 */
export function formatAmountWithComma(value: string): string {
  // Remove existing commas and non-digit chars except for leading minus
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

/**
 * Parse a comma-formatted amount string to number
 */
export function parseAmountString(value: string): number {
  return Number(value.replace(/[^\d]/g, '')) || 0;
}

/**
 * Calculate deposit and balance from total amount and deposit ratio
 * Returns { deposit, balance } as formatted strings with commas and '원' suffix
 */
export function calculateAmounts(
  totalAmount: number,
  depositRatio: number
): { deposit: string; balance: string } {
  const depositAmount = Math.round(totalAmount * (depositRatio / 100));
  const balanceAmount = totalAmount - depositAmount;
  return {
    deposit: `${depositAmount.toLocaleString('ko-KR')}원`,
    balance: `${balanceAmount.toLocaleString('ko-KR')}원`,
  };
}

/**
 * Build initial variables map from extracted variable names
 * Preserves existing values if provided, applies presets for new variables
 */
export function buildVariablesMap(
  variableNames: string[],
  existingValues?: Record<string, string> | null
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of variableNames) {
    // Use existing value if available, otherwise apply preset
    map[name] = existingValues?.[name] || getPresetValue(name);
  }
  return map;
}
