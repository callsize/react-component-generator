// 응답이 오지 않는 외부 API 때문에 요청이 무한 대기하지 않도록 시간 제한을 건다.
// 부수효과 없이 fetchFn을 주입받아 단위 테스트가 가능하다.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`API 응답 시간이 초과되었습니다 (${timeoutMs / 1000}초).`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
