import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

const STORED_COMPONENT = {
  id: 'abc',
  prompt: '저장된 프롬프트',
  code: 'render(<div />)',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const encoder = new TextEncoder();

function ndjsonText(...events: unknown[]): string {
  return events.map((event) => `${JSON.stringify(event)}\n`).join('');
}

function ndjson(...events: unknown[]): Uint8Array {
  return encoder.encode(ndjsonText(...events));
}

function streamResponse(...events: unknown[]): Response {
  return new Response(ndjsonText(...events));
}

function stubFetchSuccess(code = 'render(<p />)') {
  const fetchMock = vi.fn(async () =>
    streamResponse({ type: 'delta', text: code }, { type: 'done', code }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useComponentGenerator 저장', () => {
  it('저장된 컴포넌트 목록을 복원한다', () => {
    localStorage.setItem('rcg:components', JSON.stringify([STORED_COMPONENT]));

    const { result } = renderHook(() => useComponentGenerator());

    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].createdAt).toBeInstanceOf(Date);
  });

  it('저장된 프롬프트 히스토리를 복원한다', () => {
    localStorage.setItem('rcg:promptHistory', JSON.stringify(['예전 프롬프트']));

    const { result } = renderHook(() => useComponentGenerator());

    expect(result.current.history).toEqual(['예전 프롬프트']);
  });

  it('생성에 성공하면 컴포넌트 목록을 localStorage에 저장한다', async () => {
    stubFetchSuccess();
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    const stored = JSON.parse(localStorage.getItem('rcg:components') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].prompt).toBe('버튼');
  });

  it('생성을 요청하면 프롬프트를 히스토리에 기록하고 저장한다', async () => {
    stubFetchSuccess();
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.history).toEqual(['버튼']);
    expect(JSON.parse(localStorage.getItem('rcg:promptHistory') ?? '[]')).toEqual(['버튼']);
  });

  it('전체 삭제하면 저장된 컴포넌트 목록도 비운다', () => {
    localStorage.setItem('rcg:components', JSON.stringify([STORED_COMPONENT]));
    const { result } = renderHook(() => useComponentGenerator());

    act(() => result.current.clearAll());

    expect(JSON.parse(localStorage.getItem('rcg:components') ?? 'null')).toEqual([]);
  });
});

describe('useComponentGenerator 스트리밍', () => {
  it('스트리밍 요청임을 알리는 stream 플래그를 본문에 담아 보낸다', async () => {
    const fetchMock = stubFetchSuccess();
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ prompt: '버튼', stream: true });
  });

  it('delta 이벤트를 받는 대로 streamingCode에 누적한다', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    const { result } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('버튼', undefined, 'google');
    });

    await act(async () => {
      controller.enqueue(ndjson({ type: 'delta', text: 'const A' }));
    });
    await waitFor(() => expect(result.current.streamingCode).toBe('const A'));

    await act(async () => {
      controller.enqueue(ndjson({ type: 'delta', text: ' = 1;' }));
    });
    await waitFor(() => expect(result.current.streamingCode).toBe('const A = 1;'));

    await act(async () => {
      controller.enqueue(ndjson({ type: 'done', code: 'const A = 1;\nrender(<A />);' }));
      controller.close();
      await pending;
    });
  });

  it('done 이벤트의 정리된 코드로 컴포넌트를 추가하고 streamingCode를 비운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse({ type: 'delta', text: '```const A```' }, { type: 'done', code: 'const A;\nrender(<A />);' }),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.components[0].code).toBe('const A;\nrender(<A />);');
    expect(result.current.streamingCode).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it('스트림 도중 error 이벤트를 받으면 에러를 표시하고 컴포넌트를 추가하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse({ type: 'delta', text: 'const A' }, { type: 'error', error: '코드가 잘렸습니다' }),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).toBe('코드가 잘렸습니다');
    expect(result.current.components).toHaveLength(0);
    expect(result.current.streamingCode).toBe('');
  });

  it('done 없이 스트림이 끝나면 에러로 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse({ type: 'delta', text: 'const A' })),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.components).toHaveLength(0);
  });

  it('스트림 시작 전 HTTP 에러는 서버의 에러 메시지를 표시한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: '요청이 너무 많습니다.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).toBe('요청이 너무 많습니다.');
  });
});
