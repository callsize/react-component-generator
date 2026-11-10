import { describe, it, expect, vi } from 'vitest';
import { fetchWithTimeout } from './fetchWithTimeout';

// signal이 abort되면 AbortError로 reject하는, 응답이 오지 않는 fetch
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  });
}

describe('fetchWithTimeout', () => {
  it('시간 안에 응답하면 그 응답을 반환한다', async () => {
    const response = new Response('ok');
    const fetchFn = vi.fn(async () => response);

    const result = await fetchWithTimeout('http://x', {}, 1000, fetchFn);

    expect(result).toBe(response);
  });

  it('fetch에 AbortSignal을 전달한다', async () => {
    const fetchFn = vi.fn(async () => new Response('ok'));

    await fetchWithTimeout('http://x', { method: 'POST' }, 1000, fetchFn);

    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('시간이 지나도 응답이 없으면 시간 초과 에러를 던진다', async () => {
    await expect(fetchWithTimeout('http://x', {}, 20, hangingFetch())).rejects.toThrow(
      '응답 시간이 초과',
    );
  });

  it('시간 초과가 아닌 에러는 그대로 던진다', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    });

    await expect(fetchWithTimeout('http://x', {}, 1000, fetchFn)).rejects.toThrow('network down');
  });
});
