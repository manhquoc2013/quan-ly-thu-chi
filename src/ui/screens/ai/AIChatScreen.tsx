/**
 * AIChatScreen — Full-page AI chat interface.
 *
 * Displays:
 * - AI status banner at top (dynamic readiness indicator)
 * - Chat message list (user right-aligned, AI left-aligned)
 * - Loading indicator when AI is "thinking"
 * - Input area at bottom with send button
 * - AI responses via aiRouter (WebLLM local / Gemini Cloud)
 */

import { useState, useRef, useEffect } from "react";
import { Panel } from "@components/Panel";
import { Send, Loader2 } from "lucide-react";
import { aiRouter } from "@/services/aiRouter";
import { getAllExpenses } from "@/services/expenseService";
import { webLLM } from "@/services/webLLM";
import { MarkdownText } from "@components/MarkdownText";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: Date;
  source?: "local" | "cloud";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AIChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Xin chào! Tôi là trợ lý AI của hệ thống Quản lý thu chi. Tôi có thể giúp bạn phân tích chi phí, doanh thu, lợi nhuận hoặc đưa ra dự báo. Bạn cần tôi hỗ trợ gì?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const sendingRef = useRef(false);
  const [aiReady, setAiReady] = useState<boolean>(aiRouter.isConfigured);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  // Keep the readiness indicator in sync while the WebLLM model downloads
  useEffect(() => {
    if (aiReady) return;
    const timer = setInterval(() => {
      setAiReady(aiRouter.isConfigured);
    }, 2000);
    return () => clearInterval(timer);
  }, [aiReady]);

  // Poll model loading progress
  useEffect(() => {
    if (webLLM.isLoaded) return;
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
  }, []);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await aiRouter.sendMessage(trimmed);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: result.text,
        timestamp: new Date(),
        source: result.source,
      };
      setMessages((prev) => [...prev, aiMsg]);

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
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsTyping(false);
      sendingRef.current = false;
      setAiReady(aiRouter.isConfigured);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* AI status banner */}
      <div className="px-[var(--s-md)] py-[var(--s-sm)] bg-info-banner border-b border-border-subtle">
        <div className="flex items-center gap-[var(--s-xs)]">
          <span className="text-sm">🤖</span>
          <span className="text-xs text-info-fg">
            {webLLM.isLoading
              ? `🔄 Đang tải model offline (${modelProgress}%) — chat bằng Gemini nếu có API key`
              : aiReady
                ? "🟢 AI Assistant sẵn sàng — Phân tích tài chính tự động."
                : "🟡 Đang khởi tạo AI — đợi model WebLLM tải xong hoặc cấu hình Gemini API key trong Cài đặt."}
          </span>
        </div>
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
            Lần đầu tải ~1.6GB, lưu trong bộ nhớ trình duyệt. Chat được khi tải xong.
          </p>
        </div>
      )}

      {/* Chat messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-[var(--s-md)] flex flex-col gap-[var(--s-sm)]"
        role="log"
        aria-label="Chat messages"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={[
              "max-w-[80%] rounded-panel px-[var(--s-md)] py-[var(--s-sm)] text-sm",
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
      <div className="p-[var(--s-md)] border-t border-border bg-surface">
        <Panel style="translucent">
          <div className="flex items-center gap-[var(--s-xs)]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi..."
              className={[
                "flex-1 bg-transparent text-sm",
                "text-text-primary",
                "placeholder:text-text-muted",
                "focus:outline-none",
              ].join(" ")}
              aria-label="Chat message input"
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className={[
                "shrink-0",
                "flex items-center justify-center",
                "size-8 rounded-field",
                "transition-colors duration-[var(--d-fast)]",
                input.trim() && !isTyping
                  ? "bg-accent-fg text-white hover:bg-accent-fg-hover"
                  : "bg-surface-active text-text-disabled",
              ].join(" ")}
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
