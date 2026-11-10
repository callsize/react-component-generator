// Server-Sent Events 응답 본문에서 `data:` 값만 순서대로 꺼내는 순수 함수.
// 청크 경계와 CRLF를 처리하며, event:/주석 줄은 무시한다.
// signal이 abort되면 본문을 취소해 대기 중인 읽기를 끝낸다(업스트림 연결 해제).

export async function* readSseData(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });

  const takeData = (event: string): string | null => {
    const lines = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));
    return lines.length > 0 ? lines.join('\n') : null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const data = takeData(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (data !== null) yield data;
        boundary = buffer.indexOf('\n\n');
      }
    }

    const rest = takeData(buffer + decoder.decode());
    if (rest !== null) yield rest;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
