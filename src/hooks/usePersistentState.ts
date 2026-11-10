import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { loadStored, saveStored } from '../utils/storage';

/** useState처럼 쓰되 값이 바뀔 때마다 localStorage에 저장하고, 마운트 시 복원한다. */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  parse?: (raw: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => loadStored(key, fallback, parse));

  useEffect(() => {
    saveStored(key, state);
  }, [key, state]);

  return [state, setState];
}
