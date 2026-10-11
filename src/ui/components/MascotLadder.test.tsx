// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MascotLadder, calculateLadderRungs } from './MascotLadder';

describe('MascotLadder component & utilities', () => {
  it('calculates correct ladder rungs based on height', () => {
    // 120px height with 20px rung spacing
    const rungs = calculateLadderRungs(300, 180, 20);
    expect(rungs.length).toBe(6);
    expect(rungs[0]).toBe(280);
    expect(rungs[rungs.length - 1]).toBe(180);
  });

  it('renders SVG ladder element with proper attributes', () => {
    const { container } = render(
      React.createElement(MascotLadder, {
        x: 100,
        bottomY: 300,
        topY: 150,
        state: 'ready',
        progress: 1,
      })
    );

    const svg = container.querySelector('svg[data-mascot-ladder]');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('data-ladder-state')).toBe('ready');
  });

  it('renders folding deploy state when state is deploying', () => {
    const { container } = render(
      React.createElement(MascotLadder, {
        x: 100,
        bottomY: 300,
        topY: 150,
        state: 'deploying',
        progress: 0.5,
      })
    );

    const svg = container.querySelector('svg[data-mascot-ladder]');
    expect(svg?.getAttribute('data-ladder-state')).toBe('deploying');
  });
});
