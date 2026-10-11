/**
 * MascotLadder — SVG folding ladder deployed from Mèo Nấm's backpack.
 * Provides a tactile, animated climbing apparatus between platforms.
 */
import React from 'react';

export type LadderState = 'deploying' | 'ready' | 'packing';

export interface MascotLadderProps {
  x: number;
  bottomY: number;
  topY: number;
  state: LadderState;
  progress?: number; // 0 to 1
  width?: number;
}

export function calculateLadderRungs(bottomY: number, topY: number, spacing = 22): number[] {
  const height = bottomY - topY;
  if (height <= 0) return [];
  const count = Math.max(1, Math.round(height / spacing));
  const step = height / count;
  const rungs: number[] = [];
  for (let i = 1; i <= count; i++) {
    rungs.push(bottomY - i * step);
  }
  return rungs;
}

export const MascotLadder: React.FC<MascotLadderProps> = ({
  x,
  bottomY,
  topY,
  state,
  progress = 1,
  width = 24,
}) => {
  const fullHeight = Math.max(16, bottomY - topY);
  
  // Calculate unfold height based on progress for deploying and packing
  let currentHeight = fullHeight;
  let opacity = 1;

  if (state === 'deploying') {
    currentHeight = fullHeight * Math.min(1, Math.max(0.1, progress));
    opacity = Math.min(1, progress * 1.5);
  } else if (state === 'packing') {
    currentHeight = fullHeight * Math.max(0.1, 1 - progress);
    opacity = Math.max(0, 1 - progress);
  }

  const currentTopY = bottomY - currentHeight;
  const rungs = calculateLadderRungs(bottomY, currentTopY, 22);

  const halfW = width / 2;
  const leftX = x - halfW;
  const rightX = x + halfW;

  return (
    <svg
      data-mascot-ladder
      data-ladder-state={state}
      className="pointer-events-none fixed inset-0 z-[95] overflow-visible"
      width="100%"
      height="100%"
      aria-hidden
      style={{ opacity, transition: 'opacity 0.2s ease-out' }}
    >
      <defs>
        <linearGradient id="ladder-wood-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#854d0e" />
          <stop offset="50%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>
        <filter id="ladder-drop-shadow" x="-20%" y="-10%" width="140%" height="120%">
          <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#ladder-drop-shadow)">
        {/* Left Side Rail */}
        <line
          x1={leftX}
          y1={bottomY}
          x2={leftX}
          y2={currentTopY}
          stroke="url(#ladder-wood-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Right Side Rail */}
        <line
          x1={rightX}
          y1={bottomY}
          x2={rightX}
          y2={currentTopY}
          stroke="url(#ladder-wood-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Rungs */}
        {rungs.map((ry, idx) => (
          <g key={idx}>
            <line
              x1={leftX + 1}
              y1={ry}
              x2={rightX - 1}
              y2={ry}
              stroke="#fbbf24"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Metal Bracket Caps on joints */}
            <circle cx={leftX} cy={ry} r="2" fill="#78716c" />
            <circle cx={rightX} cy={ry} r="2" fill="#78716c" />
          </g>
        ))}

        {/* Top Hook Mounts */}
        <path
          d={`M ${leftX} ${currentTopY} Q ${leftX - 4} ${currentTopY - 6} ${leftX} ${currentTopY - 8}`}
          fill="none"
          stroke="#57534e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={`M ${rightX} ${currentTopY} Q ${rightX + 4} ${currentTopY - 6} ${rightX} ${currentTopY - 8}`}
          fill="none"
          stroke="#57534e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};
