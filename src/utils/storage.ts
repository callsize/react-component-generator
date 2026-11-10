import type { GeneratedComponent, Provider } from '../types';

export const MAX_HISTORY = 20;

const PROVIDERS: Provider[] = ['anthropic', 'google'];

/** localStorage에서 JSON을 읽는다. 값이 없거나 깨졌거나 parse가 던지면 fallback을 반환한다. */
export function loadStored<T>(key: string, fallback: T, parse?: (raw: unknown) => T): T {
  try {
    const text = localStorage.getItem(key);
    if (text === null) return fallback;
    const raw: unknown = JSON.parse(text);
    return parse ? parse(raw) : (raw as T);
  } catch {
    return fallback;
  }
}

/** localStorage에 JSON으로 저장한다. 용량 초과 등 저장소 에러는 무시한다. */
export function saveStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 앱 동작에 영향을 주지 않는다.
  }
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

export function parseProvider(raw: unknown): Provider {
  if (PROVIDERS.includes(raw as Provider)) return raw as Provider;
  throw new Error('알 수 없는 Provider');
}

export function parseApiKeys(raw: unknown): Record<Provider, string> {
  if (!isRecord(raw)) throw new Error('API 키 형식이 올바르지 않습니다');
  const read = (provider: Provider) => (typeof raw[provider] === 'string' ? raw[provider] : '');
  return { anthropic: read('anthropic'), google: read('google') };
}

export function parseHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error('히스토리 형식이 올바르지 않습니다');
  return raw.filter((item): item is string => typeof item === 'string' && item !== '');
}

export function parseComponents(raw: unknown): GeneratedComponent[] {
  if (!Array.isArray(raw)) throw new Error('컴포넌트 목록 형식이 올바르지 않습니다');
  const result: GeneratedComponent[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.prompt === 'string' &&
      typeof item.code === 'string' &&
      typeof item.createdAt === 'string'
    ) {
      const createdAt = new Date(item.createdAt);
      if (!Number.isNaN(createdAt.getTime())) {
        result.push({ id: item.id, prompt: item.prompt, code: item.code, createdAt });
      }
    }
  }
  return result;
}

/** 프롬프트를 히스토리 맨 앞에 추가한다. 공백 제거, 빈 값 무시, 중복 제거, 최대 개수 제한. */
export function addToHistory(history: string[], prompt: string): string[] {
  const trimmed = prompt.trim();
  if (!trimmed) return history;
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, MAX_HISTORY);
}
