import { useEffect, useRef } from 'react';

interface StreamingCardProps {
  code: string;
  elapsedSeconds: number;
}

export function StreamingCard({ code, elapsedSeconds }: StreamingCardProps) {
  const codeBlockRef = useRef<HTMLPreElement>(null);

  // 코드가 늘어나는 동안 최신 줄이 보이도록 맨 아래로 따라간다.
  useEffect(() => {
    const el = codeBlockRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [code]);

  return (
    <div className="component-card streaming-card window" data-title="GENERATING.TSX">
      <div className="card-header">
        <div className="card-title-group">
          <span>컴포넌트를 생성하고 있습니다... {elapsedSeconds}초</span>
        </div>
      </div>
      <div className="card-tabs" role="tablist">
        <button className="tab" role="tab" aria-selected="false" disabled>
          미리보기
        </button>
        <button className="tab tab--active" role="tab" aria-selected="true">
          코드
        </button>
      </div>
      <div className="card-content">
        <div className="code-panel">
          {code ? (
            <pre className="code-block" ref={codeBlockRef}>
              <code>{code}</code>
            </pre>
          ) : (
            <div className="streaming-wait">
              <div className="loading-pulse" />
              <p>AI 응답을 기다리고 있습니다...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
