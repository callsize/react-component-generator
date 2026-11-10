// 요청 입력을 검증하는 순수 함수들. 부수효과가 없어 단위 테스트가 가능하다.

export const MAX_PROMPT_LENGTH = 500;

export type PromptValidation = { ok: true } | { ok: false; error: string };

/** 프롬프트가 최대 길이(500자)를 넘으면 거부한다. */
export function validatePromptLength(prompt: string): PromptValidation {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이하로 입력해주세요.` };
  }
  return { ok: true };
}
