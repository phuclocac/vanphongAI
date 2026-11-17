import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import {
  AGENTS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HALL_AGENTS,
  getAgentRoleForMode,
  type AgentId,
  type AgentStatus,
  type WorkModeId,
} from '../core/workModes';
import { formatTokenCount } from '../services/openrouter';
import type { ErrorType } from '../types/office';
import { renderMarkdownWithKaTeX } from '../utils/markdownRenderer';

interface MarkdownProseProps {
  markdown: string;
}

function MarkdownProse({ markdown }: MarkdownProseProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    renderMarkdownWithKaTeX(containerRef.current, markdown);
  }, [markdown]);

  return <div ref={containerRef} className="prose-report" />;
}

interface ReportSectionsProps {
  mode: WorkModeId;
  statuses: Record<AgentId, AgentStatus>;
  outputs: Record<AgentId, string>;
  actualModels: Record<AgentId, string>;
  usedModels: Record<AgentId, string>;
  agentModels: Record<AgentId, string>;
  fallbackNotices?: Partial<Record<AgentId, string>>;
  tokenCounts: Record<AgentId, number>;
  errors: Record<AgentId, string>;
  errorTypes: Record<AgentId, ErrorType>;
  errorLabels: Record<AgentId, string>;
  retryStatus: Record<AgentId, string>;
  followupDraft: string;
  onFollowupDraftChange: (value: string) => void;
  onSubmitFollowup: (value: string) => void;
  isRunning: boolean;
  isFollowupRunning: boolean;
  focusRequest: { agentId: AgentId; nonce: number } | null;
  reportScrollRef: RefObject<HTMLDivElement | null>;
  followupInputRef: RefObject<HTMLInputElement | null>;
}

