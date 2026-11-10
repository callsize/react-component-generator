import { stripCodeFences, ensureRenderCall } from './generator';
import { withModelFallback } from './fallback';
import { validatePromptLength } from './validate';
import { fetchWithTimeout } from './fetchWithTimeout';
import { readSseData } from './sse';
import { extractAnthropicText, extractGoogleChunk } from './streamText';
import { createGenerationStream } from './generationStream';
import { withIdleTimeout } from './idleTimeout';
import { classifyError } from './errorMessage';

// 외부 AI API 한 번의 호출에 허용하는 최대 시간. 폴백 시 모델마다 따로 적용된다.
const API_TIMEOUT_MS = 30_000;

// 우선순위 순서. 앞 모델이 실패하면 다음 모델로 폴백한다.
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    API_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  return data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function callGoogleModel(prompt: string, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    },
    API_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: { parts: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
  }

  return (
    candidate?.content?.parts
      ?.map((part) => part.text)
      ?.join('') ?? ''
  );
}

async function callGoogle(prompt: string, apiKey: string): Promise<string> {
  return withModelFallback(GOOGLE_MODELS, (model) => callGoogleModel(prompt, apiKey, model));
}

// --- 스트리밍 경로 ---
// 연결(open*Stream)에서 상태 코드를 검사해 에러 메시지 형식(`API error: <status>`)을 유지하고,
// 본문 읽기(*Chunks)는 스트림 도중 에러를 error 이벤트로 전달한다.

async function openAnthropicStream(prompt: string, apiKey: string): Promise<Response> {
  const response = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    API_TIMEOUT_MS,
  );

  if (!response.ok || !response.body) {
    throw new Error(`Claude API error: ${response.status}`);
  }
  return response;
}

async function* anthropicChunks(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  for await (const data of readSseData(response.body!, signal)) {
    yield extractAnthropicText(data);
  }
}

async function openGoogleStream(prompt: string, apiKey: string, model: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    },
    API_TIMEOUT_MS,
  );

  if (!response.ok || !response.body) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  return response;
}

async function* googleChunks(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  for await (const data of readSseData(response.body!, signal)) {
    const { text, truncated } = extractGoogleChunk(data);
    if (text) yield text;
    if (truncated) {
      throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
    }
  }
}

// 모델 폴백은 연결 단계(첫 응답 헤더)까지만 적용된다. 스트림이 시작된 뒤의 실패는 폴백하지 않는다.
async function streamGoogle(
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<string>> {
  const response = await withModelFallback(GOOGLE_MODELS, (model) =>
    openGoogleStream(prompt, apiKey, model),
  );
  return googleChunks(response, signal);
}

async function streamAnthropic(
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<string>> {
  return anthropicChunks(await openAnthropicStream(prompt, apiKey), signal);
}

const STREAM_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-cache',
};

const server = Bun.serve({
  port: 3002,
  // 모델이 첫 토큰을 내기까지 기본 유휴 제한(10초)보다 오래 걸릴 수 있다.
  idleTimeout: 60,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic', stream = false } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
          stream?: boolean;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        const validation = validatePromptLength(prompt);
        if (!validation.ok) {
          return Response.json(
            { error: validation.error },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (stream) {
          // 클라이언트 연결 끊김이나 유휴 타임아웃 때 제공자 연결(본문 reader)을 취소한다.
          const upstream = new AbortController();
          const abortUpstream = () => upstream.abort();

          const chunks =
            provider === 'google'
              ? await streamGoogle(prompt, resolvedKey, upstream.signal)
              : await streamAnthropic(prompt, resolvedKey, upstream.signal);

          return new Response(
            createGenerationStream(
              withIdleTimeout(chunks, API_TIMEOUT_MS, abortUpstream),
              (text) => ensureRenderCall(stripCodeFences(text)),
              abortUpstream,
            ),
            { headers: STREAM_HEADERS },
          );
        }

        const text =
          provider === 'google'
            ? await callGoogle(prompt, resolvedKey)
            : await callAnthropic(prompt, resolvedKey);

        const code = ensureRenderCall(stripCodeFences(text));

        return Response.json({ code }, { headers: CORS_HEADERS });
      } catch (err) {
        const { status, message } = classifyError(
          err instanceof Error ? err.message : 'Unknown error',
        );

        return Response.json({ error: message }, { status, headers: CORS_HEADERS });
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
