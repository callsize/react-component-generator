// 제공자 호출 에러 메시지를 HTTP 상태와 사용자용 문구로 분류한다.
// 에러 메시지에 '503', '429'가 포함되는지로 판단하므로 제공자 호출 에러는 `API error: <status>` 형식을 유지해야 한다.
// 연결 단계(index.ts의 catch)와 스트림 도중(error 이벤트) 양쪽이 같은 분류를 쓴다.

export function classifyError(message: string): { status: number; message: string } {
  if (message.includes('503')) {
    return { status: 503, message: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
  }

  if (message.includes('429')) {
    return { status: 429, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }

  return { status: 500, message };
}
