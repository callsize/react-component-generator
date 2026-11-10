# AGENTS.md

## Operational Commands

- 패키지 관리자는 `bun` 고정. npm/yarn/pnpm 사용 금지 (`bun.lock` 존재).
- 개발 서버(API + Vite 동시): `bun run dev`
- API 서버만: `bun run server` (포트 3002)
- 테스트 전체: `bun run test` (vitest). `bun test`는 Bun 내장 러너를 호출하므로 사용 금지.
- 단일 테스트: `bun run test -- server/fallback.test.ts`
- 린트: `bun run lint`
- 타입 체크 + 빌드: `bun run build`
- 작업 완료 전 `bun run lint`, `bun run test`, `bun run build`를 모두 통과시킨다.

## Golden Rules

### Immutable

- API 키를 코드에 하드코딩하지 않는다. 서버는 `process.env.ANTHROPIC_API_KEY`, `process.env.GOOGLE_API_KEY`에서만 읽는다 (`server/index.ts:59-62`).
- `/api/config` 응답에는 키 보유 여부(boolean)만 담는다. 키 값을 응답에 포함하지 않는다 (`server/index.ts:147-157`).
- 프런트엔드에서 AI 제공자 API를 직접 호출하지 않는다. 항상 `/api/generate` 프록시를 거친다 (`src/hooks/useComponentGenerator.ts:23`).
- 사용자가 입력한 API 키는 localStorage의 `rcg:apiKeys` 한 곳에만 저장한다 (`src/App.tsx`, `usePersistentState`). 컴포넌트 목록, 히스토리 등 다른 저장 키에 섞지 않고, 로그나 서버 응답에 출력하지 않는다. 저장은 사용자의 명시적 결정이며 보안 위험은 `src/AGENTS.md` 참고.
- `.env`는 커밋하지 않는다 (`.gitignore`).

### 민감 파일 차단

- 에이전트는 `.env`, `.env.*`, `*credential*`, `*secret*`, `*.pem`, `*.key`, SSH/AWS 설정(`.ssh/`, `.aws/`) 등 민감 파일을 읽거나 수정하지 않는다. `.claude/settings.json`의 `permissions.deny`가 Read/Edit/Write와 Bash/PowerShell 명령을 차단한다.
- 환경 변수 덤프(`printenv`, `env`, `$env:` 조회, `Get-ChildItem env:`)도 금지한다. 키 보유 여부는 `/api/config` 응답(boolean)으로만 확인한다.
- 우회 금지: Bash/PowerShell로 `cat`, `type`, `Get-Content` 등을 써서 차단된 파일을 읽거나, 다른 경로로 복사해서 접근하지 않는다.
- 민감 파일 내용이 필요한 작업은 멈추고 사용자에게 값을 직접 설정해 달라고 요청한다.
- `permissions.deny` 항목을 임의로 제거하거나 완화하지 않는다. 변경은 사용자의 명시적 요청이 있을 때만 한다.

### 하드 제약 (생성 코드 실행 계약)

- 생성된 코드는 `react-live`의 `noInline` 모드로 실행된다 (`src/components/LivePreview.tsx:14`). 코드 끝에 `render(<Component />)` 호출이 없으면 미리보기가 그려지지 않는다.
- 생성 코드에는 `import`와 TypeScript 문법이 있으면 안 된다 (`server/index.ts:11`, `server/index.ts:20`). 시스템 프롬프트(`SYSTEM_PROMPT`)를 수정할 때 이 제약을 지운 채로 두지 않는다.

### 이중 방어 (한쪽만 제거하지 말 것)

- 코드 펜스: 시스템 프롬프트가 펜스 금지를 지시하고(`server/index.ts:16`), `stripCodeFences`가 사후 제거한다 (`server/generator.ts:6`).
- render 호출: 시스템 프롬프트가 `render()` 호출을 요구하고(`server/index.ts:12`), `ensureRenderCall`이 누락 시 주입한다 (`server/generator.ts:20`).

### 비대칭 (제공자별 처리 차이)

- Google 경로에만 `MAX_TOKENS` 절단 검사(`server/index.ts:123`)와 모델 폴백(`server/index.ts:135`, `GOOGLE_MODELS`)이 있다. Anthropic 경로(`callAnthropic`)에는 없다. 제공자 로직을 고칠 때 두 경로를 비교하고, 의도한 차이인지 확인한다.

### 테스트 경계

- 테스트가 있는 곳: `server/generator.ts`, `server/fallback.ts`, `src/components/PromptInput.tsx`.
- `server/index.ts`는 import 시 `Bun.serve`가 실행되는 부수효과 모듈이라 테스트가 없다 (`server/generator.ts:2`의 주석 참고). 서버에 새 로직을 추가할 때는 순수 함수로 별도 파일에 분리하고 그 파일에 테스트를 붙인다.

### 에러 분류 결합

- `server/index.ts:194`, `:201`은 에러 메시지에 `'503'`, `'429'` 문자열이 포함되는지로 HTTP 상태를 결정한다. 제공자 호출 에러 메시지는 `API error: <status>` 형식을 유지한다 (`server/index.ts:85`, `:112`).

### 포트 결합

- API 포트 3002는 `server/index.ts:139`와 `vite.config.ts`의 proxy target 두 곳에 있다. 변경 시 함께 수정한다.

## Project Context

- 프롬프트를 받아 AI가 React 컴포넌트를 생성하고 미리보기/코드를 제공하는 도구.
- Stack: React 19, TypeScript, Vite, Bun(API 서버), react-live, vitest, Testing Library.

## Standards & References

- 설치/실행 방법과 기능 목록은 `README.md` 참고.
- 커밋 메시지: `<type>: <한국어 요약>` (type: feat, fix, refactor, chore). 한 줄 50자 안팎, 마침표 없음. `.claude/skills/commit/SKILL.md` 참고.
- 사용자에게 보이는 문구와 주석은 한국어로 작성한다.

## Maintenance Policy

- 이 문서의 규칙과 코드가 어긋나면 작업을 멈추지 말고, 어긋난 지점을 보고하고 AGENTS.md 업데이트를 제안한다.

## Context Map

- **[프런트엔드 수정 (React/Vite)](./src/AGENTS.md)** — `src/` 아래 컴포넌트, 훅, 스타일, 테스트를 수정할 때.
- **[API 서버 수정 (Bun)](./server/AGENTS.md)** — `server/` 아래 파일을 수정하거나 AI 제공자 호출을 추가할 때.
