import {
  AGENTS,
  DEFAULT_WORK_MODE,
  WORK_MODES,
  getModeMeta,
  getModelProvider,
  normalizeWorkMode,
  type AgentId,
  type AgentStatus,
  type ModelProvider,
  type WorkModeId,
} from './workModes';

export const ANALYTICS_MAX_RUNS = 50;

export interface SessionHistoryEntry {
  id: string;
  timestamp?: string;
  mode?: string;
  topic: string;
  outputs?: Partial<Record<AgentId, string>>;
  actualModels?: Partial<Record<AgentId, string>>;
  usedModels?: Partial<Record<AgentId, string>>;
  fallbackNotices?: Partial<Record<AgentId, string>>;
  tokenCounts?: Partial<Record<AgentId, number>>;
  [key: string]: unknown;
}

export interface AnalyticsRawEntry {
  id?: string;
  timestamp?: string;
  mode?: string;
  topic?: string;
  outputs?: Partial<Record<AgentId, string>>;
  actualModels?: Partial<Record<AgentId, string>>;
  usedModels?: Partial<Record<AgentId, string>>;
  tokenCounts?: Partial<Record<AgentId, number>>;
  agentDurations?: Partial<Record<AgentId, number>>;
  agentStatuses?: Partial<Record<AgentId, AgentStatus | string>>;
  providerTokens?: { gemini?: number; openrouter?: number };
  durationMs?: number;
  shockCount?: number;
  autoRecoveries?: number;
  errorCount?: number;
  [key: string]: unknown;
}

export interface NormalizedAnalyticsRunRecord {
  id: string;
  timestamp: string;
  mode: WorkModeId;
  topic: string;
  outputs: Partial<Record<AgentId, string>>;
  actualModels: Partial<Record<AgentId, string>>;
  usedModels: Partial<Record<AgentId, string>>;
  tokenCounts: Partial<Record<AgentId, number>>;
  agentDurations: Partial<Record<AgentId, number>>;
  agentStatuses: Record<AgentId, AgentStatus>;
  providerTokens: { gemini: number; openrouter: number };
  totalTokens: number;
  durationMs: number;
  shockCount: number;
  autoRecoveries: number;
  errorCount: number;
  completedAll5: boolean;
}

export interface AnalyticsAgentMetric {
  id: AgentId;
  step: number;
  name: string;
  shortRole: string;
  colorHex: string;
  totalTokens: number;
  avgDurationSec: number;
  successRatePct: number;
  successCount: number;
  attemptCount: number;
}

export interface AnalyticsModeDistribution {
  id: WorkModeId;
  label: string;
  count: number;
  pct: number;
  colorHex: string;
}

export interface AnalyticsModelDistribution {
  modelId: string;
  provider: ModelProvider;
  calls: number;
  tokens: number;
  pct: number;
}

export interface AnalyticsAuditRow {
  id: string;
  timestamp: string;
  topic: string;
  mode: WorkModeId;
  modeLabel: string;
  totalTokens: number;
  geminiTokens: number;
  openrouterTokens: number;
  durationMs: number;
  durationSec: number;
  shockCount: number;
  autoRecoveries: number;
  errorCount: number;
  completedAll5: boolean;
  beatStates: {
    b1: AgentStatus;
    b2q: AgentStatus;
    b2s: AgentStatus;
    b3c: AgentStatus;
    b3a: AgentStatus;
  };
  hasReportSnapshot: boolean;
}

export interface AnalyticsDashboardMetrics {
  totalSessions: number;
  completed3BeatCount: number;
  completionRatePct: number;
  totalTokens: number;
  geminiTokens: number;
  openrouterTokens: number;
  avgSessionDurationSec: number;
  avgAgentResponseSec: number;
  totalShocks: number;
  totalAutoRecoveries: number;
  totalErrors: number;
  totalModelCalls: number;
  agentMetrics: AnalyticsAgentMetric[];
  modeDistribution: AnalyticsModeDistribution[];
  modelDistribution: AnalyticsModelDistribution[];
  auditRows: AnalyticsAuditRow[];
}

