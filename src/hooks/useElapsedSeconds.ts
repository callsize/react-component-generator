import { useState, useEffect } from 'react';

/** active인 동안 1초마다 증가하는 경과 시간(초). 비활성이면 0. */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [active]);

  return seconds;
}
