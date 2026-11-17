import DOMPurify from 'dompurify';
import { renderMarkdownToHtml, type MarkedLike } from '../services/openrouter';

declare global {
  interface Window {
    marked?: MarkedLike & { setOptions?: (opts: Record<string, unknown>) => void };
    renderMathInElement?: (
      el: HTMLElement,
      options?: {
        delimiters?: Array<{ left: string; right: string; display: boolean }>;
        throwOnError?: boolean;
      }
    ) => void;
  }
}

let markedConfigured = false;

export function ensureMarkedConfigured(): void {
  if (markedConfigured) return;
  if (typeof window !== 'undefined' && window.marked && typeof window.marked.setOptions === 'function') {
    window.marked.setOptions({
      gfm: true,
      breaks: true,
    });
    markedConfigured = true;
  }
}

export function renderMarkdownWithKaTeX(targetEl: HTMLElement | null, mdText: string): void {
  if (!targetEl) return;
  ensureMarkedConfigured();
  const safeHtml = renderMarkdownToHtml(mdText, window.marked || null, DOMPurify);
  targetEl.innerHTML = DOMPurify.sanitize(safeHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });
  if (typeof window.renderMathInElement === 'function') {
    try {
      window.renderMathInElement(targetEl, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    } catch {
      // Keep restored text gracefully if KaTeX throws on malformed input
    }
  }
}

export function sanitizeInlineHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });
}
