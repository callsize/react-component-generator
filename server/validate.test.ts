import { describe, it, expect } from 'vitest';
import { validatePromptLength, MAX_PROMPT_LENGTH } from './validate';

describe('validatePromptLength', () => {
  it('500자 프롬프트는 통과한다', () => {
    expect(validatePromptLength('a'.repeat(500))).toEqual({ ok: true });
  });

  it('501자 프롬프트는 에러 메시지와 함께 거부한다', () => {
    const result = validatePromptLength('a'.repeat(501));

    expect(result).toEqual({
      ok: false,
      error: '프롬프트는 500자 이하로 입력해주세요.',
    });
  });

  it('최대 길이 상수는 500이다', () => {
    expect(MAX_PROMPT_LENGTH).toBe(500);
  });
});
