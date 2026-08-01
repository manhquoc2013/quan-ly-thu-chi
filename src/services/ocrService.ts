/**
 * OCR service — Gemini Vision preferred, Tesseract.js fallback.
 * PDF: first page via pdfjs-dist → image → OCR.
 */

import { createWorker } from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';
import { geminiService } from './geminiService';
import { guessCategory } from './textDraftParser';
import { extractMoneyFromText } from './amountParser';
import {
  newDraftId,
  todayIso,
  validateDraft,
  type DraftRecord,
} from './draftTypes';

// Vite worker for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function pdfFirstPageToJpegBase64(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không tạo được canvas cho PDF');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  return dataUrl.split(',')[1] ?? '';
}

export async function ocrFileToDraft(file: File): Promise<{
  draft?: DraftRecord;
  error?: string;
  engine: 'gemini' | 'tesseract';
}> {
  let base64: string;
  let mime: string = file.type || 'image/jpeg';

  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      base64 = await pdfFirstPageToJpegBase64(file);
      mime = 'image/jpeg';
    } else {
      base64 = await fileToBase64(file);
    }
  } catch (err) {
    return {
      engine: 'tesseract',
      error: `Không đọc được file: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }

  if (geminiService.isConfigured && navigator.onLine) {
    try {
      const result = await geminiService.ocrInvoice(base64);
      if (result && result.amount > 0) {
        const draft = validateDraft({
          id: newDraftId(),
          kind: 'expense',
          date: result.date || todayIso(),
          amount: result.amount,
          description: result.description || result.supplier || 'Hóa đơn',
          category: guessCategory(result.description || result.supplier || ''),
          source: 'ocr',
          ocrEngine: 'gemini',
          confidence: 0.85,
        });
        return { draft, engine: 'gemini' };
      }
    } catch {
      // fall through to tesseract
    }
  }

  try {
    const draft = await tesseractOcr(base64, mime);
    if (!draft) {
      return {
        engine: 'tesseract',
        error: 'Không đọc được ảnh — thử ảnh rõ hơn hoặc cấu hình Gemini API key',
      };
    }
    return { draft, engine: 'tesseract' };
  } catch (err) {
    return {
      engine: 'tesseract',
      error: `OCR lỗi: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

async function tesseractOcr(base64: string, mime: string): Promise<DraftRecord | null> {
  const worker = await createWorker('vie+eng');
  try {
    const { data } = await worker.recognize(`data:${mime};base64,${base64}`);
    const text = data.text || '';
    if (!text.trim()) return null;

    const money = extractMoneyFromText(text);
    const amount = money?.amountVnd ?? 0;
    const dateMatch = text.match(/(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})/);
    let date = todayIso();
    if (dateMatch) {
      const parts = dateMatch[1]!.split(/[\/.]/);
      if (parts.length === 3) {
        let y = parts[2]!;
        if (y.length === 2) y = `20${y}`;
        date = `${y}-${parts[1]!.padStart(2, '0')}-${parts[0]!.padStart(2, '0')}`;
      }
    }

    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const description = lines.find((l) => l.length > 3 && !/^\d+$/.test(l)) || 'Hóa đơn OCR';

    return validateDraft({
      id: newDraftId(),
      kind: 'expense',
      date,
      amount,
      description: description.slice(0, 200),
      category: guessCategory(description),
      source: 'ocr',
      ocrEngine: 'tesseract',
      confidence: 0.45,
    });
  } finally {
    await worker.terminate();
  }
}
