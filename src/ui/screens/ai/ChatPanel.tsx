/**
 * ChatPanel — Slide-in AI chat with multimodal intake (text / voice / file).
 */

import { useState, useRef, useEffect } from 'react';
import {
  X, Send, Loader2, Plus, History, Trash2, Paperclip, Mic, MicOff, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@store/uiStore';
import { aiRouter, type ChatThread } from '@/services/aiRouter';
import { getAllExpenses } from '@/services/expenseService';
import { getAllRevenues } from '@/services/revenueService';
import { webLLM } from '@/services/webLLM';
import { speechService } from '@/services/speechService';
import { intakeFromFile, persistConfirmed } from '@/services/intakeService';
import { applyKindToDrafts } from '@/services/csvImportService';
import type { DraftKind, DraftRecord } from '@/services/draftTypes';
import { MarkdownText } from '@components/MarkdownText';
import { DataEntryHelper } from './DataEntryHelper';
import { toast } from 'sonner';
import { llmSourceLabel } from '@/services/llmCall';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  source?: 'local' | 'cloud' | 'kilo' | 'gemini' | 'tesseract';
  drafts?: DraftRecord[];
  confirmed?: boolean;
  createdRecord?: { kind: 'expense' | 'revenue'; id: string };
}

const WELCOME =
  'Xin chào! Gõ chi/thu để lưu ngay (vd: cà phê 25k). Đính kèm ảnh/PDF/CSV cần xác nhận. Có thể dùng mic hoặc hỏi phân tích.';

