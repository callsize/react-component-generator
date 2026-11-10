import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingCard } from './StreamingCard';

describe('StreamingCard', () => {
  it('생성 중인 코드를 그대로 보여준다', () => {
    render(<StreamingCard code="const A = () => null;" elapsedSeconds={0} />);

    expect(screen.getByText('const A = () => null;')).toBeInTheDocument();
  });

  it('코드가 아직 없으면 응답을 기다리는 안내를 보여준다', () => {
    render(<StreamingCard code="" elapsedSeconds={0} />);

    expect(screen.getByText('AI 응답을 기다리고 있습니다...')).toBeInTheDocument();
  });

  it('경과 시간을 보여준다', () => {
    render(<StreamingCard code="" elapsedSeconds={7} />);

    expect(screen.getByText(/7초/)).toBeInTheDocument();
  });

  it('코드 탭이 선택되어 있고 미리보기 탭은 비활성이다', () => {
    render(<StreamingCard code="x" elapsedSeconds={0} />);

    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '미리보기' })).toBeDisabled();
  });
});

describe('StreamingCard 자동 스크롤', () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');

  afterEach(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original);
  });

  it('코드가 늘어나면 코드 블록을 맨 아래로 스크롤한다', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 500,
    });

    const { container, rerender } = render(<StreamingCard code="a" elapsedSeconds={0} />);
    rerender(<StreamingCard code="a\nb" elapsedSeconds={1} />);

    expect(container.querySelector('pre')?.scrollTop).toBe(500);
  });
});
