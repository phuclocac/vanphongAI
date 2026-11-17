import { useState, type ReactNode } from 'react';
import {
  DEFAULT_AGENT_MODELS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  SUGGESTED_MODELS,
  getAgentRoleForMode,
  getDefaultSystemPrompt,
  resolveAgentSystemPrompt,
  type AgentDefinition,
  type AgentId,
  type AgentStatus,
  type SavedSystemPromptsMap,
  type WorkModeId,
} from '../core/workModes';
import { formatTokenCount } from '../services/openrouter';
import type { ErrorType } from '../types/office';

interface AgentCardProps {
  agent: AgentDefinition;
  mode: WorkModeId;
  status: AgentStatus;
  retryStatus: string;
  errorType: ErrorType;
  errorLabel: string;
  errorFull: string;
  actualModel: string;
  fallbackNotice?: string;
  tokenCount: number;
  hasOutput: boolean;
  selectedModel: string;
  ownApiKey: string;
  savedSystemPrompts: SavedSystemPromptsMap;
  isPipelineRunning: boolean;
  isFollowupRunning: boolean;
  isAgentRunning: boolean;
  hasAnyHallOutput: boolean;
  hasLastTopic: boolean;
  onFocusSection: (agentId: AgentId) => void;
  onModelChange: (agentId: AgentId, modelId: string) => void;
  onOwnKeyChange: (agentId: AgentId, apiKey: string) => void;
  onSystemPromptChange: (agentId: AgentId, prompt: string) => void;
  onResetSystemPrompt: (agentId: AgentId) => void;
  onRerunAgent: (agentId: AgentId) => void;
  onSynthesizeAssistant: () => void;
  registerModelInputRef: (agentId: AgentId, el: HTMLInputElement | null) => void;
  registerKeyInputRef: (agentId: AgentId, el: HTMLInputElement | null) => void;
}

const SUGGESTED_MODEL_IDS = new Set(SUGGESTED_MODELS.map((m) => m.id));

