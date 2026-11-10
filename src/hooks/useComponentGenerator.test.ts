import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

const STORED_COMPONENT = {
  id: 'abc',
  prompt: '저장된 프롬프트',
  code: 'render(<div />)',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function stubFetchSuccess(code = 'render(<p />)') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ code }) })),
  );
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
