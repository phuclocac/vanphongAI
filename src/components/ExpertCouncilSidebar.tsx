import { useEffect, useRef, type RefObject } from 'react';
import {
  AGENTS,
  HALL_AGENTS,
  SUGGESTED_MODELS,
  getPipelineProgressPercent,
  type AgentId,
  type AgentStatus,
  type SavedSystemPromptsMap,
  type WorkModeId,
} from '../core/workModes';
import type { SessionHistoryEntry } from '../core/analytics';
import { formatTokenCount } from '../services/openrouter';
import type { ErrorType } from '../types/office';
import { AgentCard } from './AgentCard';
import { HistoryPanel } from './HistoryPanel';
import { ReportSections } from './ReportSections';

interface ExpertCouncilSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onExpandSidebar: () => void;
  mode: WorkModeId;
  statuses: Record<AgentId, AgentStatus>;
  outputs: Record<AgentId, string>;
  actualModels: Record<AgentId, string>;
  usedModels: Record<AgentId, string>;
  agentModels: Record<AgentId, string>;
  agentApiKeys: Record<AgentId, string>;
  agentSystemPrompts: SavedSystemPromptsMap;
  tokenCounts: Record<AgentId, number>;
  errors: Record<AgentId, string>;
  errorTypes: Record<AgentId, ErrorType>;
  errorLabels: Record<AgentId, string>;
  retryStatus: Record<AgentId, string>;
  isRunning: boolean;
  isFollowupRunning: boolean;
  runningAgents: AgentId[];
  lastTopic: string;
  pipelineSummary: string;
  historyOpen: boolean;
  onToggleHistory: (forceOpen?: boolean) => void;
  sessionHistory: SessionHistoryEntry[];
  currentSessionId: string;
  onSelectHistorySession: (entry: SessionHistoryEntry) => void;
  onClearHistory: () => void;
  onDownloadMd: () => void;
  onCopyReport: () => void;
  copyLabel: string;
  onFocusSection: (agentId: AgentId) => void;
  onModelChange: (agentId: AgentId, modelId: string) => void;
  onOwnKeyChange: (agentId: AgentId, apiKey: string) => void;
  onSystemPromptChange: (agentId: AgentId, prompt: string) => void;
  onResetSystemPrompt: (agentId: AgentId) => void;
  onRerunAgent: (agentId: AgentId) => void;
  onSynthesizeAssistant: () => void;
  followupDraft: string;
  onFollowupDraftChange: (value: string) => void;
  onSubmitFollowup: (value: string) => void;
  focusRequest: { agentId: AgentId; nonce: number } | null;
  followupInputRef: RefObject<HTMLInputElement | null>;
  registerModelInputRef: (agentId: AgentId, el: HTMLInputElement | null) => void;
  registerKeyInputRef: (agentId: AgentId, el: HTMLInputElement | null) => void;
  onPlayClick: () => void;
}

