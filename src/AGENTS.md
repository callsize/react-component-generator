# src/AGENTS.md

## Module Context

Vite로 번들되는 브라우저 프런트엔드. 서버와는 `/api/generate`, `/api/config` HTTP 호출로만 통신하며 `server/` 모듈을 import하지 않는다. 상태 관리는 React state와 `useComponentGenerator` 훅이 전부다.

## Tech Stack & Constraints

- 스타일은 전역 CSS(`App.css`, `index.css`)와 클래스명만 사용한다. CSS Modules, CSS-in-JS, Tailwind를 도입하지 않는다 (`src/App.tsx:6`, 컴포넌트 전반의 `className`).
- 상태 라이브러리(Redux, Zustand 등)와 데이터 페칭 라이브러리를 추가하지 않는다. `fetch`를 훅 안에서 직접 호출한다 (`src/hooks/useComponentGenerator.ts:23`).
- `tsconfig.app.json`의 엄격 옵션을 따른다.
  - `verbatimModuleSyntax`: 타입은 `import type`으로 가져온다 (`tsconfig.app.json:14`, `src/App.tsx:5`).
  - `erasableSyntaxOnly`: `enum`, `namespace`, 생성자 매개변수 프로퍼티를 쓰지 않는다. 유니온 타입을 쓴다 (`tsconfig.app.json:23`, `src/types/index.ts:1`).
  - `noUnusedLocals`, `noUnusedParameters`: 쓰지 않는 변수와 매개변수를 남기지 않는다.

## Implementation Patterns

- 공용 타입은 `src/types/index.ts`에 둔다 (`Provider`, `GeneratedComponent`). 서버의 `Provider` 타입(`server/index.ts:57`)과 값이 같아야 하며 import로 공유하지 않고 양쪽을 수동으로 맞춘다.
- 컴포넌트는 `components/<PascalCase>.tsx`에 named export 한다. `App`만 default export 한다 (`src/main.tsx:4`).
- 컴포넌트 파일은 컴포넌트만 export 한다. 상수와 헬퍼를 export 하면 `react-refresh/only-export-components` 린트에 걸린다 (`eslint.config.js:16`). 상수는 파일 내부에 두거나 별도 파일로 분리한다 (`PROVIDER_CONFIG`, `EXAMPLES`).
- 윈도우 스타일 패널은 `window` 클래스와 `data-title` 속성 조합을 사용한다 (`src/App.tsx:50`, `src/components/ComponentCard.tsx:31`). 변형 클래스는 `block--modifier` 형식이다 (`key-status--ready`, `tab--active`).
- 사용자에게 보이는 문구는 한국어다.

## Testing Strategy

- 실행: `bun run test -- src/components/<Name>.test.tsx`. 환경은 jsdom이고 `src/test/setup.ts`가 자동 로드된다 (`vite.config.ts`).
- `vitest` 전역을 켜지 않았으므로 `describe`, `it`, `expect`, `vi`를 `vitest`에서 명시적으로 import 한다 (`src/components/PromptInput.test.tsx:1`).
- 테스트 파일은 대상 옆에 `<Name>.test.tsx`로 두고, 테스트 이름은 한국어 문장으로 쓴다.
- 쿼리는 접근성 역할과 이름 기준으로 한다 (`getByRole('button', { name: ... })`, `PromptInput.test.tsx:8`). 클래스명으로 찾지 않는다.
- DOM 정리는 `setup.ts`의 `afterEach(cleanup)`이 담당하므로 테스트에서 중복 호출하지 않는다.

## Local Golden Rules

### 보안 경계

- `LiveProvider`에 `scope`를 넘기지 않는다 (`src/components/LivePreview.tsx:14`). AI가 생성한 코드가 페이지 권한으로 실행되므로, `apiKey` 같은 값이나 `fetch` 래퍼를 scope로 주입하면 생성 코드가 접근할 수 있다.
- 사용자가 입력한 `apiKey`는 `App`의 state에만 둔다. 컴포넌트 목록(`GeneratedComponent`)에 키를 저장하지 않고 저장소에도 쓰지 않는다 (`src/App.tsx:14`, `src/types/index.ts:3-8`).
- 제공자를 바꾸면 입력된 키를 비운다. 다른 제공자 엔드포인트로 키가 흘러가는 것을 막는다 (`src/App.tsx:41-44`). 제공자 선택 UI를 고칠 때 이 초기화를 유지한다.
- 서버로 보내는 본문은 키가 있을 때만 `apiKey`를 포함한다 (`src/hooks/useComponentGenerator.ts:26`, `...(apiKey && { apiKey })`).

### 이중 방어

- API 키 검증이 클라이언트(`src/App.tsx:35`, `alert`)와 서버(`server/index.ts:169`) 양쪽에 있다. 클라이언트 검사는 UX용이고 서버 검사가 최종 방어선이다. 한쪽을 지울 때 다른 쪽이 대신하는지 확인한다.

### 재생성과 새로고침 경로

- 재생성은 `onRegenerate`로 `App`의 `handleGenerate`를 다시 거친다 (`src/App.tsx:173`). 이 경로를 우회해 `generate`를 직접 호출하면 키 검증이 빠진다.
- 미리보기 새로고침은 `LivePreview`에 `key={previewKey}`를 바꿔 리마운트하는 방식이다 (`src/components/ComponentCard.tsx:17`, `:70`). 서버 호출 없이 애니메이션을 처음부터 다시 실행하는 용도이므로 `generate`와 섞지 않는다.

### 테스트 경계

- 테스트가 있는 곳은 `PromptInput`뿐이다. `App`, `ComponentCard`, `CodeView`, `LivePreview`, `useComponentGenerator`에는 없다. 키 검증, 제공자 전환 시 키 초기화, 에러 표시처럼 `App`과 훅에 있는 분기를 수정하면 해당 동작의 테스트를 함께 추가한다.
- 네트워크 호출은 테스트에서 실제로 보내지 않고 `fetch`를 `vi.fn`/`vi.stubGlobal`로 대체한다.

### 상태 갱신 패턴

- 훅의 상태 갱신은 함수형 업데이트를 사용한다 (`setComponents((prev) => ...)`, `src/hooks/useComponentGenerator.ts:42`, `:52`, `:56`). 새 컴포넌트는 목록 맨 앞에 추가된다. 순서를 바꾸면 UI의 최신 항목 우선 표시가 깨진다.
