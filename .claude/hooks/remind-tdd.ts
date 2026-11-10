// PreToolUse 훅: 코드 작성/수정 직전에 TDD 규칙(.claude/rules/tdd.md)을 상기시킨다.
// stdout의 additionalContext가 Claude의 컨텍스트에 주입된다 (차단하지 않음).

const reminder = `[TDD 리마인더 — .claude/rules/tdd.md는 Rigid 규칙이다]
코드를 쓰거나 고치기 전에 확인하라.
1. 이 변경이 TDD 필수 대상인가? (비즈니스 로직, API, 유틸, 버그 수정, 분기/상태가 있는 UI) 모호하면 적용한다.
2. 필수 대상이면 **실패하는 테스트를 먼저** 쓰고, 실행해서 "기능 미구현"으로 실패하는 것을 확인했는가? (RED)
3. 테스트보다 프로덕션 코드를 먼저 썼다면 그 코드를 삭제하고 RED부터 다시 시작한다. 주석 처리·보관·참고용 복사도 금지.
4. GREEN은 테스트를 통과시키는 최소 코드만. 신규+기존 테스트 전체를 실행해 확인한다.
5. 버그 수정은 버그를 재현하는 실패 테스트가 먼저다.
타입 정의, 설정 파일, 순수 UI(마크업/CSS), SQL만 TDD 예외다.`;

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: reminder,
    },
  }),
);
