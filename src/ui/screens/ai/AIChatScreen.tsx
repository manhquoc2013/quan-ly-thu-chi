/**
 * AIChatScreen — Full-page AI chat with multimodal intake.
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Loader2, Paperclip, Mic, MicOff, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { aiRouter } from '@/services/aiRouter';
import { getAllExpenses } from '@/services/expenseService';
import { getAllRevenues } from '@/services/revenueService';
import { webLLM } from '@/services/webLLM';
import { speechService } from '@/services/speechService';
import { intakeFromFile, persistConfirmed } from '@/services/intakeService';
import { applyKindToDrafts } from '@/services/csvImportService';
import type { DraftKind, DraftRecord } from '@/services/draftTypes';
import { useUIStore } from '@/store/uiStore';
import { MarkdownText } from '@components/MarkdownText';
import { DataEntryHelper } from './DataEntryHelper';
import { toast } from 'sonner';
import { llmSourceLabel } from '@/services/llmCall';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
  source?: 'local' | 'cloud' | 'kilo' | 'gemini' | 'tesseract';
  drafts?: DraftRecord[];
  confirmed?: boolean;
  createdRecord?: { kind: 'expense' | 'revenue'; id: string };
}

export function AIChatScreen() {
  const navigate = useNavigate();
  const requestRecordDetail = useUIStore((s) => s.requestRecordDetail);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: 'Xin chào! Gõ chi/thu để lưu ngay. Đính kèm ảnh/PDF/CSV cần xác nhận. Hỗ trợ mic và phân tích số liệu.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const [aiReady, setAiReady] = useState<boolean>(aiRouter.isConfigured);
  const [modelProgress, setModelProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isTyping]);

  useEffect(() => {
    if (aiReady) return;
    const timer = setInterval(() => setAiReady(aiRouter.isConfigured), 2000);
    return () => clearInterval(timer);
  }, [aiReady]);

  useEffect(() => {
    if (webLLM.isLoaded) return;
    const timer = setInterval(() => {
      if (webLLM.isLoading) setModelProgress(webLLM.loadProgress);
      else if (webLLM.isLoaded) setModelProgress(100);
    }, 300);
    return () => clearInterval(timer);
  }, []);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: trimmed, timestamp: new Date() },
    ]);
    setInput('');
    setIsTyping(true);
    try {
      const result = await aiRouter.sendMessage(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'ai',
          text: result.text,
          timestamp: new Date(),
          source: result.source,
          drafts: result.drafts,
          createdRecord: result.createdRecord,
        },
      ]);
      if (result.text.startsWith('✅')) {
        void getAllExpenses();
        void getAllRevenues();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'ai',
          text: `⚠️ Lỗi: ${err instanceof Error ? err.message : 'Unknown'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
      setAiReady(aiRouter.isConfigured);
    }
  }

  async function handleFile(file: File) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setIsTyping(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: `Đính kèm: ${file.name}`, timestamp: new Date() },
    ]);
    try {
      const result = await intakeFromFile(file);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'ai',
          text: result.text,
          timestamp: new Date(),
          source: result.source,
          drafts: result.drafts,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'ai',
          text: `⚠️ ${err instanceof Error ? err.message : 'Lỗi file'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
    }
  }

  function toggleMic() {
    if (!speechService.isSupported) {
      toast.error('Trình duyệt không hỗ trợ nhận diện giọng nói');
      return;
    }
    if (listening) {
      speechService.stop();
      setListening(false);
      return;
    }
    const ok = speechService.start(
      (text, isFinal) => {
        if (isFinal) setInput((prev) => (prev ? `${prev} ${text}`.trim() : text));
        else setInput(text);
      },
      (msg) => {
        setListening(false);
        toast.error(`Mic: ${msg}`);
      },
    );
    setListening(ok);
  }

  async function onConfirmDrafts(msgId: string, drafts: DraftRecord[]) {
    setConfirmingId(msgId);
    try {
      const { ok, failed } = await persistConfirmed(drafts);
      await getAllExpenses();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                drafts: undefined,
                confirmed: true,
                text: `${m.text}\n\n✅ Đã lưu **${ok}** khoản.${failed.length ? `\n⚠️ ${failed.join('; ')}` : ''}`,
              }
            : m,
        ),
      );
    } finally {
      setConfirmingId(null);
    }
  }

  function updateDrafts(msgId: string, next: DraftRecord[]) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, drafts: next } : m)));
  }

  function openCreatedDetail(rec: { kind: 'expense' | 'revenue'; id: string }) {
    navigate(rec.kind === 'revenue' ? '/revenue' : '/expense');
    window.setTimeout(() => requestRecordDetail(rec.kind, rec.id), 80);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-[var(--s-md)] py-[var(--s-sm)] bg-info-banner border-b border-border-subtle">
        <div className="flex items-center gap-[var(--s-xs)]">
          <span className="text-sm">🤖</span>
          <span className="text-xs text-info-fg">
            {webLLM.isLoading
              ? `🔄 Đang tải model offline (${modelProgress}%) — vẫn dùng được lệnh rõ / CSV / mic`
              : aiReady
                ? '🟢 AI Assistant sẵn sàng — text, ảnh, file, giọng nói.'
                : '🟡 Đang khởi tạo AI — cấu hình Gemini trong Cài đặt để OCR tốt hơn.'}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-[var(--s-md)] flex flex-col gap-[var(--s-sm)]"
        role="log"
        aria-label="Chat messages"
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-2">
            <div
              className={[
                'max-w-[80%] rounded-panel px-[var(--s-md)] py-[var(--s-sm)] text-sm',
                msg.role === 'user'
                  ? 'bg-accent-fg text-white ml-auto'
                  : 'bg-surface border border-border text-text-primary mr-auto',
              ].join(' ')}
            >
              {msg.role === 'user' ? msg.text : <MarkdownText text={msg.text} />}
              {msg.source && (
                <div className="mt-1 text-[10px] text-text-muted">
                  {llmSourceLabel(msg.source)}
                </div>
              )}
              {msg.createdRecord && (
                <button
                  type="button"
                  onClick={() => openCreatedDetail(msg.createdRecord!)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-field bg-accent-bg text-accent-fg hover:bg-accent-bg-hover"
                >
                  <ExternalLink size={11} />
                  Xem chi tiết
                </button>
              )}
            </div>
            {msg.drafts && msg.drafts.length > 0 && !msg.confirmed && (
              <div className="mr-auto w-full max-w-[90%]">
                <DataEntryHelper
                  drafts={msg.drafts}
                  busy={confirmingId === msg.id}
                  onConfirm={(d) => onConfirmDrafts(msg.id, d)}
                  onCancel={() => updateDrafts(msg.id, [])}
                  onChangeKind={(kind: DraftKind) =>
                    updateDrafts(msg.id, applyKindToDrafts(msg.drafts!, kind))
                  }
                  onRemoveRow={(id) =>
                    updateDrafts(msg.id, msg.drafts!.filter((row) => row.id !== id))
                  }
                />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="mr-auto bg-surface border border-border rounded-panel px-[var(--s-md)] py-[var(--s-sm)]">
            <div className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-accent-fg" />
              <span className="text-xs text-text-muted">Đang xử lý...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-[var(--s-md)] border-t border-border bg-surface">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.pdf,.csv,.xls,.xlsx,image/jpeg,image/png,application/pdf,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handleFile(f);
          }}
        />
        <Card className="bg-surface/80 backdrop-blur-sm border-border-subtle">
          <CardContent className="p-[var(--s-sm)]">
            <div className="flex items-center gap-[var(--s-xs)]">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isTyping}
                className="shrink-0 size-8 rounded-field flex items-center justify-center text-text-muted hover:bg-surface-hover"
                aria-label="Đính kèm"
              >
                <Paperclip size={14} />
              </button>
              <button
                type="button"
                onClick={toggleMic}
                disabled={isTyping || !speechService.isSupported}
                className={[
                  'shrink-0 size-8 rounded-field flex items-center justify-center',
                  listening ? 'bg-danger-bg text-danger-fg' : 'text-text-muted hover:bg-surface-hover',
                ].join(' ')}
                aria-label="Mic"
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={listening ? 'Đang nghe...' : 'Nhập câu hỏi...'}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                aria-label="Chat message input"
                disabled={isTyping}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isTyping}
                className={[
                  'shrink-0 size-8 rounded-field flex items-center justify-center',
                  input.trim() && !isTyping
                    ? 'bg-accent-fg text-white hover:bg-accent-fg-hover'
                    : 'bg-surface-active text-text-disabled',
                ].join(' ')}
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
