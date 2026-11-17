import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ControlPanel } from './components/ControlPanel';
import { ExpertCouncilSidebar } from './components/ExpertCouncilSidebar';
import { Office3DCanvas } from './components/Office3DCanvas';
import { PromptDock } from './components/PromptDock';
import { ViewSwitcher } from './components/ViewSwitcher';
import {
  ANALYTICS_MAX_RUNS,
  buildAnalyticsCsv,
  computeAnalyticsDashboardMetrics,
  loadAnalyticsRuns,
  loadSessionHistory,
  mergeAnalyticsSources,
  normalizeAnalyticsRunRecord,
  upsertAnalyticsRun,
  upsertSessionHistory,
  type NormalizedAnalyticsRunRecord,
  type SessionHistoryEntry,
} from './core/analytics';
import {
  AGENTS,
  ASSISTANT_AGENT,
  DEFAULT_AGENT_MODELS,
  HALL_AGENTS,
  RETRY_CONFIG,
  STORAGE_KEYS,
  getAgentRoleForMode,
  getDefaultSystemPrompt,
  getModeMeta,
  getModelProvider,
  getNeuralTickerMessage,
  loadSavedAgentApiKeys,
  loadSavedAgentModels,
  loadSavedSystemPrompts,
  normalizeWorkMode,
  resolveAgentKeyPlan,
  resolveAgentSystemPrompt,
  type AgentId,
  type AgentStatus,
  type SavedSystemPromptsMap,
  type WorkModeId,
} from './core/workModes';
import {
  abortableSleep,
  buildAgentPrompt,
  buildAssistantFollowupPrompt,
  buildExactApiErrorInfo,
  buildFullReportMarkdown,
  buildMemoryExtractionPrompt,
  callOpenRouterWithKeyFallback,
  normalizeMemoryBullets,
  parseAssistantMemoryExtraction,
  runHybrid3BeatSequence,
  type TaggedApiError,
} from './services/openrouter';
import type {
  AnalyticsAgentMetricKey,
  BurstTimers,
  CameraView,
  ErrorType,
  WorkspaceView,
} from './types/office';
import { createSoundEngine } from './utils/soundEngine';

function createEmptyAgentMap<T>(defaultValue: T): Record<AgentId, T> {
  return AGENTS.reduce(
    (acc, agent) => {
      acc[agent.id] = defaultValue;
      return acc;
    },
    {} as Record<AgentId, T>
  );
}

function readStorage(key: string): string {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) || '' : '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage quota / private mode errors safely
  }
}

interface InitialStoredState {
  apiKey: string;
  mode: WorkModeId;
  agentModels: Record<AgentId, string>;
  agentApiKeys: Record<AgentId, string>;
  agentSystemPrompts: SavedSystemPromptsMap;
  companyMemory: string;
  sessionHistory: SessionHistoryEntry[];
  analyticsRuns: NormalizedAnalyticsRunRecord[];
  soundEnabled: boolean;
  sidebarCollapsed: boolean;
}

