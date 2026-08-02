/**
 * MascotOverlay — Floating Lucky the cat mascot with speech bubble.
 *
 * Subscribes to useMascotStore and renders a fixed-position emoji mascot
 * with a speech bubble when visible. Uses CSS animation for entrance/exit.
 */

import { useMascotStore, type MascotEmotion } from '@/store/mascotStore';

const EMOTION_EMOJI: Record<MascotEmotion, string> = {
  happy: '😺',
  celebrate: '🎉🐱',
  warning: '😼',
  thinking: '🤔🐱',
  sad: '😿',
  idle: '🐱',
};

export function MascotOverlay() {
  const visible = useMascotStore((s) => s.visible);
  const message = useMascotStore((s) => s.message);
  const emotion = useMascotStore((s) => s.emotion);

  if (!visible && !message) return null;

  const emoji = EMOTION_EMOJI[emotion] ?? '🐱';

  return (
    <div
      className={`fixed z-50 flex flex-col items-end gap-1 transition-all duration-300 ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      style={{ bottom: '80px', right: '20px' }}
    >
      {/* Speech bubble */}
      {message && (
        <div
          className="relative max-w-[220px] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-sm leading-snug text-gray-800 shadow-lg border border-gray-200"
          style={{
            animation: visible ? 'mascotSlideUp 0.35s ease-out' : undefined,
          }}
        >
          {message}
          {/* Arrow pointing to mascot */}
          <div className="absolute -bottom-[6px] right-3 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}

      {/* Mascot emoji */}
      <div
        className="text-4xl select-none"
        style={{
          animation: visible ? 'mascotBounce 0.5s ease-out' : undefined,
        }}
        role="img"
        aria-label={emotion}
      >
        {emoji}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes mascotSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mascotBounce {
          0%   { transform: scale(0.5); opacity: 0; }
          50%  { transform: scale(1.2); }
          80%  { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
