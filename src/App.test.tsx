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
