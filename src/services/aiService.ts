/**
 * AI Service — STUBBED.
 *
 * Placeholder for future AI-powered features: chat assistant,
 * expense analysis, and invoice OCR.
 *
 * To wire up: integrate with an LLM provider (e.g. OpenAI, Anthropic)
 * and an OCR engine, provide API keys, and replace stub implementations.
 */

// ── State ────────────────────────────────────────────────────────────────────

const isConfigured = false;

/**
 * Check whether the AI service is configured and ready.
 */
export function isAiConfigured(): boolean {
  return isConfigured;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiResult {
  success: boolean;
  reason: string;
  data?: unknown;
}

export interface ChatContext {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ── Public API ───────────────────────────────────────────────────────────────

export const aiService = {
  /**
   * Stub: Send a chat message with optional conversation context.
   * In production, this would call an LLM API.
   */
  async chat(_message: string, _context?: ChatContext): Promise<AiResult> {
    return { success: false, reason: 'AI service not yet configured' };
  },

  /**
   * Stub: Analyze expense data to detect patterns or anomalies.
   * In production, this would use ML or prompt-based analysis.
   * @param data - Array of expense records to analyze.
   */
  async analyzeExpenses(_data: Array<Record<string, unknown>>): Promise<AiResult> {
    return { success: false, reason: 'AI service not yet configured' };
  },

  /**
   * Stub: Extract invoice data from an image (OCR).
   * In production, this would call an OCR/API endpoint.
   * @param imageBase64 - Base64-encoded image data.
   */
  async ocrInvoice(_imageBase64: string): Promise<AiResult> {
    return { success: false, reason: 'AI service not yet configured' };
  },
};