export function loadSessionHistory(rawJson: string | null | undefined): SessionHistoryEntry[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SessionHistoryEntry =>
          Boolean(item) && typeof item === 'object' && typeof (item as SessionHistoryEntry).topic === 'string'
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function upsertSessionHistory<T extends { id?: unknown }>(
  historyList: T[],
  entry: T | null | undefined,
  maxItems = 10
): T[] {
  const list = Array.isArray(historyList) ? [...historyList] : [];
  if (!entry || typeof entry !== 'object') return list.slice(0, maxItems);
  const filtered = list.filter((item) => item.id !== entry.id);
  return [entry, ...filtered].slice(0, maxItems);
}

export function normalizeAnalyticsRunRecord(
  rawEntry: AnalyticsRawEntry | NormalizedAnalyticsRunRecord | null | undefined
): NormalizedAnalyticsRunRecord | null {
  if (!rawEntry || typeof rawEntry !== 'object' || typeof rawEntry.topic !== 'string') return null;
  const mode = normalizeWorkMode(rawEntry.mode);
  const outputs = rawEntry.outputs && typeof rawEntry.outputs === 'object' ? { ...rawEntry.outputs } : {};
  const actualModels =
    rawEntry.actualModels && typeof rawEntry.actualModels === 'object' ? { ...rawEntry.actualModels } : {};
  const usedModels =
    rawEntry.usedModels && typeof rawEntry.usedModels === 'object' ? { ...rawEntry.usedModels } : {};
  const tokenCounts =
    rawEntry.tokenCounts && typeof rawEntry.tokenCounts === 'object' ? { ...rawEntry.tokenCounts } : {};
  const agentDurations =
    rawEntry.agentDurations && typeof rawEntry.agentDurations === 'object'
      ? { ...rawEntry.agentDurations }
      : {};
  const agentStatuses = {} as Record<AgentId, AgentStatus>;
  AGENTS.forEach((a) => {
    const explicitStatus = rawEntry.agentStatuses?.[a.id];
    if (
      explicitStatus === 'done' ||
      explicitStatus === 'error' ||
      explicitStatus === 'idle' ||
      explicitStatus === 'active'
    ) {
      agentStatuses[a.id] = explicitStatus;
    } else {
      agentStatuses[a.id] = outputs[a.id] ? 'done' : 'idle';
    }
  });

  let geminiTokens = Number(rawEntry.providerTokens?.gemini) || 0;
  let openrouterTokens = Number(rawEntry.providerTokens?.openrouter) || 0;
  if (geminiTokens === 0 && openrouterTokens === 0) {
    AGENTS.forEach((a) => {
      const t = Number(tokenCounts[a.id]) || 0;
      if (t > 0) {
        const m = actualModels[a.id] || usedModels[a.id] || '';
        if (getModelProvider(m) === 'gemini') {
          geminiTokens += t;
        } else {
          openrouterTokens += t;
        }
      }
    });
  }

  const totalTokens = AGENTS.reduce((acc, a) => acc + (Number(tokenCounts[a.id]) || 0), 0);
  const durationMs = Math.max(0, Number(rawEntry.durationMs) || 0);
  const shockCount = Math.max(0, Number(rawEntry.shockCount) || 0);
  const autoRecoveries = Math.max(0, Number(rawEntry.autoRecoveries) || 0);
  const errorCount = Math.max(
    0,
    Number(rawEntry.errorCount) || AGENTS.filter((a) => agentStatuses[a.id] === 'error').length
  );
  const completedAll5 = AGENTS.every((a) => agentStatuses[a.id] === 'done' || Boolean(outputs[a.id]));

  return {
    id: rawEntry.id || `sess_${Date.parse(rawEntry.timestamp || '') || 0}`,
    timestamp: rawEntry.timestamp || new Date().toISOString(),
    mode,
    topic: rawEntry.topic,
    outputs,
    actualModels,
    usedModels,
    tokenCounts,
    agentDurations,
    agentStatuses,
    providerTokens: { gemini: geminiTokens, openrouter: openrouterTokens },
    totalTokens,
    durationMs,
    shockCount,
    autoRecoveries,
    errorCount,
    completedAll5,
  };
}

export function loadAnalyticsRuns(rawJson: string | null | undefined): NormalizedAnalyticsRunRecord[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeAnalyticsRunRecord(item))
      .filter((item): item is NormalizedAnalyticsRunRecord => item !== null)
      .slice(0, ANALYTICS_MAX_RUNS);
  } catch {
    return [];
  }
}

export function upsertAnalyticsRun(
  runsList: NormalizedAnalyticsRunRecord[],
  entry: AnalyticsRawEntry | NormalizedAnalyticsRunRecord | null | undefined,
  maxItems = ANALYTICS_MAX_RUNS
): NormalizedAnalyticsRunRecord[] {
  const norm = normalizeAnalyticsRunRecord(entry);
  const list = Array.isArray(runsList) ? [...runsList] : [];
  if (!norm) return list.slice(0, maxItems);
  const filtered = list.filter((item) => item && item.id !== norm.id);
  return [norm, ...filtered].slice(0, maxItems);
}

