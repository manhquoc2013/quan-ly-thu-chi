/**
 * WebLLMLoader — shows model download progress bar.
 * Eager-loads only when AI cục bộ is enabled in Settings.
 */

import { useEffect, useState } from 'react';
import { webLLM } from '@/services/webLLM';
import { useAuthStore } from '@/store/authStore';

export function useWebLLMLoad(opts?: { enabled?: boolean }) {
  const allowed = opts?.enabled !== false;
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [hydrated, setHydrated] = useState(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    useAuthStore.persist?.hasHydrated?.() ?? false,
  );
  const enableWebLLM = useAuthStore((s) => s.enableWebLLM);

  useEffect(() => {
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!allowed || !hydrated) {
      if (!allowed) setDone(true);
      return;
    }

    if (!enableWebLLM || webLLM.isDisabled) {
      setDone(true);
      setProgress(0);
      setStatus('');
      return;
    }

    if (webLLM.isLoaded) {
      setDone(true);
      setProgress(100);
      return;
    }

    setDone(false);
    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled) return;
      setProgress(webLLM.loadProgress);
      setStatus(webLLM.loadStatus);
    }, 200);

    webLLM
      .load()
      .then((ok) => {
        if (cancelled) return;
        if (ok) {
          setProgress(100);
          setStatus('Sẵn sàng!');
        }
        setDone(true);
      })
      .catch(() => {
        if (!cancelled) setDone(true);
      });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [allowed, hydrated, enableWebLLM]);

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
