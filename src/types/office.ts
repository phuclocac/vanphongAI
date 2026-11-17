import type { AgentId, AgentStatus, SavedSystemPromptsMap, WorkModeId } from '../core/workModes';
import type { AnalyticsRawEntry, NormalizedAnalyticsRunRecord, SessionHistoryEntry } from '../core/analytics';

export type WorkspaceView = 'office' | 'analytics';
export type CameraView = 'overview' | 'director';
export type AnalyticsAgentMetricKey = 'tokens' | 'duration' | 'success';
export type ErrorType = '' | 'timeout' | 'api' | 'network';

export interface BurstTimers {
  beat1DoneAt: number;
  beat2DoneAt: number;
  allDoneAt: number;
}

export interface OfficeAppState {
  apiKey: string;
  mode: WorkModeId;
  agentModels: Record<AgentId, string>;
  agentApiKeys: Record<AgentId, string>;
  agentSystemPrompts: SavedSystemPromptsMap;
  companyMemory: string;
  sessionHistory: SessionHistoryEntry[];
  analyticsRuns: NormalizedAnalyticsRunRecord[];
  activeView: WorkspaceView;
  analyticsSearch: string;
  analyticsAgentMetric: AnalyticsAgentMetricKey;
  currentSessionId: string;
  historyOpen: boolean;
  followupDraft: string;
  isFollowupRunning: boolean;
  isRunning: boolean;
  runningAgents: AgentId[];
  controlCollapsed: boolean;
  sidebarCollapsed: boolean;
  cinemaMode: boolean;
  soundEnabled: boolean;
  statuses: Record<AgentId, AgentStatus>;
  agentStartedAt: Record<AgentId, number>;
  agentDurations: Record<AgentId, number>;
  burstTimers: BurstTimers;
  outputs: Record<AgentId, string>;
  usedModels: Record<AgentId, string>;
  actualModels: Record<AgentId, string>;
  fallbackNotices?: Record<AgentId, string>;
  tokenCounts: Record<AgentId, number>;
  errors: Record<AgentId, string>;
  errorTypes: Record<AgentId, ErrorType>;
  errorLabels: Record<AgentId, string>;
  retryStatus: Record<AgentId, string>;
  lastTopic: string;
  sessionStartedAt: number;
  sessionDurationMs: number;
  sessionShockCount: number;
  sessionAutoRecoveries: number;
  sessionErrorCount: number;
}

export type LiveSessionSnapshotInput = AnalyticsRawEntry;

export interface SoundEngineApi {
  playClick: () => void;
  playBeatTransition: (beatNum: 2 | 3) => void;
  playExecutiveComplete: () => void;
  playElectricZap: () => void;
  playErrorAlert: (errorType?: string) => void;
}
