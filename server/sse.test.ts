import { describe, it, expect } from 'vitest';
import { readSseData } from './sse';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const result: string[] = [];
  for await (const data of readSseData(body)) result.push(data);
  return result;
}

describe('readSseData', () => {
  it('이벤트마다 data 값을 순서대로 내보낸다', async () => {
    const body = streamOf('data: {"a":1}\n\ndata: {"a":2}\n\n');

    expect(await collect(body)).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('청크 경계에 걸린 이벤트를 이어 붙인다', async () => {
    const body = streamOf('data: {"te', 'xt":"안녕"}\n', '\ndata: 끝\n\n');

    expect(await collect(body)).toEqual(['{"text":"안녕"}', '끝']);
  });

  it('data 줄이 아닌 줄(event:, 주석)은 무시한다', async () => {
    const body = streamOf('event: content_block_delta\ndata: x\n\n: ping\n\n');

    expect(await collect(body)).toEqual(['x']);
  });

  it('CRLF 줄바꿈도 처리한다', async () => {
    const body = streamOf('data: a\r\n\r\ndata: b\r\n\r\n');

    expect(await collect(body)).toEqual(['a', 'b']);
  });
});
