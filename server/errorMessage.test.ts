import { describe, it, expect } from 'vitest';
import { classifyError } from './errorMessage';

describe('classifyError', () => {
  it('503이 포함된 메시지는 503과 과부하 안내로 분류한다', () => {
    expect(classifyError('Gemini API error: 503')).toEqual({
      status: 503,
      message: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('429가 포함된 메시지는 429와 요청 과다 안내로 분류한다', () => {
    expect(classifyError('Claude API error: 429')).toEqual({
      status: 429,
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('그 외 메시지는 500과 원문 그대로 분류한다', () => {
    expect(classifyError('생성된 코드가 너무 길어 잘렸습니다.')).toEqual({
      status: 500,
      message: '생성된 코드가 너무 길어 잘렸습니다.',
    });
  });
});
