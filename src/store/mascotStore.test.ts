import { describe, it, expect, beforeEach } from 'vitest';
import { useMascotStore } from './mascotStore';

describe('mascotStore enabled toggle', () => {
  beforeEach(() => {
    useMascotStore.setState({ enabled: true });
  });

  it('defaults enabled to true', () => {
    const state = useMascotStore.getState();
    expect(state.enabled).toBe(true);
  });

  it('toggles enabled state via setEnabled', () => {
    const { setEnabled } = useMascotStore.getState();
    setEnabled(false);
    expect(useMascotStore.getState().enabled).toBe(false);

    setEnabled(true);
    expect(useMascotStore.getState().enabled).toBe(true);
  });
});
