import { describe, it, expect } from 'vitest';
import { withIdleTimeout } from './idleTimeout';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function collect(source: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];
  for await (const item of source) result.push(item);
  return result;
}

describe('withIdleTimeout', () => {
  it('제한 시간 안에 오는 청크는 그대로 전달한다', async () => {
    async function* source() {
      yield 'a';
      await sleep(10);
      yield 'b';
    }

    expect(await collect(withIdleTimeout(source(), 200))).toEqual(['a', 'b']);
  });

  it('청크 사이가 제한 시간을 넘으면 시간 초과 에러를 던진다', async () => {
    async function* source() {
      yield 'a';
      await sleep(300);
      yield 'b';
    }

    await expect(collect(withIdleTimeout(source(), 50))).rejects.toThrow('응답 시간이 초과되었습니다');
  });

  it('첫 청크가 오기 전에 멈춰도 시간 초과 에러를 던진다', async () => {
    async function* source(): AsyncGenerator<string> {
      await sleep(300);
      yield 'a';
    }

    await expect(collect(withIdleTimeout(source(), 50))).rejects.toThrow('응답 시간이 초과되었습니다');
  });

  it('원본이 던진 에러는 그대로 전달한다', async () => {
    async function* source(): AsyncGenerator<string> {
      yield 'a';
      throw new Error('원본 에러');
    }

    await expect(collect(withIdleTimeout(source(), 200))).rejects.toThrow('원본 에러');
  });
});
