/**
 * WebLLMLoader — shows model download progress bar.
 * Used during app startup to eagerly load the local AI model.
 */

import { useEffect, useState } from 'react';
import { webLLM } from '@/services/webLLM';

export function useWebLLMLoad() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (webLLM.isLoaded || webLLM.isDisabled) {
      setDone(true);
      return;
    }

    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled) return;
      setProgress(webLLM.loadProgress);
      setStatus(webLLM.loadStatus);
    }, 200);

    webLLM.load().then(() => {
      if (!cancelled) {
        setProgress(100);
        setStatus('Sẵn sàng!');
        setDone(true);
      }
    }).catch(() => {
      if (!cancelled) setDone(true); // fail silently, fallback to Gemini
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { progress, status, done };
}

export function WebLLMProgressBar({ progress, status }: { progress: number; status: string }) {
  return (
    <div className="w-full max-w-xs mx-auto mt-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{progress < 100 ? 'Đang tải AI cục bộ...' : 'AI sẵn sàng'}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-fg rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {status && (
        <p className="text-[11px] text-muted-foreground truncate">{status}</p>
      )}
    </div>
  );
}
