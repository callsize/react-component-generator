// AI 제공자의 텍스트 청크를 클라이언트로 보낼 줄 단위 JSON(NDJSON) 스트림으로 바꾼다.
// 이벤트: { type: 'delta', text } | { type: 'done', code } | { type: 'error', error }
// 클라이언트(`src/hooks/useComponentGenerator.ts`의 StreamEvent)와 수동으로 맞춘다.
// 부수효과 없이 청크 소스를 주입받아 단위 테스트가 가능하다.
import { classifyError } from './errorMessage';

export function createGenerationStream(
  chunks: AsyncIterable<string>,
  finalize: (text: string) => string,
  onCancel?: () => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      let full = '';

      try {
        for await (const text of chunks) {
          if (cancelled) break;
          if (!text) continue;
          full += text;
          send({ type: 'delta', text });
        }

        if (!cancelled) {
          if (!full) {
            send({ type: 'error', error: 'AI가 빈 응답을 반환했습니다.' });
          } else {
            send({ type: 'done', code: finalize(full) });
          }
        }
      } catch (err) {
        // 스트림 도중 에러는 이미 200이 나간 뒤라 상태 코드를 못 바꾸므로, 연결 단계와 같은 안내 문구로 분류한다.
        send({ type: 'error', error: classifyError(err instanceof Error ? err.message : 'Unknown error').message });
      } finally {
        if (!cancelled) controller.close();
      }
    },

    // 클라이언트가 연결을 끊으면 업스트림 읽기도 멈춘다.
    cancel() {
      cancelled = true;
      onCancel?.();
    },
  });
}
