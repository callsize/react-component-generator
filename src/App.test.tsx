import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ envKeys: { anthropic: false, google: false } }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App 스트리밍 생성', () => {
  const encoder = new TextEncoder();
  const line = (event: unknown) => encoder.encode(`${JSON.stringify(event)}\n`);

  function stubStreamingFetch() {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/config'
          ? new Response(JSON.stringify({ envKeys: { anthropic: false, google: true } }))
          : new Response(body),
      ),
    );
    return { send: (event: unknown) => controller.enqueue(line(event)), close: () => controller.close() };
  }

  async function submitPrompt() {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByPlaceholderText(/고객 목록/);
    await user.type(screen.getByPlaceholderText(/고객 목록/), '버튼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
  }

  it('생성 중에는 "생성된 컴포넌트" 섹션에서 코드 탭으로 실시간 코드를 보여준다', async () => {
    const stream = stubStreamingFetch();
    await submitPrompt();

    expect(await screen.findByRole('heading', { name: '생성된 컴포넌트' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');

    stream.send({ type: 'delta', text: 'const Live = () => null;' });

    expect(await screen.findByText('const Live = () => null;')).toBeInTheDocument();
  });

  it('생성이 끝나면 미리보기 탭이 선택된 컴포넌트 카드로 바뀐다', async () => {
    const stream = stubStreamingFetch();
    await submitPrompt();
    stream.send({ type: 'delta', text: 'const Live = () => null;' });
    await screen.findByText('const Live = () => null;');

    stream.send({ type: 'done', code: 'const Live = () => <p>완성</p>;\nrender(<Live />);' });
    stream.close();

    const previewTab = await screen.findByRole('button', { name: '미리보기' });
    expect(previewTab).toHaveClass('tab--active');
    expect(screen.queryByRole('tab', { name: '코드' })).not.toBeInTheDocument();
  });
});

describe('App 상태 저장', () => {
  it('저장된 Provider를 복원한다', () => {
    localStorage.setItem('rcg:provider', JSON.stringify('anthropic'));

    render(<App />);

    expect(screen.getByLabelText('Provider')).toHaveValue('anthropic');
  });

  it('저장된 Provider가 없으면 google이 기본값이다', () => {
    render(<App />);
    expect(screen.getByLabelText('Provider')).toHaveValue('google');
  });

  it('저장된 API 키를 복원한다', () => {
    localStorage.setItem('rcg:apiKeys', JSON.stringify({ anthropic: '', google: 'AIza-saved' }));

    render(<App />);

    expect(screen.getByLabelText('API Key')).toHaveValue('AIza-saved');
  });

  it('Provider를 바꾸면 선택을 localStorage에 저장한다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');

    expect(JSON.parse(localStorage.getItem('rcg:provider') ?? 'null')).toBe('anthropic');
  });

  it('API 키를 입력하면 현재 Provider의 키로 localStorage에 저장한다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('API Key'), 'AIza-new');

    expect(JSON.parse(localStorage.getItem('rcg:apiKeys') ?? 'null')).toEqual({
      anthropic: '',
      google: 'AIza-new',
    });
  });

  it('Provider를 바꾸면 해당 Provider의 키만 보이고 다른 키는 유지된다', async () => {
    localStorage.setItem('rcg:apiKeys', JSON.stringify({ anthropic: 'sk-ant-saved', google: 'AIza-saved' }));
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');

    expect(screen.getByLabelText('API Key')).toHaveValue('sk-ant-saved');
    expect(JSON.parse(localStorage.getItem('rcg:apiKeys') ?? 'null').google).toBe('AIza-saved');
  });

  it('저장된 프롬프트 히스토리를 입력 영역에 보여준다', () => {
    localStorage.setItem('rcg:promptHistory', JSON.stringify(['예전 프롬프트']));

    render(<App />);

    expect(screen.getByRole('button', { name: '예전 프롬프트' })).toBeInTheDocument();
  });

  it('저장된 컴포넌트 목록을 복원해 보여준다', () => {
    localStorage.setItem(
      'rcg:components',
      JSON.stringify([
        { id: 'abc123', prompt: '복원된 컴포넌트', code: 'render(<div />)', createdAt: '2026-01-01T00:00:00.000Z' },
      ]),
    );

    render(<App />);

    expect(screen.getByText('복원된 컴포넌트')).toBeInTheDocument();
  });
});