export function AgentCard({
  agent,
  mode,
  status,
  retryStatus,
  errorType,
  errorLabel,
  errorFull,
  actualModel,
  fallbackNotice = '',
  tokenCount,
  hasOutput,
  selectedModel,
  ownApiKey,
  savedSystemPrompts,
  isPipelineRunning,
  isFollowupRunning,
  isAgentRunning,
  hasAnyHallOutput,
  hasLastTopic,
  onFocusSection,
  onModelChange,
  onOwnKeyChange,
  onSystemPromptChange,
  onResetSystemPrompt,
  onRerunAgent,
  onSynthesizeAssistant,
  registerModelInputRef,
  registerKeyInputRef,
}: AgentCardProps) {
  const [showOwnKey, setShowOwnKey] = useState(false);

  const isAssistant = agent.id === 'assistant';
  const roleMeta = getAgentRoleForMode(mode, agent.id);
  const currentModel = selectedModel || DEFAULT_AGENT_MODELS[agent.id];
  const selectValue = SUGGESTED_MODEL_IDS.has(currentModel.trim()) ? currentModel.trim() : '__custom__';
  const resolvedSysPrompt = resolveAgentSystemPrompt(mode, agent.id, savedSystemPrompts);
  const defaultSysPrompt = getDefaultSystemPrompt(mode, agent.id);
  const isCustomizedPrompt = resolvedSysPrompt !== defaultSysPrompt;

  const timeoutSec = Math.max(1, Math.round(DEFAULT_REQUEST_TIMEOUT_MS / 1000));
  const shortBadgeErr =
    errorType === 'timeout' ? `Timeout >${timeoutSec}s` : errorLabel ? errorLabel.split(':')[0] : 'Lỗi API';
  const detailedCardErr =
    errorLabel ||
    (errorType === 'timeout'
      ? `Lỗi Timeout >${timeoutSec}s`
      : errorType === 'network'
        ? 'Lỗi mạng: Không thể kết nối'
        : 'Lỗi API không xác định');

  const trimmedActual = actualModel.trim();
  const trimmedFallback = fallbackNotice.trim();
  const showActualModel = Boolean(trimmedActual || trimmedFallback) && (status === 'done' || hasOutput);
  const lockInputs = isPipelineRunning || isFollowupRunning || isAgentRunning;

  const cardClass = isAssistant
    ? `sm:col-span-2 rounded-xl px-2.5 py-2 border transition-colors flex flex-col gap-1.5 ${
        status === 'active'
          ? 'bg-amber-950/45 border-amber-400/75'
          : status === 'done'
            ? 'bg-amber-950/25 border-emerald-500/45 hover:border-emerald-400/65'
            : status === 'error'
              ? 'bg-red-950/50 border-red-500/55'
              : 'bg-amber-950/15 border-amber-500/25'
      }`
    : `rounded-xl px-2.5 py-2 border transition-colors flex flex-col gap-1.5 ${
        status === 'active'
          ? 'bg-slate-800/90 border-blue-500/60'
          : status === 'done'
            ? 'bg-slate-900/80 border-emerald-500/40 hover:border-emerald-400/60'
            : status === 'error'
              ? 'bg-red-950/50 border-red-500/55'
              : 'bg-slate-900/45 border-white/10'
      }`;

  let statusSlotNode: ReactNode = (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-indigo-300/90">
      <svg
        className="w-3 h-3 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
      Đang ngủ
    </span>
  );

  if (status === 'active') {
    statusSlotNode = retryStatus ? (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-300">
        <svg className="w-3 h-3 spin-icon shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        {retryStatus}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-blue-300">
        <svg className="w-3 h-3 text-blue-400 spin-icon shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Đang chạy
      </span>
    );
  } else if (status === 'done') {
    statusSlotNode = (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-400">
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Hoàn thành"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Xong
      </span>
    );
  } else if (status === 'error') {
    statusSlotNode = <span className="text-[10.5px] font-semibold text-red-400">{shortBadgeErr}</span>;
  }

  let showActionRow = false;
  let actionDisabled = false;
  let actionText = isAssistant ? 'Cập nhật tổng hợp' : 'Chạy lại';
  let actionBtnCls =
    'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-800/90 hover:bg-slate-700 border border-white/10 text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-45';
  let hintText = '';
  let hintTitle = '';
  let hintCls = 'text-[10px] text-slate-400 truncate';

  if (isAssistant) {
    const showSynthBtn = hasLastTopic && hasAnyHallOutput && !isPipelineRunning;
    if (showSynthBtn || status === 'error') {
      showActionRow = true;
      actionDisabled = isPipelineRunning || isAgentRunning || !hasAnyHallOutput;
      actionText = status === 'error' ? 'Chạy lại' : 'Cập nhật tổng hợp';
      actionBtnCls =
        status === 'error'
          ? 'shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-red-500/25 hover:bg-red-500/35 border border-red-400/50 text-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-45'
          : 'shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-45';
      hintText = status === 'error' ? detailedCardErr : 'Tổng hợp lại không cần chạy cả team';
      hintTitle = status === 'error' ? errorFull || detailedCardErr : '';
      hintCls =
        status === 'error'
          ? 'text-[10.5px] font-medium text-red-300 leading-snug break-words flex-1 min-w-0'
          : 'text-[10.5px] text-amber-200/80 truncate';
    }
  } else {
    const canRerun = !isPipelineRunning && !isAgentRunning && hasLastTopic;
    if (status === 'error') {
      showActionRow = true;
      actionDisabled = !canRerun;
      actionText = 'Chạy lại';
      actionBtnCls =
        'shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-red-500/25 hover:bg-red-500/35 border border-red-400/50 text-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-45';
      hintText = detailedCardErr;
      hintTitle = errorFull || detailedCardErr;
      hintCls = 'text-[10.5px] font-medium text-red-300 leading-snug break-words flex-1 min-w-0';
    } else if (status === 'done' && canRerun) {
      showActionRow = true;
      actionDisabled = false;
      actionText = 'Chạy lại';
      hintText = 'Đã hoàn thành';
      hintCls = 'text-[10px] text-emerald-400/90 truncate';
    } else if (status === 'idle' && canRerun) {
      showActionRow = true;
      actionDisabled = false;
      actionText = 'Chạy lại';
      hintText = 'Đang ngủ · Chưa chạy';
      hintCls = 'text-[10px] text-indigo-300/85 truncate';
    }
  }

  return (
    <div data-agent-card={agent.id} className={cardClass}>
      <button
        type="button"
        data-agent-progress={agent.id}
        onClick={() => onFocusSection(agent.id)}
        className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        <div className="flex items-center justify-between gap-1.5">
          <span
            className={`text-[11.5px] font-semibold ${
              isAssistant ? 'text-amber-200' : 'text-slate-100'
            } flex items-center gap-1.5 min-w-0`}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: agent.colorHex }} />
            <span data-agent-name className="truncate">
              {roleMeta.name}
            </span>
          </span>
          <span data-status-slot className="shrink-0 text-[10.5px] text-indigo-300/90">
            {statusSlotNode}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1.5 mt-0.5">
          <span data-agent-short-role className="text-[10.5px] text-slate-400 truncate">
            {roleMeta.shortRole}
          </span>
        </div>
        <div
          data-agent-metrics
          className={`${showActualModel || tokenCount > 0 ? 'flex' : 'hidden'} items-center justify-between gap-1.5 mt-1`}
        >
          <span
            data-agent-actual-model
            data-agent-fallback-notice={trimmedFallback ? 'true' : undefined}
            title={
              trimmedFallback
                ? trimmedFallback
                : showActualModel
                  ? `Model thực tế: ${trimmedActual}`
                  : undefined
            }
            className={`${
              showActualModel ? '' : 'hidden'
            } ${
              trimmedFallback
                ? 'truncate max-w-[148px] text-[9.5px] font-mono text-amber-200 bg-amber-500/15 border border-amber-400/45 rounded px-1.5 py-0.5'
                : 'truncate max-w-[116px] text-[9.5px] font-mono text-emerald-300/95 bg-emerald-500/10 border border-emerald-500/25 rounded px-1.5 py-0.5'
            }`}
          >
            {showActualModel ? (trimmedFallback || trimmedActual) : ''}
          </span>
          <span
            data-agent-tokens
            className={`${
              tokenCount > 0 ? '' : 'hidden'
            } shrink-0 text-[10px] font-mono tabular-nums text-amber-300/90 ml-auto`}
          >
            {formatTokenCount(tokenCount)}
          </span>
        </div>
      </button>

      {/* Model Select + Model Input + Optional Private API Key */}
      <div
        className={
          isAssistant
            ? 'pt-1.5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-1.5 cinema-hide-tech'
            : 'pt-1.5 border-t border-white/10 space-y-1 cinema-hide-tech'
        }
      >
        <select
          data-agent-model-select={agent.id}
          aria-label={`Chọn model gợi ý cho ${roleMeta.name}`}
          value={selectValue}
          disabled={lockInputs}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '__custom__') return;
            onModelChange(agent.id, val);
          }}
          className="w-full bg-slate-950/85 border border-white/10 focus:border-blue-500/80 rounded px-1.5 py-0.5 text-[10.5px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/35 cursor-pointer disabled:opacity-50"
        >
          {SUGGESTED_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value="__custom__">Tự nhập mã model...</option>
        </select>

        <input
          ref={(el) => registerModelInputRef(agent.id, el)}
          type="text"
          data-agent-model-input={agent.id}
          list="openrouter-models-list"
          aria-label={`Mã model OpenRouter cho ${roleMeta.name}`}
          autoComplete="off"
          spellCheck={false}
          placeholder="vd: openrouter/free hoặc qwen/qwen-2.5-72b-instruct:free"
          value={selectedModel}
          disabled={lockInputs}
          onChange={(e) => onModelChange(agent.id, e.target.value)}
          className="w-full bg-slate-950/75 border border-white/10 focus:border-blue-500/80 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/35 disabled:opacity-50"
        />

        <div className="relative flex items-center">
          <input
            ref={(el) => registerKeyInputRef(agent.id, el)}
            type={showOwnKey ? 'text' : 'password'}
            data-agent-api-key-input={agent.id}
            aria-label={`API Key riêng (tùy chọn) cho ${roleMeta.name}`}
            autoComplete="off"
            spellCheck={false}
            placeholder="API Key riêng (tùy chọn)"
            value={ownApiKey}
            disabled={lockInputs}
            onChange={(e) => onOwnKeyChange(agent.id, e.target.value)}
            className={`w-full bg-slate-950/75 border ${
              ownApiKey.trim() ? 'border-emerald-500/50' : 'border-white/10'
            } focus:border-blue-500/80 rounded pl-1.5 pr-6 py-0.5 text-[10px] font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/35 disabled:opacity-50`}
          />
          <button
            type="button"
            aria-label={`Hiện hoặc ẩn API Key riêng của ${roleMeta.name}`}
            onClick={() => setShowOwnKey((prev) => !prev)}
            className="absolute right-1 text-slate-400 hover:text-slate-200 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible System Prompt ("Nội quy / Chỉ thị riêng") */}
      <details data-agent-rules={agent.id} className="pt-1 border-t border-white/5 cinema-hide-tech">
        <summary className="cursor-pointer select-none flex items-center justify-between gap-1.5 py-0.5 text-[10.5px] font-medium text-slate-300 hover:text-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded">
          <span className="inline-flex items-center gap-1 min-w-0">
            <svg
              className="rules-chevron w-3 h-3 text-slate-400 shrink-0 transition-transform duration-150"
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
            <span className="truncate">Nội quy / Chỉ thị riêng</span>
          </span>
          <span
            data-rules-state
            className={
              isCustomizedPrompt
                ? 'text-[10px] font-medium text-amber-300 shrink-0'
                : 'text-[10px] text-slate-500 shrink-0'
            }
          >
            {isCustomizedPrompt ? 'Đã tùy chỉnh' : 'Mặc định'}
          </span>
        </summary>
        <div className="mt-1.5 space-y-1.5">
          <textarea
            rows={3}
            data-agent-rules-input={agent.id}
            aria-label={`Nội quy / Chỉ thị riêng cho ${roleMeta.name}`}
            placeholder="Nhập chỉ thị System Prompt riêng cho bàn này..."
            value={resolvedSysPrompt}
            disabled={lockInputs}
            onChange={(e) => onSystemPromptChange(agent.id, e.target.value)}
            className="w-full resize-y bg-slate-950/85 border border-white/10 focus:border-amber-400/70 rounded px-2 py-1.5 text-[10.5px] text-slate-200 placeholder-slate-500 leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-400/25 disabled:opacity-50"
          />
          <div className="flex items-center justify-end">
            <button
              type="button"
              data-reset-agent-rules={agent.id}
              disabled={lockInputs}
              onClick={() => onResetSystemPrompt(agent.id)}
              className="text-[10px] font-medium text-slate-400 hover:text-amber-300 underline-offset-2 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded px-1 py-0.5 disabled:opacity-45"
            >
              Khôi phục mặc định
            </button>
          </div>
        </div>
      </details>

      {/* Action row: single-agent Rerun / Update Synthesis */}
      <div className={`${showActionRow ? 'flex' : 'hidden'} pt-1 items-center justify-between gap-1.5 cinema-hide-tech`}>
        <span className={hintCls} title={hintTitle}>
          {hintText}
        </span>
        <button
          type="button"
          data-retry-agent={agent.id}
          data-synthesize-btn={isAssistant ? 'true' : undefined}
          disabled={actionDisabled}
          aria-label={isAssistant ? 'Cập nhật tổng hợp Trợ lý CEO' : `Chạy lại ${roleMeta.name}`}
          onClick={() => {
            if (isAssistant) {
              onSynthesizeAssistant();
            } else {
              onRerunAgent(agent.id);
            }
          }}
          className={actionBtnCls}
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}
