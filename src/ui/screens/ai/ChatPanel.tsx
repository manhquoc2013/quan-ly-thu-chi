/**
 * ChatPanel — Slide-in AI chat panel (used from FAB).
 *
 * Compact version of AIChatScreen with:
 * - Animated slide-in from right
 * - Close button at top
 * - Quick action chips: "Phân tích chi phí", "Tổng quan tháng", "Dự báo"
 */

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Plus, History, Trash2 } from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { useExpenseStore } from "@/store/expenseStore";
import { useRevenueStore } from "@/store/revenueStore";
import { formatCurrency } from "@/utils/currency";
import { EXPENSE_CATEGORY_LABELS } from "@/models";
import { aiRouter, type ChatThread } from "@/services/aiRouter";
import { getAllExpenses } from "@/services/expenseService";
import { webLLM } from "@/services/webLLM";
import { MarkdownText } from "@components/MarkdownText";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  source?: "local" | "cloud";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel() {
  const { fabOpen, toggleFab } = useUIStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Xin chào! Tôi có thể giúp phân tích tài chính. Chọn một tác vụ nhanh bên dưới hoặc nhắn tin tự do.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const sendingRef = useRef(false); // guard against double-send race condition
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Poll model loading progress
  useEffect(() => {
    if (!fabOpen || webLLM.isLoaded) return;
    const timer = setInterval(() => {
      if (webLLM.isLoading) {
        setModelProgress(webLLM.loadProgress);
        setModelStatus(webLLM.loadStatus);
      } else if (webLLM.isLoaded) {
        setModelProgress(100);
        setModelStatus("Sẵn sàng");
      }
    }, 300);
    return () => clearInterval(timer);
  }, [fabOpen]);

  // Reset state when panel opens, and preload WebLLM model
  useEffect(() => {
    if (fabOpen) {
      setMessages([
        {
          id: "welcome",
          role: "ai",
          text: "Xin chào! Tôi có thể giúp phân tích tài chính. Chọn một tác vụ nhanh bên dưới hoặc nhắn tin tự do.",
        },
      ]);
      setInput("");
      setIsTyping(false);
      // Preload model khi mở chat để hiển thị progress ngay
      if (!webLLM.isLoaded && !webLLM.isLoading) {
        webLLM.load();
      }
    }
  }, [fabOpen]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Build data context for analysis requests
    let context: string | undefined;
    const lower = trimmed.toLowerCase();
    const needsData = ['tổng quan', 'phân tích', 'báo cáo', 'thống kê', 'dự báo', 'so sánh', 'xu hướng',
      'tổng hợp', 'chi tiêu', 'doanh thu', 'lợi nhuận', 'tháng', 'tuần', 'ngày', 'năm', 'tình hình'];
    if (needsData.some(k => lower.includes(k))) {
      const expenses = useExpenseStore.getState().records;
      const revenues = useRevenueStore.getState().records;
      const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
      const totalRevenue = revenues.reduce((s, r) => s + r.finalAmount, 0);
      const byCategory: Record<string, number> = {};
      expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
      const categorySummary = Object.entries(byCategory)
        .map(([cat, amt]) => `  ${EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] || cat}: ${formatCurrency(amt)}`)
        .join('\n');

      context = `DỮ LIỆU THỰC TẾ (dùng để phân tích):
Tổng chi: ${formatCurrency(totalExpense)} (${expenses.length} khoản)
Tổng thu: ${formatCurrency(totalRevenue)} (${revenues.length} đơn)
Lợi nhuận: ${formatCurrency(totalRevenue - totalExpense)}
Chi tiết chi theo danh mục:
${categorySummary}`;
    }

    try {
      const result = await aiRouter.sendMessage(trimmed, context);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: result.text,
        source: result.source,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Execute action if AI returned one (e.g., create expense from command)
      if (result.action) {
        aiRouter.executeAction(result.action);
        getAllExpenses();
      }
    } catch (err) {
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: `⚠️ Đã xảy ra lỗi khi gọi AI: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
    }
  }

  if (!fabOpen) return null;

  const QUICK_ACTIONS = [
    "Phân tích chi phí",
    "Tổng quan tháng",
    "Dự báo",
  ] as const;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-[var(--d-normal)]"
        onClick={toggleFab}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={[
          "fixed right-0 top-0 bottom-0 z-50",
          "w-full max-w-sm",
          "bg-background",
          "shadow-dialog",
          "flex flex-col",
          "transition-transform duration-[var(--d-normal)] ease-[var(--ease-out)]",
        ].join(" ")}
        role="dialog"
        aria-label="AI Chat Panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[var(--s-md)] py-[var(--s-sm)] border-b border-border">
          <div className="flex items-center gap-[var(--s-xs)]">
            <button
              onClick={() => {
                aiRouter.newThread();
                setMessages([{ id: "welcome", role: "ai", text: "Xin chào! Tôi có thể giúp phân tích tài chính. Chọn một tác vụ nhanh bên dưới hoặc nhắn tin tự do." }]);
                setShowHistory(false);
              }}
              className="flex items-center justify-center size-7 rounded-field text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
              aria-label="Chat mới"
              title="Chat mới"
            >
              <Plus size={14} />
            </button>
            <span className="text-sm">🤖</span>
            <h3 className="text-sm font-semibold text-text-primary">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={["flex items-center justify-center size-7 rounded-field transition-colors",
                showHistory ? "bg-accent-bg text-accent-fg" : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
              ].join(" ")}
              aria-label="Lịch sử chat"
              title="Lịch sử chat"
            >
              <History size={14} />
            </button>
            <button
              onClick={toggleFab}
              className="flex items-center justify-center size-7 rounded-field transition-colors text-text-muted hover:bg-surface-hover hover:text-text-primary"
              aria-label="Đóng chat"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* History view */}
        {showHistory && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-[var(--s-md)]">
              <h4 className="text-xs font-semibold text-text-secondary mb-[var(--s-sm)]">Lịch sử chat</h4>
              {aiRouter.getThreads().length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">Chưa có lịch sử chat</p>
              ) : (
                <div className="space-y-1">
                  {aiRouter.getThreads().map((t: ChatThread) => (
                    <div key={t.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => {
                          const msgs = aiRouter.switchThread(t.id);
                          setMessages(msgs.length > 0
                            ? msgs.map((m, i) => ({ id: `hist-${i}`, role: m.role as "user" | "ai", text: m.content }))
                            : [{ id: "welcome", role: "ai" as const, text: "Xin chào! Tiếp tục chat từ lịch sử." }]);
                          setShowHistory(false);
                        }}
                        className="flex-1 text-left px-[var(--s-sm)] py-[var(--s-xs)] rounded-field text-xs text-text-primary hover:bg-surface-hover transition-colors truncate"
                      >
                        <span className="block truncate">{t.title || 'Cuộc trò chuyện'}</span>
                        <span className="text-[10px] text-text-muted">{new Date(t.createdAt).toLocaleDateString('vi-VN')}</span>
                      </button>
                      <button
                        onClick={() => aiRouter.deleteThread(t.id)}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center size-6 rounded text-text-muted hover:text-danger-fg hover:bg-danger-bg transition-all"
                        aria-label="Xóa"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main chat content */}
        {!showHistory && (
          <>
            {/* Model loading — show full-screen loading, hide everything else */}
            {webLLM.isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-[var(--s-xl)]">
                <Loader2 size={32} className="animate-spin text-accent-fg mb-4" />
                <p className="text-sm font-semibold text-text-primary mb-2">Đang tải AI offline</p>
                <div className="w-48 h-2 bg-surface-hover rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-accent-fg rounded-full transition-all duration-300"
                    style={{ width: `${modelProgress}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted">{modelProgress}% — {modelStatus}</p>
                <p className="text-[11px] text-text-muted mt-3 text-center max-w-[240px]">
                  Lần đầu ~2.7GB, lưu trong trình duyệt. Có thể dùng Gemini Cloud trong lúc chờ (vào Cài đặt → nhập API key).
                </p>
              </div>
            ) : (
              <>
                {/* Quick action chips */}
                <div className="flex flex-wrap gap-[var(--s-xs)] px-[var(--s-md)] py-[var(--s-sm)] border-b border-border-subtle">
          {QUICK_ACTIONS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              disabled={isTyping}
              className={[
                "text-xs px-[var(--s-sm)] py-1 rounded-badge",
                "bg-accent-bg text-accent-fg",
                "font-medium",
                "transition-colors duration-[var(--d-fast)]",
                "hover:bg-accent-bg-hover",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Model loading indicator */}
        {webLLM.isLoading && (
          <div className="mx-[var(--s-md)] mt-[var(--s-sm)] p-[var(--s-md)] rounded-panel bg-surface border border-border">
            <div className="flex items-center gap-[var(--s-sm)] mb-[var(--s-xs)]">
              <Loader2 size={14} className="animate-spin text-accent-fg" />
              <span className="text-xs text-text-primary font-medium">Đang tải model AI offline</span>
              <span className="text-xs text-text-muted ml-auto">{modelProgress}%</span>
            </div>
            <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-fg rounded-full transition-all duration-300"
                style={{ width: `${modelProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted mt-[var(--s-xs)]">{modelStatus}</p>
            <p className="text-[10px] text-text-muted mt-1">
              Lần đầu tải ~2.7GB. Bạn vẫn có thể dùng Gemini Cloud (nếu đã cấu hình API key trong Cài đặt).
            </p>
          </div>
        )}

        {/* Chat messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-[var(--s-md)] py-[var(--s-sm)] flex flex-col gap-[var(--s-sm)]"
          role="log"
          aria-label="Chat messages"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={[
                "max-w-[85%] rounded-panel px-[var(--s-md)] py-[var(--s-sm)] text-xs",
                msg.role === "user"
                  ? "bg-accent-fg text-white ml-auto"
                  : "bg-surface border border-border text-text-primary mr-auto",
              ].join(" ")}
            >
              {msg.role === "user" ? (
                msg.text
              ) : (
                <MarkdownText text={msg.text} />
              )}
              {msg.source && (
                <div className="mt-1 text-[10px] text-text-muted">
                  {msg.source === "cloud"
                    ? "🟢 Gemini Cloud"
                    : "🟡 WebLLM (offline)"}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="mr-auto bg-surface border border-border rounded-panel px-[var(--s-md)] py-[var(--s-sm)]">
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-accent-fg" />
                <span className="text-xs text-text-muted">Đang suy luận...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-[var(--s-sm)] border-t border-border bg-surface">
          <div className="flex items-center gap-[var(--s-xs)]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Nhập câu hỏi..."
              className={[
                "flex-1 bg-input-bg",
                "border border-input-border",
                "rounded-field",
                "px-[var(--s-sm)] py-1 text-xs",
                "text-text-primary",
                "placeholder:text-text-muted",
                "focus:outline-none focus:ring-2 focus:ring-input-focus-ring",
              ].join(" ")}
              aria-label="Chat message input"
              disabled={isTyping}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className={[
                "shrink-0",
                "flex items-center justify-center",
                "size-7 rounded-field",
                "transition-colors duration-[var(--d-fast)]",
                input.trim() && !isTyping
                  ? "bg-accent-fg text-white hover:bg-accent-fg-hover"
                  : "bg-surface-active text-text-disabled",
              ].join(" ")}
              aria-label="Send message"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
          </>
            )}
          </>
        )}
      </div>
    </>
  );
}
