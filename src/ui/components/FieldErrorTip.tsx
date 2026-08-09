/**
 * Timed inline field error — shared across Auth, FormField, dialogs.
 * Shows briefly then hides so stacked errors don't clutter the form.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const ERROR_TIP_MS = 4200;

export function FieldErrorTip({
  message,
  showKey = 0,
  id,
}: {
  message?: string;
  /** Bump to re-show the same message (e.g. on re-submit). */
  showKey?: number;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message || showKey < 0) {
      setVisible(false);
      return;
    }
    // showKey 0 + message still shows once (FormField auto-bump)
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), ERROR_TIP_MS);
    return () => clearTimeout(t);
  }, [message, showKey]);

  if (!message || !visible) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1 text-[11px] font-medium text-danger-fg leading-snug animate-in fade-in-0 slide-in-from-top-1 duration-200"
    >
      {message}
    </p>
  );
}

/** Tip keys that re-trigger FieldErrorTip when the same error is set again. */
export function useFieldErrorTips<K extends string>() {
  const [tipKeys, setTipKeys] = useState<Partial<Record<K, number>>>({});

  const bumpTips = useCallback((keys: K[]) => {
    if (keys.length === 0) return;
    setTipKeys((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = (next[k] ?? 0) + 1;
      return next;
    });
  }, []);

  const resetTips = useCallback(() => setTipKeys({}), []);

  return { tipKeys, bumpTips, resetTips, setTipKeys };
}

/** Auto-bump showKey whenever `error` becomes non-empty or changes text. */
export function useAutoErrorTipKey(error?: string): number {
  const [tipKey, setTipKey] = useState(0);
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error !== prev.current) {
      setTipKey((k) => k + 1);
    }
    if (!error) {
      prev.current = undefined;
    } else {
      prev.current = error;
    }
  }, [error]);
  return tipKey;
}
