import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface LucyChatThinkingProps {
  customText?: string;
  subText?: string;
}

const THINKING_PHRASES = [
  'Nấm đang suy nghĩ...',
  'Đang phân tích số liệu tài chính...',
  'Đang kiểm tra dữ liệu tiệm...',
  'Đang tổng hợp câu trả lời cho bạn...',
];

/**
 * Animated Vector Lucy with smart golden glasses, swishing tail, and thinking particles.
 */
export function LucyChatAvatar({ size = 52 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 select-none flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Ambient glowing aura */}
      <div className="absolute inset-0 rounded-2xl bg-amber-500/15 blur-md animate-pulse" />

      {/* Floating thought icons above Lucy */}
      <div className="absolute -top-2 -right-1 pointer-events-none z-20">
        <span
          className="inline-block text-[11px] animate-[lucyFloatParticle1_2.2s_ease-out_infinite]"
          title="thinking"
        >
          ✨
        </span>
      </div>
      <div className="absolute -top-3 left-0 pointer-events-none z-20">
        <span
          className="inline-block text-[10px] animate-[lucyFloatParticle2_2.8s_ease-out_infinite_0.9s]"
          title="insight"
        >
          💭
        </span>
      </div>

      {/* Lucy Vector Character */}
      <div className="relative z-10 w-full h-full flex items-center justify-center animate-[lucyThinkBob_2.4s_ease-in-out_infinite]">
        <svg
          viewBox="0 0 120 100"
          className="w-full h-full overflow-visible drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Swishing Tail */}
          <g
            className="origin-[35px_80px] animate-[lucyTailSwish_2s_ease-in-out_infinite]"
            style={{ transformOrigin: '35px 80px' }}
          >
            <path
              d="M32 78 C18 68 4 70 -4 80 C-8 88 0 98 12 96 C22 94 30 86 34 78 Z"
              fill="#E67E22"
              stroke="#C05A00"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <ellipse cx="-2" cy="82" rx="4.5" ry="4" fill="#D35400" />
            <path
              d="M26 80 Q10 74 0 81"
              stroke="#F5B041"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.5"
            />
          </g>

          {/* Body & Belly */}
          <ellipse cx="60" cy="74" rx="30" ry="22" fill="#F39C12" stroke="#E67E22" strokeWidth="1" />
          <ellipse cx="60" cy="79" rx="18" ry="14" fill="#FDEBD0" />

          {/* Lucky Red Collar & Golden Jingle Bell */}
          <path d="M45 63 Q60 69 75 63" stroke="#E74C3C" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="60" cy="67.5" r="3.2" fill="#F1C40F" stroke="#D4AC0D" strokeWidth="0.8" />
          <circle cx="60" cy="67.8" r="0.9" fill="#7D6608" />

          {/* Left & Right Ears */}
          <g>
            <path
              d="M36 38 L24 14 L49 26 Z"
              fill="#D35400"
              stroke="#B04000"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path d="M35 34 L28 19 L44 26 Z" fill="#FADBD8" opacity="0.9" />
          </g>
          <g>
            <path
              d="M84 38 L96 14 L71 26 Z"
              fill="#D35400"
              stroke="#B04000"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path d="M85 34 L92 19 L76 26 Z" fill="#FADBD8" opacity="0.9" />
          </g>

          {/* Head */}
          <circle cx="60" cy="43" r="26" fill="#F39C12" stroke="#E67E22" strokeWidth="1" />

          {/* Cute Cheeks */}
          <ellipse cx="42" cy="50" rx="12" ry="8" fill="#F8C471" />
          <ellipse cx="78" cy="50" rx="12" ry="8" fill="#F8C471" />
          {/* Subtle blush */}
          <ellipse cx="41" cy="50" rx="4.5" ry="2.5" fill="#F1948A" opacity="0.6" />
          <ellipse cx="79" cy="50" rx="4.5" ry="2.5" fill="#F1948A" opacity="0.6" />

          {/* Whiskers */}
          <g opacity="0.55" stroke="#7E5109" strokeWidth="0.9" strokeLinecap="round">
            <line x1="38" y1="49" x2="22" y2="47" />
            <line x1="38" y1="52" x2="24" y2="54" />
            <line x1="82" y1="49" x2="98" y2="47" />
            <line x1="82" y1="52" x2="96" y2="54" />
          </g>

          {/* Intelligent Closed-Smiling Crescent Eyes */}
          <g stroke="#5B2C05" strokeWidth="1.8" strokeLinecap="round">
            <path d="M44 41 Q49 37 54 41" />
            <path d="M66 41 Q71 37 76 41" />
          </g>

          {/* Smart Golden Glasses */}
          <g className="mc-glasses" opacity="0.96">
            <circle cx="49" cy="40.5" r="7.5" fill="rgba(255,255,255,0.18)" stroke="#F39C12" strokeWidth="1.5" />
            <path d="M45 37 Q48 35 51 35" stroke="white" strokeWidth="0.9" opacity="0.8" strokeLinecap="round" />
            <circle cx="71" cy="40.5" r="7.5" fill="rgba(255,255,255,0.18)" stroke="#F39C12" strokeWidth="1.5" />
            <path d="M67 37 Q70 35 73 35" stroke="white" strokeWidth="0.9" opacity="0.8" strokeLinecap="round" />
            <path d="M56.5 40.5 Q60 38.5 63.5 40.5" stroke="#F39C12" strokeWidth="1.5" />
            {/* Sparkle glint on glasses */}
            <circle
              cx="53"
              cy="37"
              r="1.2"
              fill="white"
              className="animate-[lucyGlint_2.2s_ease-in-out_infinite]"
            />
          </g>

          {/* Cute Nose & Mouth */}
          <ellipse cx="60" cy="49" rx="2.5" ry="1.7" fill="#E74C3C" />
          <path
            d="M57 52 Q60 54 63 52"
            stroke="#5B2C05"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Tucked Paws (Sitting comfortably while thinking) */}
          <ellipse cx="48" cy="74" rx="7" ry="4.5" fill="#F5CBA7" stroke="#D4A373" strokeWidth="0.7" />
          <ellipse cx="72" cy="74" rx="7" ry="4.5" fill="#F5CBA7" stroke="#D4A373" strokeWidth="0.7" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Modern, charming Lucy chat thinking indicator.
 * Displays animated Lucy with glowing card, dynamic thinking phrases, and wave dots.
 */
