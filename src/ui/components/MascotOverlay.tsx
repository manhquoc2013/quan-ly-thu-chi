/**
 * MascotOverlay — SVG Lucky the cat with speech bubble & emotion states.
 */
import { useMascotStore, type MascotEmotion } from '@/store/mascotStore';

function CatBody({ emotion }: { emotion: MascotEmotion }) {
  const isHappy = emotion === 'happy' || emotion === 'celebrate';
  const isSad = emotion === 'sad';
  return (
    <svg width="96" height="100" viewBox="0 0 120 125" className="drop-shadow-xl">
      {/* Tail */}
      <path d="M95 75 Q115 70 120 85 Q125 100 110 95" fill="none" stroke="#E67E22" strokeWidth="6" strokeLinecap="round" className="origin-bottom-right" style={{animation: 'tailWag 2s ease-in-out infinite'}}>
        <animateTransform attributeName="transform" type="rotate" values="-5 95 75;8 95 75;-5 95 75" dur="2s" repeatCount="indefinite" />
      </path>
      {/* Back legs / feet */}
      <ellipse cx="45" cy="115" rx="14" ry="8" fill="#E67E22" />
      <ellipse cx="75" cy="115" rx="14" ry="8" fill="#E67E22" />
      <ellipse cx="45" cy="113" rx="10" ry="5" fill="#F5CBA7" />
      <ellipse cx="75" cy="113" rx="10" ry="5" fill="#F5CBA7" />
      {/* Body */}
      <ellipse cx="60" cy="80" rx="35" ry="30" fill="#F39C12" />
      {/* Belly */}
      <ellipse cx="60" cy="88" rx="22" ry="18" fill="#FDEBD0" />
      {/* Arms / front paws */}
      <ellipse cx="28" cy="90" rx="8" ry="12" fill="#F39C12" transform="rotate(15 28 90)" />
      <ellipse cx="92" cy="90" rx="8" ry="12" fill="#F39C12" transform="rotate(-15 92 90)" />
      <ellipse cx="26" cy="100" rx="7" ry="5" fill="#F5CBA7" />
      <ellipse cx="94" cy="100" rx="7" ry="5" fill="#F5CBA7" />
      {/* Head */}
      <ellipse cx="60" cy="45" rx="30" ry="27" fill="#F39C12" />
      {/* Ears */}
      <polygon points="33,30 28,5 45,20" fill="#F39C12" />
      <polygon points="35,25 32,12 42,20" fill="#F5B7B1" />
      <polygon points="87,30 92,5 75,20" fill="#F39C12" />
      <polygon points="85,25 88,12 78,20" fill="#F5B7B1" />
      {/* Face */}
      <ellipse cx="60" cy="52" rx="22" ry="17" fill="#FDEBD0" />
      {/* Eyes */}
      <ellipse cx="48" cy="42" rx={isHappy ? "3" : "4.5"} ry={isHappy ? "2" : "4.5"} fill="#2C3E50" />
      <ellipse cx="72" cy="42" rx={isHappy ? "3" : "4.5"} ry={isHappy ? "2" : "4.5"} fill="#2C3E50" />
      <circle cx={isHappy ? "49" : "50"} cy={isHappy ? "41" : "40"} r="2" fill="white" />
      <circle cx={isHappy ? "73" : "74"} cy={isHappy ? "41" : "40"} r="2" fill="white" />
      {/* Nose */}
      <ellipse cx="60" cy="52" rx="3" ry="2" fill="#E74C3C" />
      {/* Mouth */}
      {isHappy ? (
        <path d="M54 56 Q60 62 66 56" fill="none" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
      ) : isSad ? (
        <path d="M54 58 Q60 54 66 58" fill="none" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
      ) : (
        <line x1="56" y1="57" x2="64" y2="57" stroke="#2C3E50" strokeWidth="1.2" strokeLinecap="round" />
      )}
      {/* Whiskers */}
      <line x1="28" y1="50" x2="42" y2="52" stroke="#BDC3C7" strokeWidth="0.6" />
      <line x1="28" y1="54" x2="42" y2="54" stroke="#BDC3C7" strokeWidth="0.6" />
      <line x1="78" y1="52" x2="92" y2="50" stroke="#BDC3C7" strokeWidth="0.6" />
      <line x1="78" y1="54" x2="92" y2="54" stroke="#BDC3C7" strokeWidth="0.6" />
      {/* Blush */}
      {isHappy && <><ellipse cx="38" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity="0.5" /><ellipse cx="82" cy="53" rx="5" ry="3" fill="#F5B7B1" opacity="0.5" /></>}
      {/* Stripes on forehead */}
      <path d="M54 30 L56 35 L60 32 L64 35 L66 30" fill="none" stroke="#D68910" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <style>{`
        @keyframes tailWag { 0%,100% { transform:rotate(-3deg) } 50% { transform:rotate(8deg) } }
      `}</style>
    </svg>
  );
}

export function MascotOverlay() {
  const visible = useMascotStore((s) => s.visible);
  const message = useMascotStore((s) => s.message);
  const emotion = useMascotStore((s) => s.emotion);

  if (!visible) {
    return (
      <div className="fixed z-50 flex flex-col items-end gap-2" style={{ bottom: 16, right: 16 }}>
        <div style={{ transformOrigin: 'bottom center', animation: 'mcIdleBreathe 3s ease-in-out infinite' }}>
          <CatBody emotion="idle" />
        </div>
        <style>{`@keyframes mcIdleBreathe { 0%,100% { transform:scale(1) } 50% { transform:scale(1.03) } }`}</style>
      </div>
    );
  }

  return (
    <div className={`fixed z-50 flex flex-col items-end gap-2 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      style={{ bottom: 16, right: 16 }}>
      {message && (
        <div className="relative max-w-[200px] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-sm leading-snug text-gray-800 shadow-lg border border-gray-200" style={{ animation: visible ? 'mcSlideUp 0.35s ease-out' : undefined }}>
          {message}<div className="absolute -bottom-[6px] right-4 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}
      <div style={{ animation: visible ? 'mcBounce 0.5s ease-out' : undefined, transformOrigin: 'bottom center' }}>
        <CatBody emotion={emotion} />
      </div>
      <style>{`
        @keyframes mcSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes mcBounce { 0% { transform:scale(0.5); opacity:0 } 50% { transform:scale(1.15) } 80% { transform:scale(0.95) } 100% { transform:scale(1); opacity:1 } }
        @keyframes mcIdleBreathe { 0%,100% { transform:scale(1) } 50% { transform:scale(1.03) } }
      `}</style>
    </div>
  );
}
