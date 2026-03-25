import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  substituteVariables,
  hasVariables,
  buildVariablesMap,
  getPresetValue,
  isAmountVariable,
  isRatioVariable,
  formatAmountWithComma,
  parseAmountString,
  calculateAmounts,
} from './templateVariables';

describe('extractVariables', () => {
  it('extracts variable names from text', () => {
    const text = '계좌번호: {{계좌번호}}, 계약금: {{계약금}}, 잔금: {{잔금}}';
    expect(extractVariables(text)).toEqual(['계좌번호', '계약금', '잔금']);
  });

  it('returns unique variable names', () => {
    const text = '{{계약금}} 입금 후 {{계약금}} 확인';
    expect(extractVariables(text)).toEqual(['계약금']);
  });

  it('returns empty array for text without variables', () => {
    expect(extractVariables('일반 텍스트입니다.')).toEqual([]);
  });

  it('returns empty array for empty/null input', () => {
    expect(extractVariables('')).toEqual([]);
    expect(extractVariables(null as unknown as string)).toEqual([]);
  });

  it('trims whitespace in variable names', () => {
    const text = '{{ 계좌번호 }}와 {{예금주}}';
    expect(extractVariables(text)).toEqual(['계좌번호', '예금주']);
  });
});

describe('substituteVariables', () => {
  it('replaces variables with values', () => {
    const text = '계좌번호: {{계좌번호}}, 예금주: {{예금주}}';
    const vars = { '계좌번호': '국민은행 616337-04-005356', '예금주': '문선주 (달빛워크)' };
    expect(substituteVariables(text, vars)).toBe(
      '계좌번호: 국민은행 616337-04-005356, 예금주: 문선주 (달빛워크)'
    );
  });

  it('leaves unreplaced variables as-is', () => {
    const text = '계약금: {{계약금}}, 잔금: {{잔금}}';
    const vars = { '계약금': '325,000원' };
    expect(substituteVariables(text, vars)).toBe('계약금: 325,000원, 잔금: {{잔금}}');
  });

  it('leaves empty-value variables as-is', () => {
    const text = '금액: {{총금액}}';
    const vars = { '총금액': '' };
    expect(substituteVariables(text, vars)).toBe('금액: {{총금액}}');
  });

  it('returns original text when variables is null', () => {
    const text = '계약금: {{계약금}}';
    expect(substituteVariables(text, null)).toBe('계약금: {{계약금}}');
  });

  it('returns empty string for null text', () => {
    expect(substituteVariables(null as unknown as string, {})).toBe('');
  });

  it('handles multiple occurrences of same variable', () => {
    const text = '{{금액}} 입금 확인. 총 {{금액}}입니다.';
    const vars = { '금액': '650,000원' };
    expect(substituteVariables(text, vars)).toBe('650,000원 입금 확인. 총 650,000원입니다.');
  });
});

describe('hasVariables', () => {
  it('returns true for text with variables', () => {
    expect(hasVariables('{{계약금}} 입금')).toBe(true);
  });

  it('returns false for text without variables', () => {
    expect(hasVariables('일반 텍스트')).toBe(false);
  });

  it('returns false for empty/null input', () => {
    expect(hasVariables('')).toBe(false);
    expect(hasVariables(null as unknown as string)).toBe(false);
  });
});

describe('buildVariablesMap', () => {
  it('builds map with preset values for known variables', () => {
    const result = buildVariablesMap(['계좌번호', '예금주', '총금액']);
    expect(result).toEqual({
      '계좌번호': '국민은행 616337-04-005356',
      '예금주': '문선주(달빛워크)',
      '총금액': '',
    });
  });

  it('preserves existing values over presets', () => {
    const existing = { '계좌번호': '신한은행 123-456', '잔금': '325,000원' };
    const result = buildVariablesMap(['계좌번호', '잔금', '총금액'], existing);
    expect(result).toEqual({
      '계좌번호': '신한은행 123-456',
      '잔금': '325,000원',
      '총금액': '',
    });
  });

  it('handles null existing values', () => {
    const result = buildVariablesMap(['계약금'], null);
    expect(result).toEqual({ '계약금': '' });
  });

  it('applies preset for 예금주 when no existing value', () => {
    const result = buildVariablesMap(['예금주']);
    expect(result['예금주']).toBe('문선주(달빛워크)');
  });
});

