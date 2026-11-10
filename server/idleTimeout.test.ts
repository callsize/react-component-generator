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

  it('시간 초과가 나면 onTimeout을 호출해 업스트림을 끊을 수 있게 한다', async () => {
    async function* source(): AsyncGenerator<string> {
      await sleep(300);
      yield 'a';
    }
    let timedOut = 0;

    await expect(
      collect(
        withIdleTimeout(source(), 50, () => {
          timedOut += 1;
        }),
      ),
    ).rejects.toThrow('응답 시간이 초과되었습니다');

    expect(timedOut).toBe(1);
  });

  it('정상 종료에서는 onTimeout을 호출하지 않는다', async () => {
    async function* source() {
      yield 'a';
    }
    let timedOut = 0;

    await collect(
      withIdleTimeout(source(), 200, () => {
        timedOut += 1;
      }),
    );

    expect(timedOut).toBe(0);
  });

  it('소비자가 중간에 그만두면 원본 iterator의 return을 호출한다', async () => {
    let returned = 0;
    const source: AsyncIterable<string> = {
      [Symbol.asyncIterator]: () => ({
        next: async () => ({ done: false as const, value: 'a' }),
        return: async () => {
          returned += 1;
          return { done: true as const, value: undefined };
        },
      }),
    };

    const consumer = withIdleTimeout(source, 200);
    await consumer.next();
    await consumer.return(undefined);

    expect(returned).toBe(1);
  });

  it('원본이 던진 에러는 그대로 전달한다', async () => {
    async function* source(): AsyncGenerator<string> {
      yield 'a';
      throw new Error('원본 에러');
    }

    await expect(collect(withIdleTimeout(source(), 200))).rejects.toThrow('원본 에러');
  });
});
