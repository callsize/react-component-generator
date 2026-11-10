// Server-Sent Events 응답 본문에서 `data:` 값만 순서대로 꺼내는 순수 함수.
// 청크 경계와 CRLF를 처리하며, event:/주석 줄은 무시한다.

export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const takeData = (event: string): string | null => {
    const lines = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));
    return lines.length > 0 ? lines.join('\n') : null;
  };

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
}
