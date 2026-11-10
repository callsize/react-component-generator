// 제공자별 스트리밍 청크(JSON 문자열)에서 텍스트 조각을 꺼내는 순수 함수들.
// 스트림 도중 제공자가 보낸 에러는 던져서, 잘린 코드가 정상 완료로 처리되지 않게 한다.

/** Anthropic: content_block_delta 이벤트의 text_delta 텍스트. 그 외 이벤트는 빈 문자열. error 이벤트는 던진다. */
export function extractAnthropicText(payload: string): string {
  const event = JSON.parse(payload) as {
    type?: string;
    delta?: { type?: string; text?: string };
    error?: { type?: string };
  };

  if (event.type === 'error') {
    throw new Error(`Claude API error: ${event.error?.type ?? 'unknown'}`);
  }

  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }
  return '';
}

/** Google: candidates[0]의 텍스트와 MAX_TOKENS 절단 여부. error 페이로드와 비정상 종료 사유는 던진다. */
export function extractGoogleChunk(payload: string): { text: string; truncated: boolean } {
  const chunk = JSON.parse(payload) as {
    error?: { code?: number; status?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  if (chunk.error) {
    throw new Error(`Gemini API error: ${chunk.error.code ?? chunk.error.status ?? 'unknown'}`);
  }

  const candidate = chunk.candidates?.[0];
  const reason = candidate?.finishReason;

  if (reason && reason !== 'STOP' && reason !== 'MAX_TOKENS') {
    throw new Error(`생성이 중단되었습니다 (${reason}). 다른 표현으로 다시 요청해주세요.`);
  }

  return {
    text: candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    truncated: reason === 'MAX_TOKENS',
  };
}
