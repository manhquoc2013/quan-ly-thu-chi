import { useEffect, useCallback } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: KeyHandler;
}

export function useKeyboard(bindings: KeyBinding[]): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const binding of bindings) {
        if (
          e.key === binding.key &&
          !!e.ctrlKey === !!binding.ctrl &&
          !!e.shiftKey === !!binding.shift &&
          !!e.altKey === !!binding.alt
        ) {
          e.preventDefault();
          binding.handler(e);
          return;
        }
      }
    },
    [bindings],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
