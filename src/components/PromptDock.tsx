import { useEffect, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';

interface PromptDockProps {
  promptValue: string;
  onPromptChange: (value: string) => void;
  onSubmitTask: () => void;
  isRunning: boolean;
  submitLabel: string;
  errorMessage: string;
  onDismissError: () => void;
  cinemaMode: boolean;
  tickerMessage: string;
  promptInputRef: RefObject<HTMLTextAreaElement | null>;
}

export function PromptDock({
  promptValue,
  onPromptChange,
  onSubmitTask,
  isRunning,
  submitLabel,
  errorMessage,
  onDismissError,
  cinemaMode,
  tickerMessage,
  promptInputRef,
}: PromptDockProps) {
  const [typedText, setTypedText] = useState<string>(tickerMessage);

  useEffect(() => {
    if (!cinemaMode) {
      setTypedText(tickerMessage);
      return;
    }
    setTypedText('');
    let len = 0;
    const timer = window.setInterval(() => {
      len += 1;
      setTypedText(tickerMessage.slice(0, len));
      if (len >= tickerMessage.length) {
        window.clearInterval(timer);
      }
    }, 22);
    return () => window.clearInterval(timer);
  }, [cinemaMode, tickerMessage]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmitTask();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmitTask();
    }
  };

  return (
    <footer className="fixed bottom-4 left-4 right-4 z-30 pointer-events-none flex flex-col items-center">
      <div className="w-full max-w-xl lg:max-w-[clamp(340px,calc(100vw-936px),520px)] space-y-2 pointer-events-auto">
        {/* Live Neural Ticker (Visible in Cinema Mode, docked cleanly above prompt bar) */}
        <div
          id="live-neural-ticker"
          role="status"
          aria-live="polite"
          className="hidden items-center gap-2.5 glass-panel rounded-xl px-3.5 py-2 border border-cyan-400/40 shadow-2xl"
        >
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-cyan-300 shrink-0">
            Live Neural Ticker
          </span>
          <span className="text-slate-500 shrink-0" aria-hidden="true">
            ·
          </span>
          <p className="text-[11.5px] font-mono text-slate-100 truncate min-w-0">
            <span id="neural-ticker-text">{typedText}</span>
            <span className="ticker-caret" aria-hidden="true" />
          </p>
        </div>

        {/* Error / Validation Banner */}
        <div
          id="error-banner"
          role="alert"
          className={`${
            errorMessage ? 'flex' : 'hidden'
          } glass-panel rounded-xl px-3.5 py-2.5 border-red-500/40 bg-red-950/85 text-red-100 text-xs items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <svg
              className="w-4 h-4 text-red-400 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span id="error-banner-text" className="leading-snug">
              {errorMessage}
            </span>
          </div>
          <button
            id="dismiss-error-btn"
            type="button"
            aria-label="Đóng thông báo lỗi"
            onClick={onDismissError}
            className="text-red-300 hover:text-white shrink-0 px-1.5 py-0.5 rounded text-xs"
          >
            Đóng
          </button>
        </div>

        {/* Main Input Bar */}
        <form
          id="task-form"
          onSubmit={handleSubmit}
          className="glass-panel hud-gold-panel rounded-2xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="flex-1">
            <textarea
              ref={promptInputRef}
              id="prompt-input"
              rows={2}
              value={promptValue}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Yêu cầu, mục tiêu hoặc vấn đề cần xử lý"
              placeholder="Nhập yêu cầu, mục tiêu hoặc vấn đề cần xử lý..."
              className="w-full resize-none bg-slate-950/75 border border-white/10 focus:border-amber-400/70 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors leading-relaxed"
            />
          </div>
          <div className="flex items-center shrink-0">
            <button
              id="submit-task-btn"
              type="submit"
              disabled={isRunning}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:from-amber-600 active:to-amber-500 disabled:opacity-50 disabled:pointer-events-none text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span id="submit-btn-text">{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </footer>
  );
}