describe('getPresetValue', () => {
  it('returns preset for 계좌번호', () => {
    expect(getPresetValue('계좌번호')).toBe('국민은행 616337-04-005356');
  });

  it('returns preset for 예금주', () => {
    expect(getPresetValue('예금주')).toBe('문선주(달빛워크)');
  });

  it('returns empty string for unknown variable', () => {
    expect(getPresetValue('알수없는변수')).toBe('');
  });
});

describe('isAmountVariable', () => {
  it('returns true for known amount variables', () => {
    expect(isAmountVariable('계약금')).toBe(true);
    expect(isAmountVariable('잔금')).toBe(true);
    expect(isAmountVariable('총금액')).toBe(true);
  });

  it('returns true for variables containing 금액 or 금', () => {
    expect(isAmountVariable('추가금액')).toBe(true);
    expect(isAmountVariable('보증금')).toBe(true);
  });

  it('returns false for non-amount variables', () => {
    expect(isAmountVariable('계좌번호')).toBe(false);
    expect(isAmountVariable('프로젝트명')).toBe(false);
  });

  it('returns true for 예금주 (contains 금)', () => {
    // 예금주 contains 금 so it matches the heuristic
    expect(isAmountVariable('예금주')).toBe(true);
  });
});

describe('isRatioVariable', () => {
  it('returns true for known ratio variables', () => {
    expect(isRatioVariable('계약금비율')).toBe(true);
    expect(isRatioVariable('잔금비율')).toBe(true);
  });

  it('returns true for variables containing 비율', () => {
    expect(isRatioVariable('할인비율')).toBe(true);
  });

  it('returns false for non-ratio variables', () => {
    expect(isRatioVariable('계약금')).toBe(false);
  });
});

describe('formatAmountWithComma', () => {
  it('formats number string with commas', () => {
    expect(formatAmountWithComma('325000')).toBe('325,000');
    expect(formatAmountWithComma('1000000')).toBe('1,000,000');
    expect(formatAmountWithComma('650000')).toBe('650,000');
  });

  it('removes existing commas and reformats', () => {
    expect(formatAmountWithComma('1,000,000')).toBe('1,000,000');
  });

  it('strips non-digit characters', () => {
    expect(formatAmountWithComma('650,000원')).toBe('650,000');
  });

  it('returns empty string for empty input', () => {
    expect(formatAmountWithComma('')).toBe('');
    expect(formatAmountWithComma('abc')).toBe('');
  });
});

describe('parseAmountString', () => {
  it('parses comma-formatted amount', () => {
    expect(parseAmountString('325,000')).toBe(325000);
    expect(parseAmountString('1,000,000')).toBe(1000000);
  });

  it('parses amount with 원 suffix', () => {
    expect(parseAmountString('650,000원')).toBe(650000);
  });

  it('returns 0 for empty/invalid input', () => {
    expect(parseAmountString('')).toBe(0);
    expect(parseAmountString('abc')).toBe(0);
  });
});

describe('calculateAmounts', () => {
  it('calculates 50/50 split', () => {
    const result = calculateAmounts(650000, 50);
    expect(result.deposit).toBe('325,000원');
    expect(result.balance).toBe('325,000원');
  });

  it('calculates 30/70 split', () => {
    const result = calculateAmounts(1000000, 30);
    expect(result.deposit).toBe('300,000원');
    expect(result.balance).toBe('700,000원');
  });

  it('handles 100/0 split', () => {
    const result = calculateAmounts(500000, 100);
    expect(result.deposit).toBe('500,000원');
    expect(result.balance).toBe('0원');
  });

  it('handles 0/100 split', () => {
    const result = calculateAmounts(500000, 0);
    expect(result.deposit).toBe('0원');
    expect(result.balance).toBe('500,000원');
  });

  it('rounds deposit correctly', () => {
    const result = calculateAmounts(333333, 50);
    expect(result.deposit).toBe('166,667원');
    expect(result.balance).toBe('166,666원');
  });
});
