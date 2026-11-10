// 스트림 본문 구간의 무응답 대기를 막는다. `fetchWithTimeout`은 응답 헤더가 올 때까지만 시간 제한을 걸기 때문에,
// 헤더 이후 청크가 끊기면 무한 대기할 수 있다. 청크 사이 간격이 timeoutMs를 넘으면 에러를 던진다.
export async function* withIdleTimeout(
  source: AsyncIterable<string>,
  timeoutMs: number,
): AsyncGenerator<string> {
  const iterator = source[Symbol.asyncIterator]();

  while (true) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`API 응답 시간이 초과되었습니다 (${timeoutMs / 1000}초).`)),
        timeoutMs,
      );
    });

    try {
      const result = await Promise.race([iterator.next(), timeout]);
      if (result.done) return;
      yield result.value;
    } finally {
      clearTimeout(timer);
    }
  }
}