export function ChatPanel() {
  const { fabOpen, toggleFab, setFabOpen, requestRecordDetail } = useUIStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'ai', text: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [threadList, setThreadList] = useState<ChatThread[]>(() => aiRouter.getThreads());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function refreshThreads() {
    setThreadList(aiRouter.getThreads());
  }

  function isUiChatEmpty(msgs: ChatMessage[]): boolean {
    return !msgs.some((m) => m.role === 'user');
  }

  function handleNewChat() {
    if (isUiChatEmpty(messages) && aiRouter.isActiveThreadEmpty()) {
      toast.message('Đang ở chat trống — gửi tin nhắn trước khi tạo chat mới');
      return;
    }
    const result = aiRouter.newThread();
    if (!result.created && isUiChatEmpty(messages)) {
      toast.message('Đang ở chat trống — gửi tin nhắn trước khi tạo chat mới');
      return;
    }
    setMessages([{ id: 'welcome', role: 'ai', text: WELCOME }]);
    setShowHistory(false);
    setInput('');
    refreshThreads();
  }

  function handleDeleteThread(id: string) {
    aiRouter.deleteThread(id);
    refreshThreads();
    if (aiRouter.getActiveThreadId() === null && showHistory) {
      // stay on history view with updated list
    }
  }

  useEffect(() => {
    if (!fabOpen || webLLM.isLoaded) return;
    const timer = setInterval(() => {
      if (webLLM.isLoading) setModelProgress(webLLM.loadProgress);
      else if (webLLM.isLoaded) setModelProgress(100);
    }, 300);
    return () => clearInterval(timer);
  }, [fabOpen]);

  useEffect(() => {
    if (fabOpen) {
      setMessages([{ id: 'welcome', role: 'ai', text: WELCOME }]);
      setInput('');
      setIsTyping(false);
      setListening(false);
      speechService.stop();
      refreshThreads();
      if (!webLLM.isLoaded && !webLLM.isLoading) webLLM.load();
    } else {
      speechService.stop();
      setListening(false);
    }
  }, [fabOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isTyping]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', text: trimmed }]);
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
          source: result.source,
          drafts: result.drafts,
          createdRecord: result.createdRecord,
        },
      ]);
      if (result.text.startsWith('✅')) {
        void getAllExpenses();
        void getAllRevenues();
      }
      refreshThreads();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'ai',
          text: `⚠️ Lỗi AI: ${err instanceof Error ? err.message : 'Unknown'}`,
        },
      ]);
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
    }
  }

  async function handleFile(file: File) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setIsTyping(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: `Đính kèm: ${file.name}` },
    ]);
    try {
      const result = await intakeFromFile(file);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'ai',
          text: result.text,
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
          text: `⚠️ Không xử lý được file: ${err instanceof Error ? err.message : 'Unknown'}`,
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
                text: `${m.text}\n\n✅ Đã lưu **${ok}** khoản.${failed.length ? `\n⚠️ Lỗi: ${failed.join('; ')}` : ''}`,
              }
            : m,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu');
    } finally {
      setConfirmingId(null);
    }
  }

  function openCreatedDetail(rec: { kind: 'expense' | 'revenue'; id: string }) {
    setFabOpen(false);
    navigate(rec.kind === 'revenue' ? '/revenue' : '/expense');
    window.setTimeout(() => {
      requestRecordDetail(rec.kind, rec.id);
    }, 80);
  }

  function updateDrafts(msgId: string, next: DraftRecord[]) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, drafts: next } : m)));
  }

  if (!fabOpen) return null;

  const QUICK_ACTIONS = ['Phân tích chi phí', 'Tổng quan tháng', 'Dự báo'] as const;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={toggleFab}
        aria-hidden="true"
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-background shadow-dialog flex flex-col"
        role="dialog"
        aria-label="AI Chat Panel"
      >
        <div className="flex items-center justify-between px-[var(--s-md)] py-[var(--s-sm)] border-b border-border">
          <div className="flex items-center gap-[var(--s-xs)]">
            <button
              onClick={handleNewChat}
              disabled={isUiChatEmpty(messages) && aiRouter.isActiveThreadEmpty()}
              className={[
                'flex items-center justify-center size-7 rounded-field',
                isUiChatEmpty(messages) && aiRouter.isActiveThreadEmpty()
                  ? 'text-text-disabled cursor-not-allowed'
                  : 'text-text-muted hover:bg-surface-hover',
              ].join(' ')}
              aria-label="Chat mới"
              title={
                isUiChatEmpty(messages) && aiRouter.isActiveThreadEmpty()
                  ? 'Chat hiện tại đang trống'
                  : 'Chat mới'
              }
            >
              <Plus size={14} />
            </button>
            <span className="text-sm">🤖</span>
            <h3 className="text-sm font-semibold text-text-primary">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                refreshThreads();
                setShowHistory(!showHistory);
              }}
              className={[
                'flex items-center justify-center size-7 rounded-field',
                showHistory ? 'bg-accent-bg text-accent-fg' : 'text-text-muted hover:bg-surface-hover',
              ].join(' ')}
              aria-label="Lịch sử chat"
            >
              <History size={14} />
            </button>
            <button
              onClick={toggleFab}
              className="flex items-center justify-center size-7 rounded-field text-text-muted hover:bg-surface-hover"
              aria-label="Đóng chat"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-[var(--s-md)]">
            <h4 className="text-xs font-semibold text-text-secondary mb-[var(--s-sm)]">Lịch sử chat</h4>
            {threadList.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">Chưa có lịch sử chat</p>
            ) : (
              <div className="space-y-1">
                {threadList.map((t: ChatThread) => (
                  <div key={t.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => {
                        const msgs = aiRouter.switchThread(t.id);
                        setMessages(
                          msgs.length > 0
                            ? msgs.map((m, i) => ({
                                id: `hist-${i}`,
                                role: m.role as 'user' | 'ai',
                                text: m.content,
                              }))
                            : [{ id: 'welcome', role: 'ai' as const, text: WELCOME }],
                        );
                        setShowHistory(false);
                      }}
                      className="flex-1 text-left px-[var(--s-sm)] py-[var(--s-xs)] rounded-field text-xs hover:bg-surface-hover truncate"
                    >
                      <span className="block truncate">{t.title || 'Cuộc trò chuyện'}</span>
                      <span className="text-[10px] text-text-muted">
                        {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteThread(t.id);
                      }}
                      className="shrink-0 size-7 flex items-center justify-center rounded text-text-muted hover:text-danger-fg hover:bg-danger-bg"
                      aria-label="Xóa"
                      title="Xóa cuộc trò chuyện"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-[var(--s-xs)] px-[var(--s-md)] py-[var(--s-sm)] border-b border-border-subtle">
              {QUICK_ACTIONS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSend(chip)}
                  disabled={isTyping}
                  className="text-xs px-[var(--s-sm)] py-1 rounded-badge bg-accent-bg text-accent-fg font-medium hover:bg-accent-bg-hover disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>

            {webLLM.isLoading && (
              <div className="mx-[var(--s-md)] mt-[var(--s-sm)] p-[var(--s-sm)] rounded-panel bg-surface border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 size={12} className="animate-spin text-accent-fg" />
                  <span className="text-[11px]">Đang tải AI offline {modelProgress}%</span>
                </div>
                <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-fg rounded-full transition-all"
                    style={{ width: `${modelProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-[var(--s-md)] py-[var(--s-sm)] flex flex-col gap-[var(--s-sm)]"
              role="log"
              aria-label="Chat messages"
            >
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-2">
                  <div
                    className={[
                      'max-w-[85%] rounded-panel px-[var(--s-md)] py-[var(--s-sm)] text-xs',
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
                    <div className="mr-auto w-full max-w-[95%]">
                      <DataEntryHelper
                        drafts={msg.drafts}
                        busy={confirmingId === msg.id}
                        onConfirm={(d) => onConfirmDrafts(msg.id, d)}
                        onCancel={() => updateDrafts(msg.id, [])}
                        onChangeKind={(kind: DraftKind) =>
                          updateDrafts(msg.id, applyKindToDrafts(msg.drafts!, kind))
                        }
                        onRemoveRow={(id) =>
                          updateDrafts(msg.id, msg.drafts!.filter((d) => d.id !== id))
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

            <div className="p-[var(--s-sm)] border-t border-border bg-surface">
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
              <div className="flex items-center gap-[var(--s-xs)]">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isTyping}
                  className="shrink-0 size-7 rounded-field flex items-center justify-center text-text-muted hover:bg-surface-hover disabled:opacity-50"
                  aria-label="Đính kèm file"
                  title="Ảnh / PDF / CSV / Excel"
                >
                  <Paperclip size={14} />
                </button>
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={isTyping || !speechService.isSupported}
                  className={[
                    'shrink-0 size-7 rounded-field flex items-center justify-center',
                    listening ? 'bg-danger-bg text-danger-fg' : 'text-text-muted hover:bg-surface-hover',
                    'disabled:opacity-40',
                  ].join(' ')}
                  aria-label={listening ? 'Dừng mic' : 'Nói'}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend(input);
                    }
                  }}
                  placeholder={listening ? 'Đang nghe...' : 'Nhập tin nhắn… (Shift+Enter xuống dòng)'}
                  className="flex-1 min-h-7 max-h-[120px] resize-none overflow-y-auto bg-input-bg border border-input-border rounded-field px-[var(--s-sm)] py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-input-focus-ring leading-snug"
                  aria-label="Chat message input"
                  disabled={isTyping}
                />
                <button
                  onClick={() => void handleSend(input)}
                  disabled={!input.trim() || isTyping}
                  className={[
                    'shrink-0 size-7 rounded-field flex items-center justify-center',
                    input.trim() && !isTyping
                      ? 'bg-accent-fg text-white hover:bg-accent-fg-hover'
                      : 'bg-surface-active text-text-disabled',
                  ].join(' ')}
                  aria-label="Send message"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
