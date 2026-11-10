import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadStored,
  saveStored,
  parseProvider,
  parseApiKeys,
  parseHistory,
  parseComponents,
  addToHistory,
  MAX_HISTORY,
} from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('loadStored', () => {
  it('저장된 값이 없으면 fallback을 반환한다', () => {
    expect(loadStored('k', 'fb')).toBe('fb');
  });

  it('저장된 JSON을 파싱해 반환한다', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }));
    expect(loadStored('k', null)).toEqual({ a: 1 });
  });

  it('JSON이 깨져 있으면 fallback을 반환한다', () => {
    localStorage.setItem('k', '{broken');
    expect(loadStored('k', 'fb')).toBe('fb');
  });

  it('parse가 던지면 fallback을 반환한다', () => {
    localStorage.setItem('k', JSON.stringify('x'));
    const parse = () => {
      throw new Error('invalid');
    };
    expect(loadStored('k', 'fb', parse)).toBe('fb');
  });
});

describe('saveStored', () => {
  it('값을 JSON으로 저장한다', () => {
    saveStored('k', { a: 1 });
    expect(localStorage.getItem('k')).toBe('{"a":1}');
  });

  it('저장소가 에러를 던져도 예외를 전파하지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveStored('k', 1)).not.toThrow();
    spy.mockRestore();
  });
});

describe('parseProvider', () => {
  it('유효한 Provider는 그대로 반환한다', () => {
    expect(parseProvider('anthropic')).toBe('anthropic');
    expect(parseProvider('google')).toBe('google');
  });

  it('알 수 없는 값이면 던진다', () => {
    expect(() => parseProvider('openai')).toThrow();
  });
});

describe('parseApiKeys', () => {
  it('Provider별 키를 반환한다', () => {
    expect(parseApiKeys({ anthropic: 'a', google: 'g' })).toEqual({ anthropic: 'a', google: 'g' });
  });

  it('문자열이 아니거나 없는 키는 빈 문자열로 채운다', () => {
    expect(parseApiKeys({ anthropic: 1 })).toEqual({ anthropic: '', google: '' });
  });

  it('객체가 아니면 던진다', () => {
    expect(() => parseApiKeys('x')).toThrow();
  });
});

describe('parseHistory', () => {
  it('문자열 배열을 반환한다', () => {
    expect(parseHistory(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('문자열이 아닌 항목과 빈 문자열은 걸러낸다', () => {
    expect(parseHistory(['a', 1, '', null])).toEqual(['a']);
  });

  it('배열이 아니면 던진다', () => {
    expect(() => parseHistory({})).toThrow();
  });
});

describe('parseComponents', () => {
  const valid = { id: '1', prompt: 'p', code: 'c', createdAt: '2026-01-01T00:00:00.000Z' };

  it('createdAt을 Date로 복원한다', () => {
    const [result] = parseComponents([valid]);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe(valid.createdAt);
  });

  it('필드가 잘못된 항목은 걸러낸다', () => {
    const result = parseComponents([valid, { id: '2' }, { ...valid, createdAt: 'nope' }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('배열이 아니면 던진다', () => {
    expect(() => parseComponents('x')).toThrow();
  });
});

describe('addToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addToHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('앞뒤 공백을 제거하고, 빈 프롬프트는 무시한다', () => {
    expect(addToHistory(['a'], '  b  ')).toEqual(['b', 'a']);
    expect(addToHistory(['a'], '   ')).toEqual(['a']);
  });

  it('중복이면 기존 항목을 제거하고 맨 앞으로 옮긴다', () => {
    expect(addToHistory(['a', 'b'], 'b')).toEqual(['b', 'a']);
  });

  it('최대 개수를 넘기면 오래된 항목을 버린다', () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => `p${i}`);
    const result = addToHistory(full, 'new');
    expect(result).toHaveLength(MAX_HISTORY);
    expect(result[0]).toBe('new');
    expect(result).not.toContain(`p${MAX_HISTORY - 1}`);
  });
});
