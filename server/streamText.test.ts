import { describe, it, expect } from 'vitest';
import { extractAnthropicText, extractGoogleChunk } from './streamText';

describe('extractAnthropicText', () => {
  it('content_block_delta의 text_delta에서 텍스트를 꺼낸다', () => {
    const payload = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });

    expect(extractAnthropicText(payload)).toBe('const A');
  });

  it('텍스트가 없는 이벤트는 빈 문자열을 돌려준다', () => {
    const payload = JSON.stringify({ type: 'message_start', message: {} });

    expect(extractAnthropicText(payload)).toBe('');
  });

  it('error 이벤트를 받으면 API error 형식의 에러를 던진다', () => {
    const payload = JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });

    expect(() => extractAnthropicText(payload)).toThrow('Claude API error: overloaded_error');
  });
});

describe('extractGoogleChunk', () => {
  it('candidates의 parts 텍스트를 이어 붙인다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'const ' }, { text: 'A' }] } }],
    });

    expect(extractGoogleChunk(payload)).toEqual({ text: 'const A', truncated: false });
  });

  it('finishReason이 MAX_TOKENS이면 truncated를 true로 표시한다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });

    expect(extractGoogleChunk(payload)).toEqual({ text: 'x', truncated: true });
  });

  it('candidates가 없으면 빈 텍스트를 돌려준다', () => {
    expect(extractGoogleChunk('{}')).toEqual({ text: '', truncated: false });
  });

  it('error 페이로드를 받으면 API error 형식의 에러를 던진다', () => {
    const payload = JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE' } });

    expect(() => extractGoogleChunk(payload)).toThrow('Gemini API error: 503');
  });

  it('SAFETY 같은 비정상 finishReason이면 생성이 중단되었다는 에러를 던진다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'SAFETY' }],
    });

    expect(() => extractGoogleChunk(payload)).toThrow('SAFETY');
  });

  it('finishReason이 STOP이면 정상 종료로 본다', () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }],
    });

    expect(extractGoogleChunk(payload)).toEqual({ text: 'x', truncated: false });
  });
});
