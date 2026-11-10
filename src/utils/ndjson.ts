// 줄 단위 JSON(NDJSON) 스트림을 파싱해 객체를 순서대로 내보낸다.
// 청크 경계에서 잘린 줄과 멀티바이트 문자를 처리한다.

export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line);
      newline = buffer.indexOf('\n');
    }
  }

  const rest = (buffer + decoder.decode()).trim();
  if (rest) yield JSON.parse(rest);
}
