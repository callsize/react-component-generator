// 스트림 본문 구간의 무응답 대기를 막는다. `fetchWithTimeout`은 응답 헤더가 올 때까지만 시간 제한을 걸기 때문에,
// 헤더 이후 청크가 끊기면 무한 대기할 수 있다. 청크 사이 간격이 timeoutMs를 넘으면 에러를 던진다.
// onTimeout은 에러를 던지기 직전에 호출되며, 호출자가 업스트림 연결을 끊는 데 쓴다.
export async function* withIdleTimeout(
  source: AsyncIterable<string>,
  timeoutMs: number,
  onTimeout?: () => void,
): AsyncGenerator<string> {
  const iterator = source[Symbol.asyncIterator]();
  let finished = false;

  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error(`API 응답 시간이 초과되었습니다 (${timeoutMs / 1000}초).`));
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([iterator.next(), timeout]);
        if (result.done) {
          finished = true;
          return;
        }
        yield result.value;
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    // 타임아웃이나 소비자 중단으로 끝나면 원본 iterator도 정리한다. 대기 중인 next()에 막힐 수 있어 기다리지 않는다.
    if (!finished) void Promise.resolve(iterator.return?.()).catch(() => {});
  }
}
