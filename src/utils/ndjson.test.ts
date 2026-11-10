import { describe, it, expect } from 'vitest';
import { readNdjson } from './ndjson';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const result: unknown[] = [];
  for await (const item of readNdjson(body)) result.push(item);
  return result;
}

describe('readNdjson', () => {
  it('줄마다 JSON을 파싱해 순서대로 내보낸다', async () => {
    const body = streamOf('{"type":"delta","text":"a"}\n{"type":"done"}\n');

    expect(await collect(body)).toEqual([{ type: 'delta', text: 'a' }, { type: 'done' }]);
  });

  it('청크 경계에 걸린 줄을 이어 붙인다', async () => {
    const body = streamOf('{"type":"del', 'ta","text":"안녕"}\n');

    expect(await collect(body)).toEqual([{ type: 'delta', text: '안녕' }]);
  });

  it('멀티바이트 문자가 청크 경계에서 잘려도 깨지지 않는다', async () => {
    const bytes = new TextEncoder().encode('{"text":"한"}\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 10));
        controller.enqueue(bytes.slice(10));
        controller.close();
      },
    });

    expect(await collect(body)).toEqual([{ text: '한' }]);
  });

  it('빈 줄은 건너뛴다', async () => {
    const body = streamOf('\n{"a":1}\n\n');

    expect(await collect(body)).toEqual([{ a: 1 }]);
  });

  it('마지막 줄에 개행이 없어도 내보낸다', async () => {
    const body = streamOf('{"a":1}');

    expect(await collect(body)).toEqual([{ a: 1 }]);
  });
});
