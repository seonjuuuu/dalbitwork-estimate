import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  substituteVariables,
  hasVariables,
  buildVariablesMap,
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
  it('builds map with empty values for new variables', () => {
    const result = buildVariablesMap(['계약금', '잔금', '총금액']);
    expect(result).toEqual({ '계약금': '', '잔금': '', '총금액': '' });
  });

  it('preserves existing values', () => {
    const existing = { '계약금': '325,000원', '잔금': '325,000원' };
    const result = buildVariablesMap(['계약금', '잔금', '총금액'], existing);
    expect(result).toEqual({
      '계약금': '325,000원',
      '잔금': '325,000원',
      '총금액': '',
    });
  });

  it('handles null existing values', () => {
    const result = buildVariablesMap(['계약금'], null);
    expect(result).toEqual({ '계약금': '' });
  });
});
