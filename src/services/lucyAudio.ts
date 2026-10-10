/**
 * lucyAudio — Pure Web Audio API procedural sound synthesizer for Lucy the Cat.
 * Zero external audio files, zero network delay, fully synthesized cute sound effects.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function isSoundAllowed(): boolean {
  if (!soundEnabled) return false;
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('mascot-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.soundEnabled === false) return false;
    }
  } catch {
    // ignore
  }
  return true;
}

function getAudioContext(): AudioContext | null {
  if (!isSoundAllowed()) return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    // Resume on user gesture if suspended
    void audioCtx.resume();
  }
  return audioCtx;
}

export const lucyAudio = {
  /**
   * Toggle procedural audio playback on/off.
   */
  setEnabled(enabled: boolean): void {
    soundEnabled = enabled;
  },

  /**
   * Cat purr — low frequency rumble with amplitude modulation.
   */
  purr(duration = 1.2): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(42, now);
      osc.frequency.linearRampToValueAtTime(48, now + duration * 0.5);
      osc.frequency.linearRampToValueAtTime(40, now + duration);

      // Tremolo effect for purr motor sound
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(24, now);

      lfoGain.gain.setValueAtTime(0.04, now);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.15);
      gain.gain.linearRampToValueAtTime(0.05, now + duration - 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      lfo.connect(gain.gain);
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      lfo.start(now);
      osc.stop(now + duration);
      lfo.stop(now + duration);
    } catch {
      // Audio autoplay policy / background restriction
    }
  },

  /**
   * Sparkling lucky coin chime — financial success & rewards.
   */
  coin(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Tone 1: high bell
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: sparkle harmonic
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1975.53, now + 0.08); // B6
      gain2.gain.setValueAtTime(0.03, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.4);
    } catch {
      // Audio policy safe
    }
  },

  /**
   * Focus bell chime — peaceful Tibetan singing bowl / meditation tone for focus sessions.
   */
  focusBell(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const freqs = [528, 1056, 1584]; // 528 Hz "Transformation & Miracles" solfeggio frequency
      const weights = [0.08, 0.03, 0.01];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(weights[idx]!, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 2.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.5);
      });
    } catch {
      // Audio policy safe
    }
  },

  /**
   * Gentle interaction pop / click.
   */
  pop(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.06);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Audio policy safe
    }
  },

  /**
   * Cheerful short meow synth.
   */
  meow(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      // Meow pitch contour: starts mid, rises, then gently falls
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.35);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      // Audio policy safe
    }
  },

  /**
   * Spring elastic boing sound — played on pinch/pull release or bounce.
   */
  boing(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio policy safe
    }
  },

  /**
   * Physical impact thud — played on wall/ground elastic collision.
   */
  thud(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Audio policy safe
    }
  },

  /**
   * Playful chirp / giggle — played when tickling the belly!
   */
  giggle(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [600, 820, 750, 960];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.07);
      });
    } catch {
      // Audio policy safe
    }
  },

  /**
   * Startled yelp / meow — played on tail pull or fast shake.
   */
  startled(): void {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.linearRampToValueAtTime(920, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.28);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch {
      // Audio policy safe
    }
  },
};
