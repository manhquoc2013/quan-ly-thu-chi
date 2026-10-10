/**
 * Web Speech API wrapper for Vietnamese voice input & Text-To-Speech output with lip-sync.
 */

type SpeechListener = (text: string, isFinal: boolean) => void;
export type VisemeShape = 'closed' | 'open' | 'round' | 'smile';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

let recognition: SpeechRecognitionLike | null = null;
let listening = false;
let speaking = false;
let lipSyncTimer: ReturnType<typeof setInterval> | null = null;

export const speechService = {
  get isSupported(): boolean {
    return typeof window !== 'undefined' && !!getRecognitionCtor();
  },

  get isTtsSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  get isListening(): boolean {
    return listening;
  },

  get isSpeaking(): boolean {
    return speaking;
  },

  start(onResult: SpeechListener, onError?: (msg: string) => void): boolean {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onError?.('Trình duyệt không hỗ trợ nhận diện giọng nói');
      return false;
    }
    this.stop();

    recognition = new Ctor();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (ev) => {
      let interim = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]!;
        const piece = res[0]?.transcript ?? '';
        if (res.isFinal) finalText += piece;
        else interim += piece;
      }
      if (finalText) onResult(finalText.trim(), true);
      else if (interim) onResult(interim.trim(), false);
    };

    recognition.onerror = (ev) => {
      listening = false;
      if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
        onError?.(ev.error);
      }
    };

    recognition.onend = () => {
      listening = false;
    };

    try {
      recognition.start();
      listening = true;
      return true;
    } catch (err) {
      listening = false;
      onError?.(err instanceof Error ? err.message : 'Không bắt đầu được mic');
      return false;
    }
  },

  stop(): void {
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        try { recognition.abort(); } catch { /* ignore */ }
      }
    }
    recognition = null;
    listening = false;
  },

  /**
   * Get all available TTS voices from the browser.
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.isTtsSupported) return [];
    try {
      return window.speechSynthesis.getVoices();
    } catch {
      return [];
    }
  },

  /**
   * Speak text out loud using Web Speech API with simulated talking visemes and configurable voice.
   */
  speakText(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onViseme?: (viseme: VisemeShape) => void;
      voiceURI?: string;
      pitch?: number;
      rate?: number;
    },
  ): boolean {
    if (!this.isTtsSupported) return false;

    // Clean text: strip markdown characters, emojis, and code formatting
    const plain = text
      .replace(/[*_#`~[\]()]/g, ' ')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
      .replace(/\s+/g, ' ')
      .trim();

    if (!plain) return false;

    try {
      window.speechSynthesis.cancel();
    } catch {
      // Safe catch
    }

    if (lipSyncTimer) {
      clearInterval(lipSyncTimer);
      lipSyncTimer = null;
    }

    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.lang = 'vi-VN';
    utterance.pitch = options?.pitch ?? 1.15; // Customizable tone pitch
    utterance.rate = options?.rate ?? 1.05;   // Customizable speech speed

    // Select specific configured voice or fallback to best Vietnamese voice
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (options?.voiceURI) {
      selectedVoice = voices.find((v) => v.voiceURI === options.voiceURI || v.name === options.voiceURI);
    }

    if (!selectedVoice) {
      selectedVoice = voices.find((v) => v.lang.startsWith('vi') || v.lang === 'vi_VN') ||
        voices.find((v) => v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('tieng viet'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || 'vi-VN';
    }

    utterance.onstart = () => {
      speaking = true;
      options?.onStart?.();

      // TalkingHead / Live2D viseme animation driver
      const shapes: VisemeShape[] = ['open', 'round', 'smile', 'open', 'closed'];
      let idx = 0;
      lipSyncTimer = setInterval(() => {
        if (!speaking) {
          if (lipSyncTimer) clearInterval(lipSyncTimer);
          options?.onViseme?.('closed');
          return;
        }
        idx = (idx + 1) % shapes.length;
        options?.onViseme?.(shapes[idx]!);
      }, 130);
    };

    const finish = () => {
      speaking = false;
      if (lipSyncTimer) {
        clearInterval(lipSyncTimer);
        lipSyncTimer = null;
      }
      options?.onViseme?.('closed');
      options?.onEnd?.();
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    try {
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      finish();
      return false;
    }
  },

  stopSpeaking(): void {
    if (!this.isTtsSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    speaking = false;
    if (lipSyncTimer) {
      clearInterval(lipSyncTimer);
      lipSyncTimer = null;
    }
  },
};
