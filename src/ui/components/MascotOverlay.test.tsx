// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MascotOverlay, normalizeAction } from './MascotOverlay';
import { useMascotStore } from '@/store/mascotStore';

describe('MascotOverlay rendering & state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
        removeItem: (k: string) => { delete storage[k]; },
        clear: () => {},
      },
      writable: true,
    });
    useMascotStore.setState({ enabled: true, isDocked: true });
  });

  it('renders nothing when enabled is false', () => {
    useMascotStore.setState({ enabled: false });
    const { container } = render(React.createElement(MascotOverlay));
    expect(container.querySelector('[data-mascot-root]')).toBeNull();
  });

  it('renders mascot root when enabled is true', () => {
    useMascotStore.setState({ enabled: true });
    const { container } = render(React.createElement(MascotOverlay));
    expect(container.querySelector('[data-mascot-root]')).toBeTruthy();
  });

  it('does not contain any grappling hook SVG elements', () => {
    useMascotStore.setState({ enabled: true });
    const { container } = render(React.createElement(MascotOverlay));
    // Old grapple rope rendered a line with stroke #57534e and claw hook path
    expect(container.querySelector('line[stroke="#57534e"]')).toBeNull();
  });

  it('normalizes actions cleanly without grapple aliases', () => {
    expect(normalizeAction('flinch')).toBe('hurt');
    expect(normalizeAction('tossed')).toBe('fall');
    expect(normalizeAction('spin')).toBe('attack');
    expect(normalizeAction('climb')).toBe('climb');
    expect(normalizeAction('idle')).toBe('idle');
  });
});