function loadInitialState(): InitialStoredState {
  const rawModels =
    readStorage(STORAGE_KEYS.agentModels) ||
    readStorage(STORAGE_KEYS.legacyAgentModelsV4) ||
    readStorage(STORAGE_KEYS.legacyAgentModels);

  const savedSound = readStorage(STORAGE_KEYS.soundEnabled);
  return {
    apiKey: readStorage(STORAGE_KEYS.apiKey),
    mode: normalizeWorkMode(readStorage(STORAGE_KEYS.mode)),
    agentModels: loadSavedAgentModels(rawModels),
    agentApiKeys: loadSavedAgentApiKeys(readStorage(STORAGE_KEYS.agentApiKeys)),
    agentSystemPrompts: loadSavedSystemPrompts(readStorage(STORAGE_KEYS.agentSystemPrompts)),
    companyMemory: readStorage(STORAGE_KEYS.companyMemory),
    sessionHistory: loadSessionHistory(readStorage(STORAGE_KEYS.history)),
    analyticsRuns: loadAnalyticsRuns(readStorage(STORAGE_KEYS.analyticsRuns)),
    soundEnabled: savedSound !== 'false',
    sidebarCollapsed: typeof window !== 'undefined' ? window.innerWidth < 900 : false,
  };
}

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  // Persisted configuration & history
  const [apiKey, setApiKey] = useState<string>(initial.apiKey);
  const [mode, setMode] = useState<WorkModeId>(initial.mode);
  const [agentModels, setAgentModels] = useState<Record<AgentId, string>>(initial.agentModels);
  const [agentApiKeys, setAgentApiKeys] = useState<Record<AgentId, string>>(initial.agentApiKeys);
  const [agentSystemPrompts, setAgentSystemPrompts] = useState<SavedSystemPromptsMap>(
    initial.agentSystemPrompts
  );
  const [companyMemory, setCompanyMemory] = useState<string>(initial.companyMemory);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>(initial.sessionHistory);
  const [analyticsRuns, setAnalyticsRuns] = useState<NormalizedAnalyticsRunRecord[]>(
    initial.analyticsRuns
  );

  // UI & Workspace controls
  const [activeView, setActiveView] = useState<WorkspaceView>('office');
  const [analyticsSearch, setAnalyticsSearch] = useState<string>('');
  const [analyticsAgentMetric, setAnalyticsAgentMetric] =
    useState<AnalyticsAgentMetricKey>('tokens');
  const [cameraView, setCameraView] = useState<CameraView>('overview');
  const [cameraResetVersion, setCameraResetVersion] = useState<number>(0);
  const [controlCollapsed, setControlCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(initial.sidebarCollapsed);
  const [cinemaMode, setCinemaMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(initial.soundEnabled);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);

  // Task prompt & pipeline execution state
  const [promptValue, setPromptValue] = useState<string>('');
  const [followupDraft, setFollowupDraft] = useState<string>('');
  const [errorBannerMsg, setErrorBannerMsg] = useState<string>('');
  const [copyLabel, setCopyLabel] = useState<string>('Copy toàn bộ báo cáo');
  const [submitLabel, setSubmitLabel] = useState<string>('Bắt đầu');
  const [focusRequest, setFocusRequest] = useState<{ agentId: AgentId; nonce: number } | null>(null);

  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [lastTopic, setLastTopic] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFollowupRunning, setIsFollowupRunning] = useState<boolean>(false);
  const [runningAgents, setRunningAgents] = useState<AgentId[]>([]);

  const [statuses, setStatuses] = useState<Record<AgentId, AgentStatus>>(() =>
    createEmptyAgentMap<AgentStatus>('idle')
  );
  const [agentStartedAt, setAgentStartedAt] = useState<Record<AgentId, number>>(() =>
    createEmptyAgentMap(0)
  );
  const [agentDurations, setAgentDurations] = useState<Record<AgentId, number>>(() =>
    createEmptyAgentMap(0)
  );
  const [outputs, setOutputs] = useState<Record<AgentId, string>>(() => createEmptyAgentMap(''));
  const [usedModels, setUsedModels] = useState<Record<AgentId, string>>(() => createEmptyAgentMap(''));
  const [actualModels, setActualModels] = useState<Record<AgentId, string>>(() =>
    createEmptyAgentMap('')
  );
  const [tokenCounts, setTokenCounts] = useState<Record<AgentId, number>>(() =>
    createEmptyAgentMap(0)
  );
  const [errors, setErrors] = useState<Record<AgentId, string>>(() => createEmptyAgentMap(''));
  const [errorTypes, setErrorTypes] = useState<Record<AgentId, ErrorType>>(() =>
    createEmptyAgentMap<ErrorType>('')
  );
  const [errorLabels, setErrorLabels] = useState<Record<AgentId, string>>(() =>
    createEmptyAgentMap('')
  );
  const [retryStatus, setRetryStatus] = useState<Record<AgentId, string>>(() =>
    createEmptyAgentMap('')
  );
  const [burstTimers, setBurstTimers] = useState<BurstTimers>({
    beat1DoneAt: 0,
    beat2DoneAt: 0,
    allDoneAt: 0,
  });

  const [sessionStartedAt, setSessionStartedAt] = useState<number>(0);
  const [sessionDurationMs, setSessionDurationMs] = useState<number>(0);
  const [sessionShockCount, setSessionShockCount] = useState<number>(0);
  const [sessionAutoRecoveries, setSessionAutoRecoveries] = useState<number>(0);
  const [sessionErrorCount, setSessionErrorCount] = useState<number>(0);

  // Refs for DOM elements & async-safe orchestration state
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const followupInputRef = useRef<HTMLInputElement | null>(null);
  const modelInputRefs = useRef<Partial<Record<AgentId, HTMLInputElement | null>>>({});
  const keyInputRefs = useRef<Partial<Record<AgentId, HTMLInputElement | null>>>({});
  const activeAbortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number>(0);
  const soundEnabledRef = useRef<boolean>(initial.soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const soundEngine = useMemo(() => createSoundEngine(() => soundEnabledRef.current), []);

  // Live mutable refs so async Beat 2/3 & persistence always see fresh snapshots
  const liveRef = useRef({
    apiKey: initial.apiKey,
    mode: initial.mode,
    agentModels: initial.agentModels,
    agentApiKeys: initial.agentApiKeys,
    agentSystemPrompts: initial.agentSystemPrompts,
    companyMemory: initial.companyMemory,
    sessionHistory: initial.sessionHistory,
    analyticsRuns: initial.analyticsRuns,
    activeView: 'office' as WorkspaceView,
    currentSessionId: '',
    lastTopic: '',
    promptValue: '',
    isRunning: false,
    isFollowupRunning: false,
    runningAgents: new Set<AgentId>(),
    statuses: createEmptyAgentMap<AgentStatus>('idle'),
    prevStatuses: createEmptyAgentMap<AgentStatus>('idle'),
    agentStartedAt: createEmptyAgentMap<number>(0),
    agentDurations: createEmptyAgentMap<number>(0),
    outputs: createEmptyAgentMap<string>(''),
    usedModels: createEmptyAgentMap<string>(''),
    actualModels: createEmptyAgentMap<string>(''),
    tokenCounts: createEmptyAgentMap<number>(0),
    errors: createEmptyAgentMap<string>(''),
    errorTypes: createEmptyAgentMap<ErrorType>(''),
    errorLabels: createEmptyAgentMap<string>(''),
    retryStatus: createEmptyAgentMap<string>(''),
    sessionStartedAt: 0,
    sessionDurationMs: 0,
    sessionShockCount: 0,
    sessionAutoRecoveries: 0,
    sessionErrorCount: 0,
    sidebarCollapsed: initial.sidebarCollapsed,
  });

  liveRef.current.apiKey = apiKey;
  liveRef.current.mode = mode;
  liveRef.current.agentModels = agentModels;
  liveRef.current.agentApiKeys = agentApiKeys;
  liveRef.current.agentSystemPrompts = agentSystemPrompts;
  liveRef.current.companyMemory = companyMemory;
  liveRef.current.sessionHistory = sessionHistory;
  liveRef.current.analyticsRuns = analyticsRuns;
  liveRef.current.activeView = activeView;
  liveRef.current.promptValue = promptValue;
  liveRef.current.sidebarCollapsed = sidebarCollapsed;

  // Helpers to sync per-agent state into both liveRef and React state immediately
  const syncAgentField = useCallback(
    <V,>(
      refMap: Record<AgentId, V>,
      setter: React.Dispatch<React.SetStateAction<Record<AgentId, V>>>,
      agentId: AgentId,
      value: NoInfer<V>
    ) => {
      refMap[agentId] = value;
      setter((prev) => ({ ...prev, [agentId]: value }));
    },
    []
  );

  // Detect Beat transitions for 3D burst animations
  useEffect(() => {
    const prev = liveRef.current.prevStatuses;
    const nowMs = performance.now();
    let changed = false;
    let nextBeat1 = burstTimers.beat1DoneAt;
    let nextBeat2 = burstTimers.beat2DoneAt;
    let nextAll = burstTimers.allDoneAt;

    if (statuses.researcher === 'done' && prev.researcher !== 'done') {
      nextBeat1 = nowMs;
      changed = true;
    }
    const beat2NowDone = statuses.quant === 'done' && statuses.strategist === 'done';
    const beat2WasDone = prev.quant === 'done' && prev.strategist === 'done';
    if (beat2NowDone && !beat2WasDone) {
      nextBeat2 = nowMs;
      changed = true;
    }
    if (statuses.assistant === 'done' && prev.assistant !== 'done') {
      nextAll = nowMs;
      changed = true;
    }
    AGENTS.forEach((a) => {
      prev[a.id] = statuses[a.id];
    });
    if (changed) {
      setBurstTimers({ beat1DoneAt: nextBeat1, beat2DoneAt: nextBeat2, allDoneAt: nextAll });
    }
  }, [statuses, burstTimers.beat1DoneAt, burstTimers.beat2DoneAt, burstTimers.allDoneAt]);

  // Sync body dataset attributes for Cinema Mode, testing & status selectors
  useEffect(() => {
    const hallDoneCount = HALL_AGENTS.filter((a) => statuses[a.id] === 'done').length;
    const anyError = AGENTS.some((a) => statuses[a.id] === 'error');
    const activeIds = AGENTS.filter((a) => statuses[a.id] === 'active').map((a) => a.id);

    let pipelineStatus = 'idle';
    if (isRunning || runningAgents.length > 0) {
      pipelineStatus = 'running';
    } else if (statuses.assistant === 'done' && hallDoneCount === 4) {
      pipelineStatus = 'completed';
    } else if (anyError) {
      pipelineStatus = 'error';
    } else if (hallDoneCount > 0) {
      pipelineStatus = 'partial';
    }

    document.body.dataset.pipelineStatus = pipelineStatus;
    document.body.dataset.activeAgent = activeIds.length ? activeIds.join(',') : 'none';
    document.body.dataset.cameraView = cameraView;
    document.body.dataset.cinemaMode = cinemaMode ? 'true' : 'false';
    document.body.dataset.soundEnabled = soundEnabled ? 'true' : 'false';
    document.body.dataset.activeView = activeView;
  }, [statuses, isRunning, runningAgents, cameraView, cinemaMode, soundEnabled, activeView]);

  // Responsive collapse & Escape handler
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768 && !liveRef.current.sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
      if (window.innerWidth < 640) {
        setControlCollapsed(true);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && liveRef.current.activeView === 'analytics') {
        setActiveView('office');
      }
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Abort active requests & cleanup timers on unmount
  useEffect(() => {
    return () => {
      activeAbortRef.current?.abort();
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const pipelineSummary = useMemo(() => {
    const hallDoneCount = HALL_AGENTS.filter((a) => statuses[a.id] === 'done').length;
    const anyError = AGENTS.some((a) => statuses[a.id] === 'error');
    const rName = getAgentRoleForMode(mode, 'researcher').name;
    const qName = getAgentRoleForMode(mode, 'quant').name;
    const sName = getAgentRoleForMode(mode, 'strategist').name;
    const cName = getAgentRoleForMode(mode, 'critic').name;
    const aName = getAgentRoleForMode(mode, 'assistant').name;

    if (isRunning || runningAgents.length > 0) {
      if (statuses.assistant === 'active') return `Nhịp 3/3: ${aName} đang tổng hợp...`;
      if (statuses.critic === 'active') return `Nhịp 3/3: ${cName} đang kiểm duyệt...`;
      if (
        statuses.quant === 'active' ||
        statuses.strategist === 'active' ||
        statuses.researcher === 'done'
      ) {
        return `Nhịp 2/3: ${qName} & ${sName} song song...`;
      }
      return `Nhịp 1/3: ${rName} đang xử lý...`;
    }
    if (statuses.assistant === 'done' && hallDoneCount === 4) {
      return 'Hoàn tất 3 nhịp (1 → 2 → 2) & Báo cáo Điều hành';
    }
    if (anyError) {
      return `${hallDoneCount}/4 bàn xong · Có nhánh lỗi`;
    }
    if (hallDoneCount > 0) {
      return `${hallDoneCount}/4 bàn xong · Sẵn sàng tổng hợp`;
    }
    return 'Nhân viên đang ngủ · Mô hình Lai 3 nhịp (1 → 2 → 2)';
  }, [mode, statuses, isRunning, runningAgents]);

  const tickerMessage = useMemo(
    () => getNeuralTickerMessage(mode, statuses, isRunning),
    [mode, statuses, isRunning]
  );

  // Analytics snapshot builder using liveRef for accuracy during async runs
  const buildCurrentRunSnapshot = useCallback((): NormalizedAnalyticsRunRecord | null => {
    const s = liveRef.current;
    if (!s.lastTopic) return null;
    let geminiTokens = 0;
    let openrouterTokens = 0;
    AGENTS.forEach((a) => {
      const tk = Number(s.tokenCounts[a.id]) || 0;
      if (tk > 0) {
        const modelStr = s.actualModels[a.id] || s.usedModels[a.id] || s.agentModels[a.id] || '';
        if (getModelProvider(modelStr) === 'gemini') {
          geminiTokens += tk;
        } else {
          openrouterTokens += tk;
        }
      }
    });
    const elapsedMs =
      s.sessionDurationMs > 0
        ? s.sessionDurationMs
        : s.sessionStartedAt > 0
          ? Math.max(1, Date.now() - s.sessionStartedAt)
          : AGENTS.reduce((acc, a) => acc + (Number(s.agentDurations[a.id]) || 0), 0);

    return normalizeAnalyticsRunRecord({
      id: s.currentSessionId || `sess_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: normalizeWorkMode(s.mode),
      topic: s.lastTopic,
      outputs: { ...s.outputs },
      actualModels: { ...s.actualModels },
      usedModels: { ...s.usedModels },
      tokenCounts: { ...s.tokenCounts },
      agentDurations: { ...s.agentDurations },
      agentStatuses: { ...s.statuses },
      providerTokens: { gemini: geminiTokens, openrouter: openrouterTokens },
      durationMs: elapsedMs,
      shockCount: s.sessionShockCount,
      autoRecoveries: s.sessionAutoRecoveries,
      errorCount: s.sessionErrorCount,
    });
  }, []);

  const recordCurrentSessionAnalytics = useCallback(() => {
    const snapshot = buildCurrentRunSnapshot();
    if (!snapshot) return;
    const nextRuns = upsertAnalyticsRun(liveRef.current.analyticsRuns, snapshot, ANALYTICS_MAX_RUNS);
    liveRef.current.analyticsRuns = nextRuns;
    setAnalyticsRuns(nextRuns);
    writeStorage(STORAGE_KEYS.analyticsRuns, JSON.stringify(nextRuns));
  }, [buildCurrentRunSnapshot]);

  const saveCurrentSessionToHistory = useCallback(() => {
    const s = liveRef.current;
    if (!s.lastTopic || !AGENTS.some((a) => Boolean(s.outputs[a.id]))) return;
    const entry: SessionHistoryEntry = {
      id: s.currentSessionId || `sess_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: normalizeWorkMode(s.mode),
      topic: s.lastTopic,
      outputs: { ...s.outputs },
      actualModels: { ...s.actualModels },
      usedModels: { ...s.usedModels },
      tokenCounts: { ...s.tokenCounts },
    };
    s.currentSessionId = entry.id;
    setCurrentSessionId(entry.id);
    const nextHistory = upsertSessionHistory(s.sessionHistory, entry, 10);
    s.sessionHistory = nextHistory;
    setSessionHistory(nextHistory);
    writeStorage(STORAGE_KEYS.history, JSON.stringify(nextHistory));
    recordCurrentSessionAnalytics();
  }, [recordCurrentSessionAnalytics]);

  const analyticsMetrics = useMemo(() => {
    const hasLiveSession =
      Boolean(lastTopic) &&
      Boolean(currentSessionId) &&
      (isRunning || AGENTS.some((a) => statuses[a.id] !== 'idle'));
    const liveRun = hasLiveSession
      ? {
          id: currentSessionId,
          timestamp: new Date().toISOString(),
          mode,
          topic: lastTopic,
          outputs,
          actualModels,
          usedModels,
          tokenCounts,
          agentDurations,
          agentStatuses: statuses,
          durationMs:
            sessionDurationMs > 0
              ? sessionDurationMs
              : sessionStartedAt > 0
                ? Math.max(1, Date.now() - sessionStartedAt)
                : AGENTS.reduce((acc, a) => acc + (Number(agentDurations[a.id]) || 0), 0),
          shockCount: sessionShockCount,
          autoRecoveries: sessionAutoRecoveries,
          errorCount: sessionErrorCount,
        }
      : null;

    const merged = mergeAnalyticsSources(analyticsRuns, sessionHistory, liveRun);
    return computeAnalyticsDashboardMetrics(merged);
  }, [
    analyticsRuns,
    sessionHistory,
    lastTopic,
    currentSessionId,
    isRunning,
    statuses,
    mode,
    outputs,
    actualModels,
    usedModels,
    tokenCounts,
    agentDurations,
    sessionDurationMs,
    sessionStartedAt,
    sessionShockCount,
    sessionAutoRecoveries,
    sessionErrorCount,
  ]);

  // Focus helper for sidebar + section scroll
  const focusAgentReportSection = useCallback((agentId: AgentId) => {
    setSidebarCollapsed(false);
    setFocusRequest({ agentId, nonce: Date.now() + Math.random() });
  }, []);

  // Handlers for configuration changes
  const handleApiKeyChange = useCallback((val: string) => {
    liveRef.current.apiKey = val;
    setApiKey(val);
    writeStorage(STORAGE_KEYS.apiKey, val);
    if (val.trim()) setErrorBannerMsg('');
  }, []);

  const handleSelectMode = useCallback((nextMode: WorkModeId) => {
    const norm = normalizeWorkMode(nextMode);
    liveRef.current.mode = norm;
    setMode(norm);
    writeStorage(STORAGE_KEYS.mode, norm);
  }, []);

  const handleModelChange = useCallback((agentId: AgentId, modelId: string) => {
    const trimmed = modelId.trim();
    const next = { ...liveRef.current.agentModels, [agentId]: trimmed };
    liveRef.current.agentModels = next;
    setAgentModels(next);
    writeStorage(STORAGE_KEYS.agentModels, JSON.stringify(next));
    if (trimmed) setErrorBannerMsg('');
  }, []);

  const handleOwnKeyChange = useCallback((agentId: AgentId, ownKey: string) => {
    const trimmed = ownKey.trim();
    const next = { ...liveRef.current.agentApiKeys, [agentId]: trimmed };
    liveRef.current.agentApiKeys = next;
    setAgentApiKeys(next);
    writeStorage(STORAGE_KEYS.agentApiKeys, JSON.stringify(next));
    if (trimmed) setErrorBannerMsg('');
  }, []);

  const handleSystemPromptChange = useCallback((agentId: AgentId, prompt: string) => {
    const normMode = normalizeWorkMode(liveRef.current.mode);
    const defaultVal = getDefaultSystemPrompt(normMode, agentId);
    const nextMap: SavedSystemPromptsMap = { ...liveRef.current.agentSystemPrompts };
    const modeMap = { ...(nextMap[normMode] || {}) };
    if (!prompt.trim() || prompt.trim() === defaultVal) {
      delete modeMap[agentId];
    } else {
      modeMap[agentId] = prompt;
    }
    nextMap[normMode] = modeMap;
    liveRef.current.agentSystemPrompts = nextMap;
    setAgentSystemPrompts(nextMap);
    writeStorage(STORAGE_KEYS.agentSystemPrompts, JSON.stringify(nextMap));
  }, []);

  const handleResetSystemPrompt = useCallback((agentId: AgentId) => {
    const normMode = normalizeWorkMode(liveRef.current.mode);
    const nextMap: SavedSystemPromptsMap = { ...liveRef.current.agentSystemPrompts };
    if (nextMap[normMode]) {
      const modeMap = { ...nextMap[normMode] };
      delete modeMap[agentId];
      nextMap[normMode] = modeMap;
    }
    liveRef.current.agentSystemPrompts = nextMap;
    setAgentSystemPrompts(nextMap);
    writeStorage(STORAGE_KEYS.agentSystemPrompts, JSON.stringify(nextMap));
  }, []);

  const handleCompanyMemoryChange = useCallback((value: string) => {
    liveRef.current.companyMemory = value;
    setCompanyMemory(value);
    writeStorage(STORAGE_KEYS.companyMemory, value);
  }, []);

  const handleClearCompanyMemory = useCallback(() => {
    liveRef.current.companyMemory = '';
    setCompanyMemory('');
    writeStorage(STORAGE_KEYS.companyMemory, '');
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    writeStorage(STORAGE_KEYS.soundEnabled, next ? 'true' : 'false');
    if (next) soundEngine.playClick();
  }, [soundEngine]);

  const handleSelectCameraView = useCallback((view: CameraView) => {
    setCameraView(view);
    setCameraResetVersion((v) => v + 1);
  }, []);

  const handleToggleCinemaMode = useCallback(() => {
    setCinemaMode((prev) => !prev);
  }, []);

  const handleElectricZap = useCallback(() => {
    soundEngine.playElectricZap();
    liveRef.current.sessionShockCount += 1;
    setSessionShockCount(liveRef.current.sessionShockCount);
  }, [soundEngine]);

  // Execute a single agent request (used both by 3-beat pipeline and manual reruns)
  const executeSingleAgentRequest = useCallback(
    async (
      agentId: AgentId,
      apiKeyOverride: string,
      signal: AbortSignal,
      staggerMs = 0
    ): Promise<{
      agent: (typeof AGENTS)[number];
      ok: boolean;
      extractedMemory?: string;
      errorType?: ErrorType;
      shortLabel?: string;
      isTimeout?: boolean;
      error?: string;
    }> => {
      const agent = AGENTS.find((a) => a.id === agentId) || AGENTS[0];
      const s = liveRef.current;
      const roleMeta = getAgentRoleForMode(s.mode, agent.id);
      const activeAgent = { ...agent, name: roleMeta.name, titleVi: roleMeta.titleVi, shortRole: roleMeta.shortRole };

      const topicToUse = (s.lastTopic || s.promptValue || '').trim();
      const modelId = (s.agentModels[agent.id] || DEFAULT_AGENT_MODELS[agent.id]).trim();
      const keyPlan = resolveAgentKeyPlan(agent.id, s.apiKey, s.agentApiKeys, apiKeyOverride);
      const systemPrompt = resolveAgentSystemPrompt(s.mode, agent.id, s.agentSystemPrompts);

      s.runningAgents.add(agent.id);
      setRunningAgents(Array.from(s.runningAgents));
      syncAgentField(s.statuses, setStatuses, agent.id, 'active');
      syncAgentField(s.agentStartedAt, setAgentStartedAt, agent.id, Date.now());
      syncAgentField(s.usedModels, setUsedModels, agent.id, modelId);
      syncAgentField(s.errors, setErrors, agent.id, '');
      syncAgentField(s.errorTypes, setErrorTypes, agent.id, '');
      syncAgentField(s.errorLabels, setErrorLabels, agent.id, '');
      syncAgentField(
        s.retryStatus,
        setRetryStatus,
        agent.id,
        staggerMs > 0 ? `Chờ giãn cách ${Math.round(staggerMs / 1000)}s...` : ''
      );

      const promptText = buildAgentPrompt(agent.id, s.mode, topicToUse, s.outputs, s.companyMemory);

      let reqStartMs = Date.now();
      let hadRetryOrFallback = false;

      try {
        if (staggerMs > 0) {
          await abortableSleep(staggerMs, signal);
          syncAgentField(s.retryStatus, setRetryStatus, agent.id, '');
          syncAgentField(s.agentStartedAt, setAgentStartedAt, agent.id, Date.now());
          reqStartMs = Date.now();
        }

        if (!keyPlan.primaryKey) {
          const missingLabel = 'Thiếu OpenRouter API Key';
          const missingErr: TaggedApiError = new Error(
            `${missingLabel} cho ${activeAgent.name}. Hãy nhập OpenRouter API Key ở góc trên trái hoặc API Key riêng trên thẻ nhân viên.`
          );
          missingErr.shortLabel = missingLabel;
          missingErr.errorType = 'api';
          throw missingErr;
        }

        const result = await callOpenRouterWithKeyFallback({
          primaryKey: keyPlan.primaryKey,
          fallbackKey: keyPlan.fallbackKey,
          modelId,
          promptText,
          signal,
          options: {
            systemPrompt,
            maxTokens: RETRY_CONFIG.defaultMaxTokens,
            timeoutMs: RETRY_CONFIG.requestTimeoutMs,
            rescueOnModelError: true,
            onSilentRetry: (attemptNum, _maxSilent, meta = {}) => {
              hadRetryOrFallback = true;
              const msg =
                attemptNum === 2
                  ? meta.switchedKey
                    ? 'Đang tối ưu 2/3 (3s · Key gốc)...'
                    : 'Đang tối ưu kết nối 2/3 (3s)...'
                  : `Đang cứu hộ 3/3 (3s → ${(meta.rescueModel || 'openrouter/free').split('/').pop()})...`;
              syncAgentField(s.retryStatus, setRetryStatus, agent.id, msg);
            },
            onRetry: (attempt, maxRetries, status) => {
              hadRetryOrFallback = true;
              const statusTag = status === 'network' ? 'Mạng' : status;
              syncAgentField(
                s.retryStatus,
                setRetryStatus,
                agent.id,
                `Chờ 3s · Thử lại ${attempt}/${maxRetries} (${statusTag})`
              );
            },
            onFallback: (fallbackModel) => {
              hadRetryOrFallback = true;
              const shortFallback = fallbackModel.split('/').pop() || fallbackModel;
              syncAgentField(s.retryStatus, setRetryStatus, agent.id, `Chờ 3s → ${shortFallback}`);
            },
            onKeyFallback: (status) => {
              hadRetryOrFallback = true;
              syncAgentField(
                s.retryStatus,
                setRetryStatus,
                agent.id,
                `Key riêng lỗi ${status} → Chuyển Key gốc...`
              );
            },
          },
        });

        let finalText = result.text;
        let extractedMemory = '';
        if (agent.id === 'assistant') {
          const parsedMem = parseAssistantMemoryExtraction(result.text, s.companyMemory);
          finalText = parsedMem.cleanReport;
          extractedMemory = parsedMem.extractedMemory;
          if (parsedMem.extractedMemory) {
            s.companyMemory = parsedMem.mergedMemory;
            setCompanyMemory(parsedMem.mergedMemory);
            writeStorage(STORAGE_KEYS.companyMemory, parsedMem.mergedMemory);
          }
        }

        syncAgentField(s.outputs, setOutputs, agent.id, finalText);
        syncAgentField(s.actualModels, setActualModels, agent.id, result.actualModel || modelId);
        syncAgentField(s.tokenCounts, setTokenCounts, agent.id, Number(result.totalTokens) || 0);
        syncAgentField(
          s.agentDurations,
          setAgentDurations,
          agent.id,
          Math.max(1, Date.now() - reqStartMs)
        );
        if (hadRetryOrFallback || result.attemptUsed > 1 || result.usedKeyFallback || result.usedModelFallback) {
          s.sessionAutoRecoveries += 1;
          setSessionAutoRecoveries(s.sessionAutoRecoveries);
        }
        syncAgentField(s.statuses, setStatuses, agent.id, 'done');
        syncAgentField(s.retryStatus, setRetryStatus, agent.id, '');
        syncAgentField(s.errors, setErrors, agent.id, '');
        syncAgentField(s.errorTypes, setErrorTypes, agent.id, '');
        syncAgentField(s.errorLabels, setErrorLabels, agent.id, '');

        return { agent: activeAgent, ok: true, extractedMemory };
      } catch (err) {
        const tagged = err as TaggedApiError;
        if (tagged?.name === 'AbortError' && !tagged?.isTimeout) throw err;
        const fallbackInfo = buildExactApiErrorInfo(
          'openrouter',
          tagged?.status || 0,
          '',
          tagged,
          modelId
        );
        const errorType: ErrorType =
          tagged?.errorType ||
          (tagged?.isTimeout ? 'timeout' : tagged?.isNetworkError ? 'network' : 'api');
        const shortLabel = tagged?.shortLabel || fallbackInfo.shortLabel;
        const errorMsg = tagged?.message || fallbackInfo.message;

        syncAgentField(
          s.agentDurations,
          setAgentDurations,
          agent.id,
          Math.max(1, Date.now() - reqStartMs)
        );
        s.sessionErrorCount += 1;
        setSessionErrorCount(s.sessionErrorCount);
        syncAgentField(s.statuses, setStatuses, agent.id, 'error');
        syncAgentField(s.retryStatus, setRetryStatus, agent.id, '');
        syncAgentField(s.errorTypes, setErrorTypes, agent.id, errorType);
        syncAgentField(s.errorLabels, setErrorLabels, agent.id, shortLabel);
        syncAgentField(s.errors, setErrors, agent.id, errorMsg);
        soundEngine.playErrorAlert(errorType);

        return {
          agent: activeAgent,
          ok: false,
          errorType,
          shortLabel,
          isTimeout: errorType === 'timeout',
          error: errorMsg,
        };
      } finally {
        s.runningAgents.delete(agent.id);
        setRunningAgents(Array.from(s.runningAgents));
      }
    },
    [soundEngine, syncAgentField]
  );

  const extractCompanyMemoryFallback = useCallback(async (signal: AbortSignal) => {
    const s = liveRef.current;
    const modelId = (s.agentModels.assistant || DEFAULT_AGENT_MODELS.assistant).trim();
    const keyPlan = resolveAgentKeyPlan('assistant', s.apiKey, s.agentApiKeys);
    if (!keyPlan.primaryKey || !modelId || !s.outputs.assistant) return;
    try {
      const promptText = buildMemoryExtractionPrompt({
        userTopic: s.lastTopic,
        outputs: s.outputs,
        currentMemory: s.companyMemory,
      });
      const res = await callOpenRouterWithKeyFallback({
        primaryKey: keyPlan.primaryKey,
        fallbackKey: keyPlan.fallbackKey,
        modelId,
        promptText,
        signal,
        options: {
          systemPrompt:
            'Bạn là Trợ lý ghi nhớ dài hạn cho CEO Phúc. Chỉ xuất 3–5 gạch đầu dòng thật ngắn gọn về thói quen, ngân sách, quỹ giờ hoặc lưu ý quan trọng.',
          maxRetries: 1,
        },
      });
      const bullets = normalizeMemoryBullets(`${res.text}\n${s.companyMemory || ''}`, 5);
      if (bullets) {
        s.companyMemory = bullets;
        setCompanyMemory(bullets);
        writeStorage(STORAGE_KEYS.companyMemory, bullets);
      }
      if (res.totalTokens > 0) {
        const nextTok = (Number(s.tokenCounts.assistant) || 0) + res.totalTokens;
        syncAgentField(s.tokenCounts, setTokenCounts, 'assistant', nextTok);
      }
    } catch {
      // Graceful non-blocking memory fallback
    }
  }, [syncAgentField]);

  const handleSubmitFollowup = useCallback(
    async (followupText: string) => {
      const s = liveRef.current;
      if (s.isRunning || s.isFollowupRunning || s.runningAgents.size > 0) return;
      const trimmedReq = (followupText || '').trim();
      const assistantName = getAgentRoleForMode(s.mode, 'assistant').name;
      if (!trimmedReq) {
        setErrorBannerMsg('Vui lòng nhập yêu cầu chỉnh sửa hoặc câu hỏi cho Thư ký.');
        followupInputRef.current?.focus();
        return;
      }
      const modelId = (s.agentModels.assistant || DEFAULT_AGENT_MODELS.assistant).trim();
      if (!modelId) {
        setErrorBannerMsg(`Vui lòng chọn hoặc nhập mã model cho ${assistantName}.`);
        modelInputRefs.current.assistant?.focus();
        return;
      }
      const keyPlan = resolveAgentKeyPlan('assistant', s.apiKey, s.agentApiKeys);
      if (!keyPlan.primaryKey) {
        setErrorBannerMsg(
          `Vui lòng nhập OpenRouter API Key tổng hoặc API Key riêng cho ${assistantName}.`
        );
        keyInputRefs.current.assistant?.focus();
        return;
      }

      setErrorBannerMsg('');
      s.isFollowupRunning = true;
      setIsFollowupRunning(true);
      s.runningAgents.add('assistant');
      setRunningAgents(Array.from(s.runningAgents));
      syncAgentField(s.statuses, setStatuses, 'assistant', 'active');
      syncAgentField(s.agentStartedAt, setAgentStartedAt, 'assistant', Date.now());
      syncAgentField(s.usedModels, setUsedModels, 'assistant', modelId);
      syncAgentField(s.retryStatus, setRetryStatus, 'assistant', '');
      syncAgentField(s.errors, setErrors, 'assistant', '');
      syncAgentField(s.errorLabels, setErrorLabels, 'assistant', '');

      const ctrl = new AbortController();
      activeAbortRef.current = ctrl;
      const systemPrompt = resolveAgentSystemPrompt(s.mode, 'assistant', s.agentSystemPrompts);
      const promptText = buildAssistantFollowupPrompt({
        mode: s.mode,
        userTopic: s.lastTopic,
        outputs: s.outputs,
        currentSummary: s.outputs.assistant,
        followupRequest: trimmedReq,
        companyMemory: s.companyMemory,
      });

      try {
        const result = await callOpenRouterWithKeyFallback({
          primaryKey: keyPlan.primaryKey,
          fallbackKey: keyPlan.fallbackKey,
          modelId,
          promptText,
          signal: ctrl.signal,
          options: {
            systemPrompt,
            maxTokens: RETRY_CONFIG.defaultMaxTokens,
            rescueOnModelError: true,
            onSilentRetry: (attemptNum, _maxSilent, meta = {}) => {
              const msg =
                attemptNum === 2
                  ? meta.switchedKey
                    ? 'Đang tối ưu 2/3 (3s · Key gốc)...'
                    : 'Đang tối ưu kết nối 2/3 (3s)...'
                  : `Đang cứu hộ 3/3 (3s → ${(meta.rescueModel || 'openrouter/free').split('/').pop()})...`;
              syncAgentField(s.retryStatus, setRetryStatus, 'assistant', msg);
            },
            onRetry: (attempt, maxRetries, status) => {
              const statusTag = status === 'network' ? 'Mạng' : status;
              syncAgentField(
                s.retryStatus,
                setRetryStatus,
                'assistant',
                `Chờ 3s · Thử lại ${attempt}/${maxRetries} (${statusTag})`
              );
            },
            onFallback: (fallbackModel) => {
              const shortFallback = fallbackModel.split('/').pop() || fallbackModel;
              syncAgentField(s.retryStatus, setRetryStatus, 'assistant', `Chờ 3s → ${shortFallback}`);
            },
            onKeyFallback: (status) => {
              syncAgentField(
                s.retryStatus,
                setRetryStatus,
                'assistant',
                `Key riêng lỗi ${status} → Chuyển Key gốc...`
              );
            },
          },
        });
        const parsedMem = parseAssistantMemoryExtraction(result.text, s.companyMemory);
        syncAgentField(s.outputs, setOutputs, 'assistant', parsedMem.cleanReport);
        if (parsedMem.extractedMemory) {
          s.companyMemory = parsedMem.mergedMemory;
          setCompanyMemory(parsedMem.mergedMemory);
          writeStorage(STORAGE_KEYS.companyMemory, parsedMem.mergedMemory);
        }
        syncAgentField(s.actualModels, setActualModels, 'assistant', result.actualModel || modelId);
        syncAgentField(
          s.tokenCounts,
          setTokenCounts,
          'assistant',
          (Number(s.tokenCounts.assistant) || 0) + (Number(result.totalTokens) || 0)
        );
        syncAgentField(s.statuses, setStatuses, 'assistant', 'done');
        setFollowupDraft('');
        syncAgentField(s.retryStatus, setRetryStatus, 'assistant', '');
        syncAgentField(s.errors, setErrors, 'assistant', '');
        syncAgentField(s.errorLabels, setErrorLabels, 'assistant', '');
        saveCurrentSessionToHistory();
      } catch (err) {
        const tagged = err as TaggedApiError;
        const errorType: ErrorType =
          tagged?.errorType ||
          (tagged?.isTimeout ? 'timeout' : tagged?.isNetworkError ? 'network' : 'api');
        const hasPrev = Boolean(s.outputs.assistant);
        syncAgentField(s.errorTypes, setErrorTypes, 'assistant', hasPrev ? '' : errorType);
        syncAgentField(
          s.errorLabels,
          setErrorLabels,
          'assistant',
          hasPrev ? '' : tagged?.shortLabel || ''
        );
        syncAgentField(s.statuses, setStatuses, 'assistant', hasPrev ? 'done' : 'error');
        syncAgentField(s.retryStatus, setRetryStatus, 'assistant', '');
        soundEngine.playErrorAlert(errorType);
        setErrorBannerMsg(
          `${assistantName}: ${tagged?.message || 'Lỗi khi cập nhật báo cáo.'}`
        );
      } finally {
        s.isFollowupRunning = false;
        setIsFollowupRunning(false);
        s.runningAgents.delete('assistant');
        setRunningAgents(Array.from(s.runningAgents));
        activeAbortRef.current = null;
      }
    },
    [saveCurrentSessionToHistory, soundEngine, syncAgentField]
  );

  const handleSynthesizeAssistant = useCallback(async () => {
    const s = liveRef.current;
    if (s.isRunning || s.isFollowupRunning || s.runningAgents.size > 0) return;
    const assistantName = getAgentRoleForMode(s.mode, 'assistant').name;
    const modelId = (s.agentModels.assistant || '').trim();
    if (!modelId) {
      setErrorBannerMsg(`Vui lòng chọn hoặc nhập mã model cho ${assistantName}.`);
      modelInputRefs.current.assistant?.focus();
      return;
    }
    const keyPlan = resolveAgentKeyPlan('assistant', s.apiKey, s.agentApiKeys);
    if (!keyPlan.primaryKey) {
      setErrorBannerMsg(
        `Vui lòng nhập OpenRouter API Key tổng hoặc API Key riêng cho ${assistantName}.`
      );
      keyInputRefs.current.assistant?.focus();
      return;
    }
    const topic = (s.lastTopic || s.promptValue || '').trim();
    if (!topic) {
      setErrorBannerMsg('Chưa có yêu cầu để tổng hợp.');
      return;
    }
    s.lastTopic = topic;
    setLastTopic(topic);

    const hasAnyHallOutput = HALL_AGENTS.some((a) => Boolean(s.outputs[a.id]));
    if (!hasAnyHallOutput) {
      setErrorBannerMsg('Chưa có kết quả từ các bàn chuyên môn để tổng hợp.');
      return;
    }

    setErrorBannerMsg('');
    const ctrl = new AbortController();
    activeAbortRef.current = ctrl;
    const res = await executeSingleAgentRequest(ASSISTANT_AGENT.id, keyPlan.primaryKey, ctrl.signal, 0);
    activeAbortRef.current = null;
    if (!res.ok) {
      setErrorBannerMsg(res.error || 'Không thể tổng hợp Báo cáo Điều hành.');
    } else {
      saveCurrentSessionToHistory();
      focusAgentReportSection('assistant');
    }
  }, [executeSingleAgentRequest, focusAgentReportSection, saveCurrentSessionToHistory]);

  const handleRerunAgent = useCallback(
    async (agentId: AgentId) => {
      const s = liveRef.current;
      if (s.isRunning || s.runningAgents.has(agentId)) return;
      const roleName = getAgentRoleForMode(s.mode, agentId).name;
      const modelId = (s.agentModels[agentId] || '').trim();
      if (!modelId) {
        setErrorBannerMsg(`Vui lòng chọn hoặc nhập mã model cho ${roleName}.`);
        modelInputRefs.current[agentId]?.focus();
        return;
      }
      const keyPlan = resolveAgentKeyPlan(agentId, s.apiKey, s.agentApiKeys);
      if (!keyPlan.primaryKey) {
        setErrorBannerMsg(
          `Vui lòng nhập OpenRouter API Key tổng hoặc API Key riêng cho ${roleName}.`
        );
        keyInputRefs.current[agentId]?.focus();
        return;
      }
      const topic = (s.lastTopic || s.promptValue || '').trim();
      if (!topic) {
        setErrorBannerMsg('Chưa có yêu cầu để chạy lại.');
        promptInputRef.current?.focus();
        return;
      }
      s.lastTopic = topic;
      setLastTopic(topic);

      setErrorBannerMsg('');
      const ctrl = new AbortController();
      activeAbortRef.current = ctrl;
      const res = await executeSingleAgentRequest(agentId, keyPlan.primaryKey, ctrl.signal, 0);
      activeAbortRef.current = null;
      if (!res.ok) {
        recordCurrentSessionAnalytics();
        setErrorBannerMsg(`${roleName}: ${res.error || 'Lỗi API'}`);
      } else {
        saveCurrentSessionToHistory();
        focusAgentReportSection(agentId);
      }
    },
    [
      executeSingleAgentRequest,
      focusAgentReportSection,
      recordCurrentSessionAnalytics,
      saveCurrentSessionToHistory,
    ]
  );

  const runMultiAgentPipeline = useCallback(async () => {
    const s = liveRef.current;
    if (s.isRunning || s.isFollowupRunning || s.runningAgents.size > 0) return;
    const topic = s.promptValue.trim();

    if (!topic) {
      setErrorBannerMsg('Vui lòng nhập yêu cầu, mục tiêu hoặc vấn đề cần xử lý ở khung bên dưới.');
      promptInputRef.current?.focus();
      return;
    }

    for (const agent of AGENTS) {
      const roleName = getAgentRoleForMode(s.mode, agent.id).name;
      const chosenModel = (s.agentModels[agent.id] || '').trim();
      if (!chosenModel) {
        setErrorBannerMsg(`Vui lòng chọn hoặc nhập mã model cho ${roleName}.`);
        setSidebarCollapsed(false);
        modelInputRefs.current[agent.id]?.focus();
        return;
      }
      const keyPlan = resolveAgentKeyPlan(agent.id, s.apiKey, s.agentApiKeys);
      if (!keyPlan.primaryKey) {
        const hasGlobal = Boolean(s.apiKey.trim());
        setErrorBannerMsg(
          hasGlobal
            ? `Vui lòng nhập API Key cho ${roleName}.`
            : `Vui lòng nhập OpenRouter API Key ở góc trên trái hoặc điền API Key riêng cho ${roleName}.`
        );
        if (!hasGlobal && !Object.values(s.agentApiKeys).some((v) => v.trim())) {
          apiKeyInputRef.current?.focus();
        } else {
          setSidebarCollapsed(false);
          keyInputRefs.current[agent.id]?.focus();
        }
        return;
      }
    }

    setErrorBannerMsg('');
    setHistoryOpen(false);

    const newSessionId = `sess_${Date.now()}`;
    const startedAt = Date.now();
    s.isRunning = true;
    s.currentSessionId = newSessionId;
    s.lastTopic = topic;
    s.statuses = createEmptyAgentMap<AgentStatus>('idle');
    s.prevStatuses = createEmptyAgentMap<AgentStatus>('idle');
    s.agentStartedAt = createEmptyAgentMap(0);
    s.agentDurations = createEmptyAgentMap(0);
    s.outputs = createEmptyAgentMap('');
    s.usedModels = createEmptyAgentMap('');
    s.actualModels = createEmptyAgentMap('');
    s.tokenCounts = createEmptyAgentMap(0);
    s.errors = createEmptyAgentMap('');
    s.errorTypes = createEmptyAgentMap<ErrorType>('');
    s.errorLabels = createEmptyAgentMap('');
    s.retryStatus = createEmptyAgentMap('');
    s.sessionStartedAt = startedAt;
    s.sessionDurationMs = 0;
    s.sessionShockCount = 0;
    s.sessionAutoRecoveries = 0;
    s.sessionErrorCount = 0;

    setIsRunning(true);
    setCurrentSessionId(newSessionId);
    setLastTopic(topic);
    setFollowupDraft('');
    setStatuses({ ...s.statuses });
    setAgentStartedAt({ ...s.agentStartedAt });
    setAgentDurations({ ...s.agentDurations });
    setOutputs({ ...s.outputs });
    setUsedModels({ ...s.usedModels });
    setActualModels({ ...s.actualModels });
    setTokenCounts({ ...s.tokenCounts });
    setErrors({ ...s.errors });
    setErrorTypes({ ...s.errorTypes });
    setErrorLabels({ ...s.errorLabels });
    setRetryStatus({ ...s.retryStatus });
    setBurstTimers({ beat1DoneAt: 0, beat2DoneAt: 0, allDoneAt: 0 });
    setSessionStartedAt(startedAt);
    setSessionDurationMs(0);
    setSessionShockCount(0);
    setSessionAutoRecoveries(0);
    setSessionErrorCount(0);
    setSubmitLabel('Đang chạy Nhịp 1/3...');
    setSidebarCollapsed(false);

    const ctrl = new AbortController();
    activeAbortRef.current = ctrl;
    const signal = ctrl.signal;
    let assistantExtractedMem = false;

    try {
      const rName = getAgentRoleForMode(s.mode, 'researcher').name;
      const qName = getAgentRoleForMode(s.mode, 'quant').name;
      const sName = getAgentRoleForMode(s.mode, 'strategist').name;
      const cName = getAgentRoleForMode(s.mode, 'critic').name;
      const aName = getAgentRoleForMode(s.mode, 'assistant').name;

      const outcome = await runHybrid3BeatSequence({
        beat1CooldownMs: RETRY_CONFIG.beat1CooldownMs,
        staggerDelayMs: RETRY_CONFIG.staggerDelayMs,
        signal,
        onBeatChange: (beat) => {
          if (beat === 'beat1') {
            setSubmitLabel(`Nhịp 1/3: ${rName}...`);
          } else if (beat === 'beat1_cooldown') {
            setSubmitLabel('Nghỉ 3s chống Rate Limit...');
          } else if (beat === 'beat2') {
            setSubmitLabel(`Nhịp 2/3: ${qName} & ${sName}...`);
            soundEngine.playBeatTransition(2);
          } else if (beat === 'beat3_critic') {
            setSubmitLabel(`Nhịp 3/3: ${cName}...`);
            soundEngine.playBeatTransition(3);
          } else if (beat === 'beat3_assistant') {
            setSubmitLabel(`Nhịp 3/3: ${aName}...`);
          }
        },
        runAgent: async (agentId, staggerMs) => {
          const agentPlan = resolveAgentKeyPlan(agentId, s.apiKey, s.agentApiKeys);
          const res = await executeSingleAgentRequest(agentId, agentPlan.primaryKey, signal, staggerMs);
          if (agentId === 'assistant' && res?.ok && res.extractedMemory) {
            assistantExtractedMem = true;
          }
          return res;
        },
      });

      if (outcome.ok) {
        if (!assistantExtractedMem) {
          await extractCompanyMemoryFallback(signal);
        }
        soundEngine.playExecutiveComplete();
        saveCurrentSessionToHistory();
        focusAgentReportSection('assistant');
      } else {
        if (AGENTS.some((a) => Boolean(s.outputs[a.id]))) {
          saveCurrentSessionToHistory();
        }
        const names = outcome.failedAgents.map((f) => f.agent?.name || 'Agent').join(', ');
        const firstErr = outcome.failedAgents[0] as
          | { shortLabel?: string; isTimeout?: boolean }
          | undefined;
        const hasTimeout = outcome.failedAgents.some(
          (f) => Boolean((f as { isTimeout?: boolean }).isTimeout)
        );
        setErrorBannerMsg(
          hasTimeout
            ? `Nhịp ${outcome.failedBeat}/3 (${names}) gặp ${firstErr?.shortLabel || 'Lỗi Timeout >35s'}. Các bàn đã hoàn thành vẫn được giữ nguyên — hãy bấm "Chạy lại" trên thẻ nhân viên lỗi.`
            : `Nhịp ${outcome.failedBeat}/3 (${names}) gặp ${firstErr?.shortLabel || 'lỗi API'} sau khi tự động thử lại. Hãy bấm "Chạy lại" trên thẻ nhân viên lỗi.`
        );
      }
    } catch (err) {
      const tagged = err as TaggedApiError;
      if (tagged?.name !== 'AbortError') {
        const errorType =
          tagged?.errorType ||
          (tagged?.isTimeout ? 'timeout' : tagged?.isNetworkError ? 'network' : 'api');
        soundEngine.playErrorAlert(errorType);
        setErrorBannerMsg(tagged?.message || 'Đã xảy ra lỗi không xác định khi gọi API.');
      }
    } finally {
      s.sessionDurationMs = s.sessionStartedAt > 0 ? Math.max(1, Date.now() - s.sessionStartedAt) : 0;
      s.isRunning = false;
      activeAbortRef.current = null;
      setSessionDurationMs(s.sessionDurationMs);
      setIsRunning(false);
      setSubmitLabel('Bắt đầu');
      recordCurrentSessionAnalytics();
    }
  }, [
    executeSingleAgentRequest,
    extractCompanyMemoryFallback,
    focusAgentReportSection,
    recordCurrentSessionAnalytics,
    saveCurrentSessionToHistory,
    soundEngine,
  ]);

  // History & Analytics navigation
  const loadHistorySession = useCallback((entry: SessionHistoryEntry | NormalizedAnalyticsRunRecord) => {
    const s = liveRef.current;
    if (!entry || s.isRunning || s.isFollowupRunning) return;
    const normMode = normalizeWorkMode(entry.mode);
    s.mode = normMode;
    setMode(normMode);
    writeStorage(STORAGE_KEYS.mode, normMode);

    s.currentSessionId = entry.id || '';
    s.lastTopic = entry.topic || '';
    setCurrentSessionId(entry.id || '');
    setLastTopic(entry.topic || '');
    setPromptValue(entry.topic || '');
    setFollowupDraft('');

    const nextOutputs = createEmptyAgentMap('');
    const nextActual = createEmptyAgentMap('');
    const nextUsed = createEmptyAgentMap('');
    const nextTokens = createEmptyAgentMap(0);
    const nextStatuses = createEmptyAgentMap<AgentStatus>('idle');

    AGENTS.forEach((a) => {
      const out = entry.outputs?.[a.id] || '';
      nextOutputs[a.id] = out;
      nextActual[a.id] = entry.actualModels?.[a.id] || '';
      nextUsed[a.id] = entry.usedModels?.[a.id] || '';
      nextTokens[a.id] = Number(entry.tokenCounts?.[a.id]) || 0;
      nextStatuses[a.id] = out ? 'done' : 'idle';
    });

    s.outputs = nextOutputs;
    s.actualModels = nextActual;
    s.usedModels = nextUsed;
    s.tokenCounts = nextTokens;
    s.statuses = nextStatuses;
    s.errors = createEmptyAgentMap('');
    s.errorTypes = createEmptyAgentMap<ErrorType>('');
    s.errorLabels = createEmptyAgentMap('');
    s.retryStatus = createEmptyAgentMap('');

    setOutputs(nextOutputs);
    setActualModels(nextActual);
    setUsedModels(nextUsed);
    setTokenCounts(nextTokens);
    setStatuses(nextStatuses);
    setErrors(createEmptyAgentMap(''));
    setErrorTypes(createEmptyAgentMap<ErrorType>(''));
    setErrorLabels(createEmptyAgentMap(''));
    setRetryStatus(createEmptyAgentMap(''));

    setHistoryOpen(false);
    setSidebarCollapsed(false);
    setFocusRequest({ agentId: 'assistant', nonce: Date.now() + Math.random() });
  }, []);

  const handleClearHistory = useCallback(() => {
    liveRef.current.sessionHistory = [];
    setSessionHistory([]);
    writeStorage(STORAGE_KEYS.history, '[]');
  }, []);

  const handleOpenAnalyticsReport = useCallback(
    (runId: string) => {
      if (!runId) return;
      const s = liveRef.current;
      if (runId === s.currentSessionId && AGENTS.some((a) => Boolean(s.outputs[a.id]))) {
        setActiveView('office');
        focusAgentReportSection('assistant');
        return;
      }
      if (s.isRunning || s.isFollowupRunning) {
        setErrorBannerMsg('Đang chạy phân tích, không thể chuyển sang báo cáo phiên cũ lúc này.');
        return;
      }
      const entry =
        s.sessionHistory.find((item) => item.id === runId) ||
        s.analyticsRuns.find((item) => item.id === runId);
      if (!entry || !AGENTS.some((a) => Boolean(entry.outputs?.[a.id]))) return;
      loadHistorySession(entry);
      setActiveView('office');
    },
    [focusAgentReportSection, loadHistorySession]
  );

  // Export Markdown, Clipboard Copy, and Analytics CSV
  const handleDownloadMd = useCallback(() => {
    const s = liveRef.current;
    const fullMarkdown = buildFullReportMarkdown({
      mode: s.mode,
      topic: s.lastTopic,
      outputs: s.outputs,
      actualModels: s.actualModels,
      usedModels: s.usedModels,
      tokenCounts: s.tokenCounts,
    });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filename = `bao-cao-ai-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.md`;
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleCopyReport = useCallback(async () => {
    const s = liveRef.current;
    const fullMarkdown = buildFullReportMarkdown({
      mode: s.mode,
      topic: s.lastTopic,
      outputs: s.outputs,
      actualModels: s.actualModels,
      usedModels: s.usedModels,
      tokenCounts: s.tokenCounts,
    });
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullMarkdown);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = fullMarkdown;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopyLabel('Đã sao chép!');
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopyLabel('Copy toàn bộ báo cáo');
      }, 2200);
    } else {
      setErrorBannerMsg('Trình duyệt không cho phép truy cập clipboard tự động.');
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!analyticsMetrics.auditRows.length) return;
    const csvContent = buildAnalyticsCsv(analyticsMetrics.auditRows);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filename = `thong-ke-hieu-suat-ai-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [analyticsMetrics.auditRows]);

  const registerModelInputRef = useCallback((agentId: AgentId, el: HTMLInputElement | null) => {
    modelInputRefs.current[agentId] = el;
  }, []);

  const registerKeyInputRef = useCallback((agentId: AgentId, el: HTMLInputElement | null) => {
    keyInputRefs.current[agentId] = el;
  }, []);

  return (
    <>
      <Office3DCanvas
        mode={mode}
        statuses={statuses}
        outputs={outputs}
        errorTypes={errorTypes}
        errorLabels={errorLabels}
        retryStatus={retryStatus}
        agentStartedAt={agentStartedAt}
        isRunning={isRunning}
        runningAgents={runningAgents}
        burstTimers={burstTimers}
        cameraView={cameraView}
        cameraResetVersion={cameraResetVersion}
        sidebarCollapsed={sidebarCollapsed}
        cinemaMode={cinemaMode}
        onFocusAgentSection={focusAgentReportSection}
        onSelectCameraView={handleSelectCameraView}
        onPlayClick={soundEngine.playClick}
        onElectricZap={handleElectricZap}
      />

      <ViewSwitcher
        activeView={activeView}
        onSelectView={(view) => {
          soundEngine.playClick();
          setActiveView(view);
        }}
      />

      <ControlPanel
        collapsed={controlCollapsed}
        onToggleCollapse={() => setControlCollapsed((prev) => !prev)}
        cinemaMode={cinemaMode}
        onToggleCinemaMode={handleToggleCinemaMode}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        cameraView={cameraView}
        onSelectCameraView={handleSelectCameraView}
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        apiKeyInputRef={apiKeyInputRef}
        mode={mode}
        onSelectMode={handleSelectMode}
        companyMemory={companyMemory}
        onCompanyMemoryChange={handleCompanyMemoryChange}
        onClearCompanyMemory={handleClearCompanyMemory}
        onPlayClick={soundEngine.playClick}
      />

      <ExpertCouncilSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onExpandSidebar={() => setSidebarCollapsed(false)}
        mode={mode}
        statuses={statuses}
        outputs={outputs}
        actualModels={actualModels}
        usedModels={usedModels}
        agentModels={agentModels}
        agentApiKeys={agentApiKeys}
        agentSystemPrompts={agentSystemPrompts}
        tokenCounts={tokenCounts}
        errors={errors}
        errorTypes={errorTypes}
        errorLabels={errorLabels}
        retryStatus={retryStatus}
        isRunning={isRunning}
        isFollowupRunning={isFollowupRunning}
        runningAgents={runningAgents}
        lastTopic={lastTopic}
        pipelineSummary={pipelineSummary}
        historyOpen={historyOpen}
        onToggleHistory={(forceOpen) =>
          setHistoryOpen((prev) => (typeof forceOpen === 'boolean' ? forceOpen : !prev))
        }
        sessionHistory={sessionHistory}
        currentSessionId={currentSessionId}
        onSelectHistorySession={loadHistorySession}
        onClearHistory={handleClearHistory}
        onDownloadMd={handleDownloadMd}
        onCopyReport={handleCopyReport}
        copyLabel={copyLabel}
        onFocusSection={focusAgentReportSection}
        onModelChange={handleModelChange}
        onOwnKeyChange={handleOwnKeyChange}
        onSystemPromptChange={handleSystemPromptChange}
        onResetSystemPrompt={handleResetSystemPrompt}
        onRerunAgent={handleRerunAgent}
        onSynthesizeAssistant={handleSynthesizeAssistant}
        followupDraft={followupDraft}
        onFollowupDraftChange={setFollowupDraft}
        onSubmitFollowup={handleSubmitFollowup}
        focusRequest={focusRequest}
        followupInputRef={followupInputRef}
        registerModelInputRef={registerModelInputRef}
        registerKeyInputRef={registerKeyInputRef}
        onPlayClick={soundEngine.playClick}
      />

      <AnalyticsDashboard
        visible={activeView === 'analytics'}
        metrics={analyticsMetrics}
        activeMetric={analyticsAgentMetric}
        onSelectMetric={setAnalyticsAgentMetric}
        searchQuery={analyticsSearch}
        onSearchChange={setAnalyticsSearch}
        onBackToOffice={() => setActiveView('office')}
        onBackAndFocusPrompt={() => {
          setActiveView('office');
          promptInputRef.current?.focus();
        }}
        onExportCsv={handleExportCsv}
        onOpenReport={handleOpenAnalyticsReport}
        onPlayClick={soundEngine.playClick}
      />

      <PromptDock
        promptValue={promptValue}
        onPromptChange={setPromptValue}
        onSubmitTask={() => {
          soundEngine.playClick();
          runMultiAgentPipeline();
        }}
        isRunning={isRunning}
        submitLabel={submitLabel}
        errorMessage={errorBannerMsg}
        onDismissError={() => setErrorBannerMsg('')}
        cinemaMode={cinemaMode}
        tickerMessage={tickerMessage}
        promptInputRef={promptInputRef}
      />
    </>
  );
}
