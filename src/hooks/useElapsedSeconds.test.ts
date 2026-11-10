import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElapsedSeconds } from './useElapsedSeconds';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useElapsedSeconds', () => {
  it('비활성 상태에서는 0이다', () => {
    const { result } = renderHook(() => useElapsedSeconds(false));
    expect(result.current).toBe(0);
  });

  it('활성 상태에서 1초마다 증가한다', () => {
    const { result } = renderHook(() => useElapsedSeconds(true));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(3);
  });

  it('비활성으로 바뀌면 0으로 돌아가고 다시 활성화하면 처음부터 센다', () => {
    const { result, rerender } = renderHook(({ active }) => useElapsedSeconds(active), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(2);

    rerender({ active: false });
    expect(result.current).toBe(0);

    rerender({ active: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
  });
});
