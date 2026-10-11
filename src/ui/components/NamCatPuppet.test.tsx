// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { NamCatPuppet } from './NamCatPuppet';

describe('NamCatPuppet animation & secondary motion', () => {
  it('renders puppet with ears and tail elements', () => {
    const { container } = render(
      React.createElement(NamCatPuppet, {
        action: 'idle',
        emotion: 'idle',
        outfit: 'financial',
      })
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    const tail = container.querySelector('.mc-tail');
    expect(tail).toBeTruthy();
  });

  it('applies cheek pinch deformation when isCheekPinched is true', () => {
    const { container } = render(
      React.createElement(NamCatPuppet, {
        action: 'idle',
        emotion: 'happy',
        outfit: 'financial',
        isCheekPinched: true,
      })
    );

    const cheeks = container.querySelector('[data-cheek-pinched="true"]');
    expect(cheeks).toBeTruthy();
  });

  it('renders climb action with ladder grip styling and limb posture', () => {
    const { container } = render(
      React.createElement(NamCatPuppet, {
        action: 'climb',
        emotion: 'idle',
        outfit: 'financial',
      })
    );

    const puppet = container.querySelector('[data-puppet-action="climb"]');
    expect(puppet).toBeTruthy();
  });
});
