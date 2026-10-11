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

  it('renders upward packing retraction into backpack when reaching top', () => {
    const { container } = render(
      React.createElement(MascotLadder, {
        x: 100,
        bottomY: 250,
        topY: 150,
        state: 'packing',
        progress: 0.5,
        packDirection: 'to-top',
      })
    );

    const svg = container.querySelector('svg[data-mascot-ladder]');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('data-ladder-state')).toBe('packing');
    expect(svg?.getAttribute('data-pack-direction')).toBe('to-top');

    // With 100px fullHeight and progress 0.5, currentHeight is ~50px
    // For to-top packing, top remains anchored at topY (150), bottom is 150 + 50 = 200 (retracted up from 250)
    const lines = container.querySelectorAll('line[stroke="url(#ladder-wood-grad)"]');
    expect(lines.length).toBe(2);
    expect(lines[0]?.getAttribute('y2')).toBe('150');
    expect(Number(lines[0]?.getAttribute('y1'))).toBeLessThanOrEqual(205);
  });
});