export function mergeAnalyticsSources(
  analyticsRuns: Array<AnalyticsRawEntry | NormalizedAnalyticsRunRecord> = [],
  sessionHistory: Array<AnalyticsRawEntry | SessionHistoryEntry> = [],
  liveSession: AnalyticsRawEntry | null = null
): NormalizedAnalyticsRunRecord[] {
  const byId = new Map<string, NormalizedAnalyticsRunRecord>();
  const addItem = (raw: AnalyticsRawEntry | NormalizedAnalyticsRunRecord | SessionHistoryEntry) => {
    const norm = normalizeAnalyticsRunRecord(raw);
    if (!norm) return;
    if (!byId.has(norm.id)) {
      byId.set(norm.id, norm);
    }
  };
  if (liveSession && typeof liveSession === 'object' && liveSession.topic) {
    addItem(liveSession);
  }
  (Array.isArray(analyticsRuns) ? analyticsRuns : []).forEach(addItem);
  (Array.isArray(sessionHistory) ? sessionHistory : []).forEach(addItem);
  return Array.from(byId.values()).sort(
    (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
  );
}

export function computeAnalyticsDashboardMetrics(
  runs: Array<AnalyticsRawEntry | NormalizedAnalyticsRunRecord> = []
): AnalyticsDashboardMetrics {
  const list = (Array.isArray(runs) ? runs : [])
    .map((r) => normalizeAnalyticsRunRecord(r))
    .filter((item): item is NormalizedAnalyticsRunRecord => item !== null);

  const totalSessions = list.length;
  const completed3BeatCount = list.filter((r) => r.completedAll5).length;
  const completionRatePct =
    totalSessions > 0 ? Math.round((completed3BeatCount / totalSessions) * 100) : 0;

  let totalTokens = 0;
  let geminiTokens = 0;
  let openrouterTokens = 0;
  let totalShocks = 0;
  let totalAutoRecoveries = 0;
  let totalErrors = 0;

  const sessionDurations: number[] = [];
  const allAgentDurations: number[] = [];
  const agentAcc = {} as Record<
    AgentId,
    {
      id: AgentId;
      step: number;
      name: string;
      shortRole: string;
      colorHex: string;
      totalTokens: number;
      durationSumMs: number;
      durationCount: number;
      successCount: number;
      attemptCount: number;
    }
  >;
  AGENTS.forEach((a) => {
    agentAcc[a.id] = {
      id: a.id,
      step: a.step,
      name: a.name,
      shortRole: a.shortRole,
      colorHex: a.colorHex,
      totalTokens: 0,
      durationSumMs: 0,
      durationCount: 0,
      successCount: 0,
      attemptCount: 0,
    };
  });

  const modeColors: Record<WorkModeId, string> = {
    project_plan: '#f59e0b',
    study_research: '#38bdf8',
    econ_business: '#10b981',
    general_custom: '#a855f7',
  };
  const modeCounts = {} as Record<WorkModeId, number>;
  (Object.keys(WORK_MODES) as WorkModeId[]).forEach((mId) => {
    modeCounts[mId] = 0;
  });

  const modelMap = new Map<string, { modelId: string; provider: ModelProvider; calls: number; tokens: number }>();
  let totalModelCalls = 0;

  const auditRows: AnalyticsAuditRow[] = list.map((run) => {
    totalTokens += run.totalTokens;
    geminiTokens += run.providerTokens.gemini;
    openrouterTokens += run.providerTokens.openrouter;
    totalShocks += run.shockCount;
    totalAutoRecoveries += run.autoRecoveries;
    totalErrors += run.errorCount;
    if (run.durationMs > 0) {
      sessionDurations.push(run.durationMs);
    }
    if (Object.prototype.hasOwnProperty.call(modeCounts, run.mode)) {
      modeCounts[run.mode] += 1;
    } else {
      modeCounts[DEFAULT_WORK_MODE] += 1;
    }

    AGENTS.forEach((a) => {
      const st = run.agentStatuses[a.id];
      const tk = Number(run.tokenCounts[a.id]) || 0;
      const durMs = Number(run.agentDurations[a.id]) || 0;
      const modelUsed = (run.actualModels[a.id] || run.usedModels[a.id] || '').trim();

      agentAcc[a.id].totalTokens += tk;
      if (durMs > 0) {
        agentAcc[a.id].durationSumMs += durMs;
        agentAcc[a.id].durationCount += 1;
        allAgentDurations.push(durMs);
      }
      if (st === 'done' || st === 'error') {
        agentAcc[a.id].attemptCount += 1;
        if (st === 'done') agentAcc[a.id].successCount += 1;
      }
      if (modelUsed && (st === 'done' || st === 'error' || tk > 0)) {
        totalModelCalls += 1;
        const existing = modelMap.get(modelUsed) || {
          modelId: modelUsed,
          provider: getModelProvider(modelUsed),
          calls: 0,
          tokens: 0,
        };
        existing.calls += 1;
        existing.tokens += tk;
        modelMap.set(modelUsed, existing);
      }
    });

    return {
      id: run.id,
      timestamp: run.timestamp,
      topic: run.topic,
      mode: run.mode,
      modeLabel: getModeMeta(run.mode).label,
      totalTokens: run.totalTokens,
      geminiTokens: run.providerTokens.gemini,
      openrouterTokens: run.providerTokens.openrouter,
      durationMs: run.durationMs,
      durationSec: run.durationMs > 0 ? Number((run.durationMs / 1000).toFixed(1)) : 0,
      shockCount: run.shockCount,
      autoRecoveries: run.autoRecoveries,
      errorCount: run.errorCount,
      completedAll5: run.completedAll5,
      beatStates: {
        b1: run.agentStatuses.researcher,
        b2q: run.agentStatuses.quant,
        b2s: run.agentStatuses.strategist,
        b3c: run.agentStatuses.critic,
        b3a: run.agentStatuses.assistant,
      },
      hasReportSnapshot: AGENTS.some((a) => Boolean(run.outputs[a.id])),
    };
  });

  const avgSessionDurationSec =
    sessionDurations.length > 0
      ? Number((sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length / 1000).toFixed(1))
      : 0;
  const avgAgentResponseSec =
    allAgentDurations.length > 0
      ? Number((allAgentDurations.reduce((a, b) => a + b, 0) / allAgentDurations.length / 1000).toFixed(1))
      : 0;

  const agentMetrics: AnalyticsAgentMetric[] = AGENTS.map((a) => {
    const acc = agentAcc[a.id];
    return {
      id: acc.id,
      step: acc.step,
      name: acc.name,
      shortRole: acc.shortRole,
      colorHex: acc.colorHex,
      totalTokens: acc.totalTokens,
      avgDurationSec:
        acc.durationCount > 0 ? Number((acc.durationSumMs / acc.durationCount / 1000).toFixed(1)) : 0,
      successRatePct: acc.attemptCount > 0 ? Math.round((acc.successCount / acc.attemptCount) * 100) : 0,
      successCount: acc.successCount,
      attemptCount: acc.attemptCount,
    };
  });

  const modeDistribution: AnalyticsModeDistribution[] = (Object.keys(WORK_MODES) as WorkModeId[]).map((mId) => {
    const count = modeCounts[mId] || 0;
    return {
      id: mId,
      label: WORK_MODES[mId].label,
      count,
      pct: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
      colorHex: modeColors[mId] || '#94a3b8',
    };
  });

  const modelDistribution: AnalyticsModelDistribution[] = Array.from(modelMap.values())
    .sort((a, b) => b.calls - a.calls || b.tokens - a.tokens)
    .map((item) => ({
      ...item,
      pct: totalModelCalls > 0 ? Math.round((item.calls / totalModelCalls) * 100) : 0,
    }));

  return {
    totalSessions,
    completed3BeatCount,
    completionRatePct,
    totalTokens,
    geminiTokens,
    openrouterTokens,
    avgSessionDurationSec,
    avgAgentResponseSec,
    totalShocks,
    totalAutoRecoveries,
    totalErrors,
    totalModelCalls,
    agentMetrics,
    modeDistribution,
    modelDistribution,
    auditRows,
  };
}

export function buildAnalyticsCsv(auditRows: AnalyticsAuditRow[] = []): string {
  const escapeCell = (val: unknown): string => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ');
    return `"${str.replace(/"/g, '""')}"`;
  };
  const headers = [
    'Thời gian',
    'Đề bài',
    'Chế độ',
    'Tổng Token',
    'Token Gemini Free',
    'Token OpenRouter',
    'Thời gian (giây)',
    'Nhịp 1',
    'Nhịp 2A',
    'Nhịp 2B',
    'Nhịp 3A',
    'Nhịp 3B',
    'Lượt chích điện',
    'Tự phục hồi API',
    'Số lỗi',
  ];
  const lines = [headers.map(escapeCell).join(',')];
  (Array.isArray(auditRows) ? auditRows : []).forEach((row) => {
    lines.push(
      [
        row.timestamp,
        row.topic,
        row.modeLabel,
        row.totalTokens,
        row.geminiTokens,
        row.openrouterTokens,
        row.durationSec,
        row.beatStates?.b1 || 'idle',
        row.beatStates?.b2q || 'idle',
        row.beatStates?.b2s || 'idle',
        row.beatStates?.b3c || 'idle',
        row.beatStates?.b3a || 'idle',
        row.shockCount,
        row.autoRecoveries,
        row.errorCount,
      ]
        .map(escapeCell)
        .join(',')
    );
  });
  return `\uFEFF${lines.join('\n')}`;
}