export function LucyChatThinking({ customText, subText }: LucyChatThinkingProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (customText) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [customText]);

  const activePhrase = customText || THINKING_PHRASES[phraseIndex];

  return (
    <div className="mr-auto max-w-[92%] sm:max-w-[80%] rounded-2xl rounded-tl-xs p-3.5 bg-gradient-to-br from-surface to-surface-raised/80 border border-amber-500/25 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-3">
        {/* Animated Lucy Character */}
        <LucyChatAvatar size={48} />

        {/* Text & Typing Animation */}
        <div className="flex flex-col min-w-0 pr-1">
          {/* Header row: Lucy label & status */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-1">
              <span>Nấm AI</span>
              <Sparkles size={11} className="text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              Trợ lý tài chính
            </span>
          </div>

          {/* Dynamic Thinking Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary transition-opacity duration-300 truncate">
              {activePhrase}
            </span>

            {/* Bouncing Dots Wave */}
            <div className="flex items-center gap-1 shrink-0 pt-0.5" aria-label="loading">
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-[typingDotWave_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: '0s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-[typingDotWave_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: '0.2s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-[typingDotWave_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: '0.4s' }}
              />
            </div>
          </div>

          {subText && (
            <div className="text-[10px] text-text-muted mt-0.5">
              {subText}
            </div>
          )}
        </div>
      </div>

      {/* Shimmer Wave Line at Bottom */}
      <div className="mt-2.5 h-[2px] w-full rounded-full bg-border/40 overflow-hidden">
        <div className="h-full w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full animate-[shimmerSlide_1.8s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

/**
 * Compact mini avatar of Lucy for completed chat message headers.
 */
export function LucyAvatarMini({ size = 22 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0 overflow-hidden shadow-xs group"
      style={{ width: size, height: size }}
      title="Nấm AI Assistant"
    >
      <span className="text-xs leading-none select-none group-hover:scale-110 transition-transform">🐱</span>
    </div>
  );
}
