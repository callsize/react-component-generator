---
name: create-pr
description: |
  현재 브랜치의 커밋과 diff를 분석해 한국어 또는 영어 템플릿으로 PR 본문을 작성하고 GitHub Pull Request를 생성한다.
  "PR 만들어줘", "PR 생성", "풀리퀘스트 올려줘", "create pr", "open a pull request", "/create-pr" 같은 요청에 활성화한다.
  프로젝트가 한국어를 쓰면 한국어 템플릿, 아니면 영어 템플릿을 사용한다. `--lang`으로 직접 지정할 수 있다.
argument-hint: "[--lang ko|en] [--base <branch>] [--draft]"
context: fork
allowed-tools: Read Glob Grep Bash
---

# create-pr: 변경 분석 -> 템플릿 기반 PR 생성

PR 본문 템플릿은 언어별로 분리되어 있다. 먼저 언어를 정한 뒤 해당 파일 하나만 Read로 읽고, 템플릿 구조를 그대로 따른다.

- 한국어: `references/pr-template.ko.md`
- 영어: `references/pr-template.en.md`

## 인자

- `--lang ko|en`: 템플릿 언어. 지정하면 이 값이 최우선이다.

### 언어 결정 규칙

`--lang`이 없으면 **프로젝트가 한국어를 쓰는지**로 정한다.

- 한국어 프로젝트이면 `ko`, 아니면 `en`.
- 판단 근거 (하나라도 해당하면 한국어 프로젝트):
  - `AGENTS.md`/`CLAUDE.md`에 한국어로 쓴 규칙이 있다.
  - `README.md`가 한국어로 쓰여 있다.
  - 최근 커밋 메시지(`git log --oneline -10`)가 한국어다.
- 근거가 서로 엇갈리면 최근 커밋 메시지의 언어를 따른다.
- 요청 문장의 언어는 판단 근거로 쓰지 않는다. 사용자가 영어로 요청해도 한국어 프로젝트면 `ko`이고, 바꾸려면 `--lang en`을 쓴다.
- `--base <branch>`: 대상 브랜치. 지정이 없으면 저장소 기본 브랜치.
- `--draft`: 초안 PR로 생성.

## 절차

### 1. 사전 점검

```bash
git branch --show-current
git status --short
gh auth status
gh repo view --json defaultBranchRef --jq .defaultBranchRef.name
```

- git 저장소가 아니거나 `gh` 인증이 안 되어 있으면 그 사실만 알리고 종료한다.
- base 브랜치는 `--base` 값, 없으면 위 `defaultBranchRef`를 사용한다.
- 현재 브랜치가 base 브랜치와 같으면 PR을 만들 수 없다. 브랜치를 새로 만들어야 한다고 알리고 종료한다. 브랜치를 임의로 만들지 않는다.
- 커밋되지 않은 변경이 있으면 PR에 포함되지 않는다는 점을 최종 보고에 알린다. 커밋은 하지 않는다 (`/commit` 스킬의 역할).
- 같은 브랜치의 열린 PR이 있는지 확인한다.

```bash
gh pr list --head "$(git branch --show-current)" --state open --json number,url
```

이미 있으면 새로 만들지 말고 해당 URL만 알리고 종료한다.

### 2. 변경 분석

```bash
git fetch origin <base>
git log origin/<base>..HEAD --oneline
git diff origin/<base>...HEAD --stat
git diff origin/<base>...HEAD
```

- base 대비 앞선 커밋이 없으면 알리고 종료한다.
- 커밋 메시지는 `<type>: <요약>` 컨벤션(`AGENTS.md` 참고)이다. 커밋 type들을 참고해 PR 제목의 type을 정한다.
- diff가 크면 `--stat`으로 범위를 파악한 뒤 핵심 파일만 Read로 확인한다.
- 변경된 테스트 파일이 있으면 본문의 테스트 항목에 반영한다. 실제로 실행하지 않은 검증을 "통과"로 적지 않는다. 테스트 결과를 적으려면 `bun run test`를 실행해서 확인한다.
- `.env`, 키, 토큰이 diff에 보이면 PR 생성을 중단하고 사용자에게 경고한다.

### 3. 제목과 본문 작성

- 제목: `<type>: <한국어 또는 영어 요약>` 형식, 70자 이내, 마침표 없음. 영어 템플릿이면 영어로 쓴다.
- 본문: 선택한 언어의 템플릿 파일(`pr-template.ko.md` 또는 `pr-template.en.md`)을 채운다. 비어 있는 항목은 지우지 말고 `해당 없음` / `N/A`로 쓴다.
- 코드 식별자, 파일명, 명령어는 원문 그대로 둔다.
- 시스템 지시에 PR attribution 줄이 있으면 본문 맨 끝에 덧붙인다.
- 본문은 임시 파일에 쓰고 `--body-file`로 전달한다. 쉘 이스케이프 문제를 피하기 위해 `--body` 인라인 문자열은 쓰지 않는다.

### 4. 푸시와 PR 생성

현재 브랜치가 원격에 없거나 뒤처져 있으면 푸시한다. PR 생성 요청이 이 푸시를 포함한다.

```bash
git push -u origin HEAD
gh pr create --base <base> --title "<제목>" --body-file <임시파일> [--draft]
```

- PR URL을 사용자에게 보여준다.
- 임시 파일은 생성 후 삭제한다.

## 최종 보고

- PR URL, 제목, base <- head 브랜치, 선택한 언어를 한국어로 간단히 보고한다.
- 미커밋 변경이나 실행하지 못한 검증이 있으면 함께 알린다.

## 금지 사항

- `git push --force`, `--force-with-lease`, `--no-verify`는 사용자가 명시적으로 요청하지 않는 한 쓰지 않는다.
- base 브랜치에 직접 푸시하지 않는다.
- 커밋을 만들거나 amend 하지 않는다.
- 이미 열린 PR이 있는 브랜치에 중복 PR을 만들지 않는다.
- 근거 없는 내용(실행하지 않은 테스트 결과, diff에 없는 변경)을 본문에 쓰지 않는다.