export function ExpertCouncilSidebar({
  collapsed,
  onToggleCollapse,
  onExpandSidebar,
  mode,
  statuses,
  outputs,
  actualModels,
  usedModels,
  agentModels,
  agentApiKeys,
  agentSystemPrompts,
  tokenCounts,
  errors,
  errorTypes,
  errorLabels,
  retryStatus,
  isRunning,
  isFollowupRunning,
  runningAgents,
  lastTopic,
  pipelineSummary,
  historyOpen,
  onToggleHistory,
  sessionHistory,
  currentSessionId,
  onSelectHistorySession,
  onClearHistory,
  onDownloadMd,
  onCopyReport,
  copyLabel,
  onFocusSection,
  onModelChange,
  onOwnKeyChange,
  onSystemPromptChange,
  onResetSystemPrompt,
  onRerunAgent,
  onSynthesizeAssistant,
  followupDraft,
  onFollowupDraftChange,
  onSubmitFollowup,
  focusRequest,
  followupInputRef,
  registerModelInputRef,
  registerKeyInputRef,
  onPlayClick,
}: ExpertCouncilSidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const reportScrollRef = useRef<HTMLDivElement | null>(null);
  const drawerWidthRef = useRef(440);

  useEffect(() => {
    const measured = sidebarRef.current?.offsetWidth || drawerRef.current?.offsetWidth;
    if (measured) {
      drawerWidthRef.current = measured;
    }
  }, [collapsed]);

  const totalTokens = AGENTS.reduce((acc, a) => acc + (Number(tokenCounts[a.id]) || 0), 0);
  const progressPct = getPipelineProgressPercent(statuses, isRunning);
  const hasAnyOutput = AGENTS.some((a) => Boolean(outputs[a.id]));
  const hasAnyHallOutput = HALL_AGENTS.some((a) => Boolean(outputs[a.id]));

  return (
    <>
      <aside
        ref={sidebarRef}
        id="report-sidebar"
        aria-label="Tiến độ nhóm chuyên gia và báo cáo"
        aria-hidden={collapsed}
        style={{ transform: collapsed ? `translateX(${drawerWidthRef.current + 24}px)` : 'translateX(0)' }}
        className={`fixed top-4 bottom-4 right-4 z-40 w-[min(440px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ease-out ${
          collapsed ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        <div
          ref={drawerRef}
          id="sidebar-drawer"
          className="glass-panel hud-gold-panel rounded-2xl w-full h-full flex flex-col overflow-hidden min-h-0"
        >
          {/* Fixed Sidebar Header */}
          <div className="px-3.5 py-2.5 border-b border-white/10 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5 sm:gap-2 min-w-0">
                <h2 className="text-[13px] sm:text-sm font-semibold text-slate-100 truncate">
                  Hội đồng Chuyên gia AI
                </h2>
                <span
                  id="session-total-tokens"
                  className="text-[11px] font-mono tabular-nums text-amber-300/90 whitespace-nowrap shrink-0"
                  title="Tổng token tiêu thụ trong phiên hiện tại"
                >
                  {formatTokenCount(totalTokens)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="history-toggle-btn"
                  type="button"
                  aria-expanded={historyOpen}
                  aria-controls="history-panel"
                  onClick={() => onToggleHistory()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-white/10 bg-slate-900/80 text-slate-200 hover:text-amber-200 hover:border-amber-400/40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                  <span>Lịch sử</span>
                  <span id="history-count-text" className="font-mono tabular-nums text-amber-300/90">
                    ({sessionHistory.length})
                  </span>
                </button>
                <button
                  id="toggle-sidebar-btn"
                  type="button"
                  aria-expanded={!collapsed}
                  aria-controls="report-sidebar"
                  aria-label="Thu gọn bảng báo cáo"
                  onClick={() => {
                    onPlayClick();
                    onToggleCollapse();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-white/10 bg-slate-900/80 text-slate-200 hover:text-amber-200 hover:border-amber-400/40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <svg
                    id="sidebar-chevron"
                    className="w-3.5 h-3.5 transition-transform duration-200"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <span id="sidebar-toggle-text">Thu gọn</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p id="pipeline-summary" className="text-[11px] text-slate-400 truncate min-w-0">
                {pipelineSummary}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="download-md-btn"
                  type="button"
                  disabled={!hasAnyOutput}
                  onClick={onDownloadMd}
                  title="Tải báo cáo xuống dạng file Markdown (.md)"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Tải .md</span>
                </button>
                <button
                  id="copy-report-btn"
                  type="button"
                  disabled={!hasAnyOutput}
                  onClick={onCopyReport}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-white/10 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span id="copy-report-label">{copyLabel}</span>
                </button>
              </div>
            </div>

            {/* Smooth Pipeline Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-900/90 border border-white/10 overflow-hidden" aria-hidden="true">
              <div
                id="pipeline-progress-bar"
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <HistoryPanel
            open={historyOpen}
            entries={sessionHistory}
            currentSessionId={currentSessionId}
            onSelectSession={onSelectHistorySession}
            onClearHistory={onClearHistory}
            onClose={() => onToggleHistory(false)}
          />

          {/* Unified Scrollable Body */}
          <div
            ref={reportScrollRef}
            id="report-scroll"
            className={`${
              historyOpen ? 'hidden' : ''
            } flex-1 overflow-y-auto min-h-0 custom-scroll p-3.5 pb-24 xl:pb-5 space-y-4`}
          >
            <datalist id="openrouter-models-list">
              {SUGGESTED_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>

            <div
              id="agent-progress-list"
              className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pb-3 border-b border-white/10"
            >
              {AGENTS.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  mode={mode}
                  status={statuses[agent.id]}
                  retryStatus={retryStatus[agent.id]}
                  errorType={errorTypes[agent.id]}
                  errorLabel={errorLabels[agent.id]}
                  errorFull={errors[agent.id]}
                  actualModel={actualModels[agent.id]}
                  tokenCount={tokenCounts[agent.id]}
                  hasOutput={Boolean(outputs[agent.id])}
                  selectedModel={agentModels[agent.id]}
                  ownApiKey={agentApiKeys[agent.id] || ''}
                  savedSystemPrompts={agentSystemPrompts}
                  isPipelineRunning={isRunning}
                  isFollowupRunning={isFollowupRunning}
                  isAgentRunning={runningAgents.includes(agent.id)}
                  hasAnyHallOutput={hasAnyHallOutput}
                  hasLastTopic={Boolean(lastTopic)}
                  onFocusSection={onFocusSection}
                  onModelChange={onModelChange}
                  onOwnKeyChange={onOwnKeyChange}
                  onSystemPromptChange={onSystemPromptChange}
                  onResetSystemPrompt={onResetSystemPrompt}
                  onRerunAgent={onRerunAgent}
                  onSynthesizeAssistant={onSynthesizeAssistant}
                  registerModelInputRef={registerModelInputRef}
                  registerKeyInputRef={registerKeyInputRef}
                />
              ))}
            </div>

            <ReportSections
              mode={mode}
              statuses={statuses}
              outputs={outputs}
              actualModels={actualModels}
              usedModels={usedModels}
              agentModels={agentModels}
              tokenCounts={tokenCounts}
              errors={errors}
              errorTypes={errorTypes}
              errorLabels={errorLabels}
              retryStatus={retryStatus}
              followupDraft={followupDraft}
              onFollowupDraftChange={onFollowupDraftChange}
              onSubmitFollowup={onSubmitFollowup}
              isRunning={isRunning}
              isFollowupRunning={isFollowupRunning}
              focusRequest={focusRequest}
              reportScrollRef={reportScrollRef}
              followupInputRef={followupInputRef}
            />
          </div>
        </div>
      </aside>

      {/* Floating Re-open Button shown only when Right Sidebar is collapsed */}
      <button
        id="expand-sidebar-btn"
        type="button"
        aria-expanded={!collapsed}
        aria-controls="report-sidebar"
        aria-label="Mở bảng báo cáo"
        onClick={() => {
          onPlayClick();
          onExpandSidebar();
        }}
        className={`${
          collapsed ? 'inline-flex' : 'hidden'
        } fixed top-4 right-4 z-30 glass-panel hud-gold-panel rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:text-amber-200 hover:border-amber-400/40 transition-colors items-center gap-1.5 whitespace-nowrap shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span>Mở báo cáo</span>
      </button>
    </>
  );
}