export function ReportSections({
  mode,
  statuses,
  outputs,
  actualModels,
  usedModels,
  agentModels,
  fallbackNotices = {},
  tokenCounts,
  errors,
  errorTypes,
  errorLabels,
  retryStatus,
  followupDraft,
  onFollowupDraftChange,
  onSubmitFollowup,
  isRunning,
  isFollowupRunning,
  focusRequest,
  reportScrollRef,
  followupInputRef,
}: ReportSectionsProps) {
  const [manualOpenMap, setManualOpenMap] = useState<Partial<Record<AgentId, boolean>>>({});

  const timeoutSec = Math.max(1, Math.round(DEFAULT_REQUEST_TIMEOUT_MS / 1000));
  const hasAnyOutput = AGENTS.some((a) => Boolean(outputs[a.id]));
  const assistantStatus = statuses.assistant;
  const showEmpty = !hasAnyOutput && assistantStatus !== 'active' && assistantStatus !== 'error';

  const execOutput = outputs.assistant;
  const assistantRole = getAgentRoleForMode(mode, 'assistant');
  const execFallbackNotice = (fallbackNotices.assistant || '').trim();
  const execModel = actualModels.assistant || usedModels.assistant || agentModels.assistant || '';
  const execTokens = Number(tokenCounts.assistant) || 0;

  const hallWithData = HALL_AGENTS.filter(
    (a) => Boolean(outputs[a.id]) || statuses[a.id] === 'error'
  );

  // Reset manual open overrides when a fresh Executive Summary starts/completes or new task starts
  useEffect(() => {
    setManualOpenMap({});
  }, [Boolean(execOutput)]);

  // Scroll smoothly and expand targeted agent <details> on click from 3D desk / AgentCard
  useEffect(() => {
    if (!focusRequest) return;
    const { agentId } = focusRequest;
    if (agentId !== 'assistant') {
      setManualOpenMap((prev) => ({ ...prev, [agentId]: true }));
    }
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`report-section-${agentId}`);
      const scrollEl = reportScrollRef.current;
      if (el && scrollEl) {
        const scrollRect = scrollEl.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetTop = scrollEl.scrollTop + (elRect.top - scrollRect.top) - 10;
        scrollEl.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, [focusRequest, reportScrollRef]);

  const handleFollowupSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmitFollowup(followupDraft);
  };

  return (
    <>
      <div id="report-empty-state" className={showEmpty ? 'py-6 px-3 text-center space-y-3' : 'hidden'}>
        <div className="w-11 h-11 mx-auto rounded-xl bg-amber-500/10 border border-amber-400/25 flex items-center justify-center text-amber-300">
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-200">Sẵn sàng nhận chỉ thị điều hành</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
          Chọn chế độ làm việc phù hợp, tùy chỉnh model hoặc nội quy riêng từng bàn nếu cần, rồi nhấn{' '}
          <strong className="text-slate-200">Bắt đầu</strong> để vận hành 3 nhịp (1 → 2 → 2).
        </p>
      </div>

      <div id="report-sections" className={showEmpty ? 'hidden' : 'space-y-3.5'}>
        {(execOutput || assistantStatus === 'active' || assistantStatus === 'error') && (
          <>
            <section
              id="report-section-assistant"
              className="rounded-xl bg-gradient-to-b from-amber-950/35 to-slate-900/90 border border-amber-500/45 p-3.5 space-y-2.5 shadow-lg"
            >
              <header className="flex items-center justify-between gap-2 pb-2 border-b border-amber-500/25">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-amber-400" />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-amber-200 truncate">
                      Báo cáo Điều hành — {assistantRole.name}
                    </h3>
                    <p className="text-[11px] text-slate-300 truncate">{assistantRole.titleVi}</p>
                    {(execModel || execFallbackNotice || execTokens > 0) && (
                      <p className="text-[10px] font-mono tabular-nums text-amber-300/85 truncate mt-0.5">
                        {execFallbackNotice ? execFallbackNotice : execModel}
                        {(execFallbackNotice || execModel) && execTokens > 0 ? ' · ' : ''}
                        {execTokens > 0 ? formatTokenCount(execTokens) : ''}
                      </p>
                    )}
                  </div>
                </div>

                {assistantStatus === 'active' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 shrink-0">
                    <svg className="w-3.5 h-3.5 spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    {retryStatus.assistant || 'Đang tổng hợp...'}
                  </span>
                ) : assistantStatus === 'error' ? (
                  <span className="text-[11px] font-semibold text-red-400 shrink-0">
                    {errorLabels.assistant || 'Lỗi tổng hợp'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 shrink-0">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Executive Summary
                  </span>
                )}
              </header>

              {execOutput ? (
                <>
                  {execFallbackNotice && (
                    <div
                      data-report-fallback-banner="assistant"
                      className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200"
                    >
                      Tạo bởi <strong>{execFallbackNotice}</strong>
                    </div>
                  )}
                  <MarkdownProse markdown={execOutput} />
                </>
              ) : assistantStatus === 'active' ? (
                <div className="prose-report">
                  <p className="text-xs text-amber-200/85">
                    Đang đọc báo cáo của 4 bàn, đối chiếu mâu thuẫn và chắt lọc khuyến nghị cho CEO Phúc...
                  </p>
                </div>
              ) : (
                <div className="prose-report">
                  <p className="text-xs text-red-300">
                    {errors.assistant || 'Không thể tổng hợp Báo cáo Điều hành.'}
                  </p>
                </div>
              )}
            </section>

            {execOutput && (
              <form
                id="assistant-followup-form"
                onSubmit={handleFollowupSubmit}
                className="rounded-xl bg-slate-900/85 border border-amber-400/30 p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <input
                  ref={followupInputRef}
                  id="assistant-followup-input"
                  type="text"
                  autoComplete="off"
                  value={followupDraft}
                  disabled={isRunning || isFollowupRunning}
                  onChange={(e) => onFollowupDraftChange(e.target.value)}
                  placeholder="Yêu cầu Thư ký chỉnh sửa, đào sâu hoặc hỏi thêm về báo cáo này..."
                  aria-label="Yêu cầu Thư ký chỉnh sửa hoặc hỏi thêm về báo cáo"
                  className="flex-1 min-w-0 bg-slate-950/85 border border-white/10 focus:border-amber-400/70 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
                />
                <button
                  id="assistant-followup-submit"
                  type="submit"
                  disabled={isRunning || isFollowupRunning}
                  className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 transition-colors whitespace-nowrap disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {isFollowupRunning ? 'Đang cập nhật...' : 'Cập nhật báo cáo'}
                </button>
              </form>
            )}
          </>
        )}

        {hallWithData.length > 0 && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 pt-1 px-0.5">
              Chi tiết từng bàn chuyên môn (nhấn để mở rộng)
            </div>

            {hallWithData.map((agent) => {
              const role = getAgentRoleForMode(mode, agent.id);
              const content = outputs[agent.id];
              const status = statuses[agent.id];
              const modelLabel =
                actualModels[agent.id] || usedModels[agent.id] || agentModels[agent.id] || '';
              const agentFallbackNotice = (fallbackNotices[agent.id] || '').trim();
              const agentTokens = Number(tokenCounts[agent.id]) || 0;
              const isOpen =
                manualOpenMap[agent.id] !== undefined
                  ? Boolean(manualOpenMap[agent.id])
                  : !execOutput || status === 'error';

              return (
                <details
                  key={agent.id}
                  id={`report-section-${agent.id}`}
                  data-report-details={agent.id}
                  open={isOpen}
                  onToggle={(e) => {
                    const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
                    setManualOpenMap((prev) => ({ ...prev, [agent.id]: nextOpen }));
                  }}
                  className={
                    status === 'error'
                      ? 'rounded-xl bg-red-950/35 border border-red-500/45 overflow-hidden'
                      : 'rounded-xl bg-slate-900/75 border border-white/10 overflow-hidden'
                  }
                >
                  <summary className="cursor-pointer select-none px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        className="details-chevron w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: agent.colorHex }} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate">
                          {agent.step}. {role.name}{' '}
                          <span className="font-normal text-slate-400">· {role.titleVi}</span>
                        </div>
                        {(modelLabel || agentFallbackNotice || agentTokens > 0) && (
                          <div
                            className={`text-[10px] font-mono tabular-nums truncate ${
                              agentFallbackNotice ? 'text-amber-300' : 'text-blue-300/90'
                            }`}
                          >
                            {agentFallbackNotice ? agentFallbackNotice : modelLabel}
                            {(agentFallbackNotice || modelLabel) && agentTokens > 0 ? ' · ' : ''}
                            {agentTokens > 0 ? formatTokenCount(agentTokens) : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        status === 'error' ? 'text-red-400' : 'text-emerald-400'
                      } shrink-0`}
                    >
                      {status === 'error' ? (
                        errorLabels[agent.id] ||
                        (errorTypes[agent.id] === 'timeout' ? `Lỗi Timeout >${timeoutSec}s` : 'Lỗi API')
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Xong
                        </>
                      )}
                    </span>
                  </summary>

                  <div className="px-3.5 pb-3.5 pt-2 border-t border-white/10 space-y-2">
                    {agentFallbackNotice && content && (
                      <div
                        data-report-fallback-banner={agent.id}
                        className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200"
                      >
                        Tạo bởi <strong>{agentFallbackNotice}</strong>
                      </div>
                    )}
                    {content ? (
                      <MarkdownProse markdown={content} />
                    ) : (
                      <div className="prose-report">
                        <p className="text-xs text-red-300">
                          {errors[agent.id] || 'Bàn này gặp lỗi API.'}
                        </p>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
