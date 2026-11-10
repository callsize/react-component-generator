import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { usePersistentState } from './usePersistentState';
import { addToHistory, parseComponents, parseHistory } from '../utils/storage';
import { readNdjson } from '../utils/ndjson';

// 서버 `/api/generate`(stream: true)가 보내는 줄 단위 JSON 이벤트. 서버(`server/index.ts`)와 수동으로 맞춘다.
type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

export const STORAGE_KEYS = {
  components: 'rcg:components',
  history: 'rcg:promptHistory',
} as const;

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  history: string[];
  isLoading: boolean;
  error: string | null;
  /** 생성 중인 코드의 누적 텍스트. 생성이 끝나면 빈 문자열. */
  streamingCode: string;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = usePersistentState<GeneratedComponent[]>(
    STORAGE_KEYS.components,
    [],
    parseComponents,
  );
  const [history, setHistory] = usePersistentState<string[]>(
    STORAGE_KEYS.history,
    [],
    parseHistory,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingCode, setStreamingCode] = useState('');

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);
    setStreamingCode('');
    setHistory((prev) => addToHistory(prev, prompt));

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider, stream: true }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      let finalCode: string | null = null;

      for await (const event of readNdjson(res.body) as AsyncGenerator<StreamEvent>) {
        if (event.type === 'delta') {
          setStreamingCode((prev) => prev + event.text);
        } else if (event.type === 'error') {
          throw new Error(event.error);
        } else if (event.type === 'done') {
          finalCode = event.code;
        }
      }

      if (finalCode === null) {
        throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
      }

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code: finalCode,
        createdAt: new Date(),
      };

      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setStreamingCode('');
      setIsLoading(false);
    }
  }, [setComponents, setHistory]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, history, isLoading, error, streamingCode, generate, removeComponent, clearAll };
}
