import { describe, it, expect } from 'vitest';
import { createGenerationStream } from './generationStream';

async function* chunksOf(...texts: string[]): AsyncGenerator<string> {
  for (const text of texts) yield text;
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('createGenerationStream', () => {
  it('청크마다 delta 이벤트를 내보내고 마지막에 done을 내보낸다', async () => {
    const stream = createGenerationStream(chunksOf('const A', ' = 1;'), (text) => text);

    expect(await readEvents(stream)).toEqual([
      { type: 'delta', text: 'const A' },
      { type: 'delta', text: ' = 1;' },
      { type: 'done', code: 'const A = 1;' },
    ]);
  });

  it('done의 code는 전체 텍스트를 이어 붙여 finalize를 거친 값이다', async () => {
    const stream = createGenerationStream(chunksOf('a', 'b'), (text) => `<${text}>`);

    const events = await readEvents(stream);

    expect(events.at(-1)).toEqual({ type: 'done', code: '<ab>' });
  });

  it('빈 텍스트 청크는 delta로 보내지 않는다', async () => {
    const stream = createGenerationStream(chunksOf('', 'x', ''), (text) => text);

    expect(await readEvents(stream)).toEqual([
      { type: 'delta', text: 'x' },
      { type: 'done', code: 'x' },
    ]);
  });

  it('청크 생성 중 에러가 나면 error 이벤트를 내보내고 done은 보내지 않는다', async () => {
    async function* failing(): AsyncGenerator<string> {
      yield 'const A';
      throw new Error('생성된 코드가 너무 길어 잘렸습니다.');
    }

    const events = await readEvents(createGenerationStream(failing(), (text) => text));

    expect(events).toEqual([
      { type: 'delta', text: 'const A' },
      { type: 'error', error: '생성된 코드가 너무 길어 잘렸습니다.' },
    ]);
  });

  it('스트림 도중 503 에러는 과부하 안내 문구의 error 이벤트로 바꿔 내보낸다', async () => {
    async function* failing(): AsyncGenerator<string> {
      yield 'const A';
      throw new Error('Gemini API error: 503');
    }

    const events = await readEvents(createGenerationStream(failing(), (text) => text));

    expect(events.at(-1)).toEqual({
      type: 'error',
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('스트림 도중 429 에러는 요청 과다 안내 문구의 error 이벤트로 바꿔 내보낸다', async () => {
    async function* failing(): AsyncGenerator<string> {
      yield 'const A';
      throw new Error('Claude API error: 429');
    }

    const events = await readEvents(createGenerationStream(failing(), (text) => text));

    expect(events.at(-1)).toEqual({ type: 'error', error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  });

  it('클라이언트가 스트림을 취소하면 onCancel을 호출한다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    async function* slow(): AsyncGenerator<string> {
      yield 'a';
      await gate;
      yield 'b';
    }
    let cancelled = 0;
    const stream = createGenerationStream(slow(), (text) => text, () => {
      cancelled += 1;
    });

    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    release();

    expect(cancelled).toBe(1);
  });

  it('텍스트가 하나도 없으면 error 이벤트를 내보낸다', async () => {
    const events = await readEvents(createGenerationStream(chunksOf(), (text) => text));

    expect(events).toEqual([{ type: 'error', error: 'AI가 빈 응답을 반환했습니다.' }]);
  });
});
