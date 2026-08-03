import { afterEach, describe, expect, it, vi } from 'vitest';
import { kiloService } from './kiloService';

describe('kiloService', () => {
  afterEach(() => {
    kiloService.setEnabled(true);
    kiloService.configure(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when disabled', async () => {
    kiloService.setEnabled(false);
    expect(await kiloService.generateContent('hello')).toBeNull();
  });

  it('parses chat completion content from gateway', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            model: 'kilo-auto/free',
            choices: [{ message: { content: '{"intent":"chat"}' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    const text = await kiloService.generateContent('ping');
    expect(text).toBe('{"intent":"chat"}');
    expect(fetch).toHaveBeenCalled();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toMatch(/\/chat\/completions$/);
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('kilo-auto/free');
  });

  it('returns null on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limit', { status: 429 })),
    );
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    expect(await kiloService.generateContent('ping')).toBeNull();
  });
});
