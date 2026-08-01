/**
 * Web Speech API wrapper for Vietnamese voice input.
 */

type SpeechListener = (text: string, isFinal: boolean) => void;

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

export const speechService = {
  get isSupported(): boolean {
    return typeof window !== 'undefined' && !!getRecognitionCtor();
  },

  get isListening(): boolean {
    return listening;
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
};
