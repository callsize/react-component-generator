// AI 제공자의 텍스트 청크를 클라이언트로 보낼 줄 단위 JSON(NDJSON) 스트림으로 바꾼다.
// 이벤트: { type: 'delta', text } | { type: 'done', code } | { type: 'error', error }
// 클라이언트(`src/hooks/useComponentGenerator.ts`의 StreamEvent)와 수동으로 맞춘다.
// 부수효과 없이 청크 소스를 주입받아 단위 테스트가 가능하다.

export function createGenerationStream(
  chunks: AsyncIterable<string>,
  finalize: (text: string) => string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let full = '';

      try {
        for await (const text of chunks) {
          if (!text) continue;
          full += text;
          send({ type: 'delta', text });
        }

        if (!full) {
          send({ type: 'error', error: 'AI가 빈 응답을 반환했습니다.' });
        } else {
          send({ type: 'done', code: finalize(full) });
        }
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
      } finally {
        controller.close();
      }
    },
  });
}
