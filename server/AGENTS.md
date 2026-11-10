# server/AGENTS.md

## Module Context

Bun 런타임에서 실행되는 AI API 프록시. Vite 개발 서버가 `/api`를 이 서버(3002)로 프록시한다. 프런트엔드 코드(`src/`)와 별개의 런타임이므로 브라우저 API나 `src/` 모듈에 의존하지 않는다.

## Tech Stack & Constraints

- `Bun.serve`와 전역 `fetch`만 사용한다. axios, express 등 HTTP 라이브러리를 추가하지 않는다 (`server/index.ts:98-109`, `:138`).
- 환경변수는 `process.env`로 읽는다 (`server/index.ts:59-62`).

## Implementation Patterns

- 제공자 호출은 `callXxx(prompt, apiKey): Promise<string>` 시그니처로 작성하고, 응답 텍스트를 `stripCodeFences` -> `ensureRenderCall` 순서로 정규화한다 (`server/index.ts:188`).
- 모델 폴백이 필요한 호출은 `withModelFallback(models, attempt)`로 감싼다 (`server/index.ts:135`). 모델 우선순위는 `GOOGLE_MODELS` 배열 순서가 곧 시도 순서다.
- 응답은 항상 `CORS_HEADERS`를 포함한다. 새 `Response.json(...)` 분기를 추가할 때 헤더를 빠뜨리지 않는다 (`server/index.ts:51`, 모든 응답 분기).

## Testing Strategy

- 테스트 파일은 대상 파일 옆에 `<name>.test.ts`로 둔다 (`server/fallback.test.ts`, `server/generator.test.ts`).
- 실행: `bun run test -- server/<name>.test.ts`. 외부 API는 호출하지 않고 `vi.fn`으로 대체한다 (`server/fallback.test.ts:5`).
- 새 로직은 `index.ts`에 직접 넣지 말고 부수효과 없는 모듈로 분리한 뒤 테스트한다.

## Local Golden Rules

- Google API 키는 요청 URL 쿼리(`?key=`)로 전달된다 (`server/index.ts:99`). 이 URL을 로그나 에러 메시지에 출력하지 않는다. 현재 에러는 상태 코드만 담는다 (`server/index.ts:112`).
- 에러 메시지에 `503`/`429`를 포함해야 상태 코드가 매핑된다 (`server/index.ts:194-206`). 메시지 형식을 바꾸면 매핑이 조용히 깨진다.
- `callAnthropic`의 모델 ID는 고정 문자열이다 (`server/index.ts:77`). 모델을 바꿀 때 `max_tokens`(4096)도 함께 검토한다. Google은 8192이며 절단 시 에러로 처리한다 (`server/index.ts:107`, `:123`).
- 폴백은 모든 에러에 대해 다음 모델을 시도하고 마지막 에러만 던진다 (`server/fallback.ts:13-19`). 인증 오류(401/403)도 재시도되므로, 폴백 대상 에러를 제한하려면 `fallback.test.ts`를 함께 수정한다.
