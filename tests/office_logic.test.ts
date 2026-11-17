import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadPureFunctionsFromIndexHtml(mockFetch?: typeof fetch) {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const startMarker = 'const WORK_MODES = {';
  const endMarker = '/* =========================================================================\n       * 2. APPLICATION STATE & UI REFERENCES';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  assert.ok(startIdx !== -1, 'WORK_MODES definition must exist in index.html');
  assert.ok(endIdx !== -1 && endIdx > startIdx, 'APPLICATION STATE marker must follow pure logic');

  const slice = html.slice(startIdx, endIdx);
  const sandbox: Record<string, unknown> = {
    fetch: mockFetch || globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    AbortController: globalThis.AbortController,
  };
  vm.runInNewContext(
    `${slice}\nthis.__exported = { WORK_MODES, DEFAULT_WORK_MODE, AGENTS, HALL_AGENTS, ASSISTANT_AGENT, SUGGESTED_MODELS, DEFAULT_AGENT_MODELS, RETRY_CONFIG, SOUND_PRESETS, ANALYTICS_MAX_RUNS, normalizeWorkMode, getModeMeta, getAgentRoleForMode, getDefaultSystemPrompt, isGeminiDirectModel, getModelProvider, loadSavedAgentModels, loadSavedAgentApiKeys, resolveAgentApiKey, resolveAgentKeyPlan, loadSavedSystemPrompts, resolveAgentSystemPrompt, extractOpenRouterUsageTokens, extractOpenRouterActualModel, formatTokenCount, normalizeMemoryBullets, parseAssistantMemoryExtraction, extractCoreSummary, formatContextForBeat3, loadSessionHistory, upsertSessionHistory, normalizeAnalyticsRunRecord, loadAnalyticsRuns, upsertAnalyticsRun, mergeAnalyticsSources, computeAnalyticsDashboardMetrics, buildAnalyticsCsv, buildFullReportMarkdown, buildAgentPrompt, buildAssistantFollowupPrompt, buildMemoryExtractionPrompt, protectMathInMarkdown, restoreMathInHtml, normalizeMarkdownTables, renderFallbackMarkdownToHtml, renderMarkdownToHtml, buildExactApiErrorInfo, classifyOpenRouterError, extractOpenRouterContent, callOpenRouterAgent, callOpenRouterWithKeyFallback, callAgentModel, runHybrid3BeatSequence, getSoundPreset, getPipelineProgressPercent, getAgentProgressState, getNeuralTickerMessage, resolveBeamLinkState, resolveJanitorTargetPlan };`,
    sandbox
  );

  return sandbox.__exported as {
    WORK_MODES: Record<
      string,
      {
        id: string;
        label: string;
        roles: Record<string, { name: string; titleVi: string; shortRole: string; systemPrompt: string }>;
      }
    >;
    DEFAULT_WORK_MODE: string;
    AGENTS: Array<{ id: string; step: number; beat: number; name: string; roleGroup: string; colorHex: string }>;
    HALL_AGENTS: Array<{ id: string; step: number; beat: number; name: string }>;
    ASSISTANT_AGENT: { id: string; step: number; beat: number; name: string };
    SUGGESTED_MODELS: Array<{ id: string; label: string }>;
    DEFAULT_AGENT_MODELS: Record<string, string>;
    RETRY_CONFIG: {
      maxRetries: number;
      retryDelayMs: number;
      silentRetryDelayMs: number;
      beat1CooldownMs: number;
      staggerDelayMs: number;
      requestTimeoutMs: number;
      autoFallbackModels: string[];
      stableRescueModels: string[];
      defaultMaxTokens: number;
      beat12MaxTokens: number;
      retryableStatuses: number[];
      keyFallbackStatuses: number[];
    };
    normalizeWorkMode: (mode: string | null) => string;
    getModeMeta: (mode: string) => { id: string; label: string };
    getAgentRoleForMode: (mode: string, agentId: string) => { name: string; titleVi: string; shortRole: string; systemPrompt: string };
    getDefaultSystemPrompt: (mode: string, agentId: string) => string;
    isGeminiDirectModel: (modelId: string) => boolean;
    getModelProvider: (modelId: string) => 'gemini' | 'openrouter';
    loadSavedAgentModels: (rawJson: string | null) => Record<string, string>;
    loadSavedAgentApiKeys: (rawJson: string | null) => Record<string, string>;
    resolveAgentApiKey: (agentId: string, globalApiKey: string, agentApiKeys?: Record<string, string>) => string;
    resolveAgentKeyPlan: (
      agentId: string,
      globalApiKey: string,
      agentApiKeys?: Record<string, string>,
      keyOverride?: string
    ) => { primaryKey: string; fallbackKey: string; usingOwnKey: boolean };
    loadSavedSystemPrompts: (rawJson: string | null) => Record<string, Record<string, string>>;
    resolveAgentSystemPrompt: (mode: string, agentId: string, savedMap?: Record<string, Record<string, string>>) => string;
    extractOpenRouterUsageTokens: (payload: unknown) => number;
    extractOpenRouterActualModel: (payload: unknown, fallbackModel?: string) => string;
    formatTokenCount: (n: number) => string;
    normalizeMemoryBullets: (rawText: string, maxBullets?: number) => string;
    parseAssistantMemoryExtraction: (
      assistantText: string,
      existingMemory?: string
    ) => { cleanReport: string; extractedMemory: string; mergedMemory: string };
    extractCoreSummary: (markdownText: string) => string;
    formatContextForBeat3: (markdownText: string, label: string) => string;
    loadSessionHistory: (rawJson: string | null) => Array<Record<string, unknown>>;
    upsertSessionHistory: (
      historyList: Array<Record<string, unknown>>,
      entry: Record<string, unknown>,
      maxItems?: number
    ) => Array<Record<string, unknown>>;
    buildFullReportMarkdown: (params: {
      mode: string;
      topic: string;
      outputs?: Record<string, string>;
      actualModels?: Record<string, string>;
      usedModels?: Record<string, string>;
      tokenCounts?: Record<string, number>;
    }) => string;
    buildAgentPrompt: (
      agentId: string,
      mode: string,
      userTopic: string,
      previousOutputs?: Record<string, string>,
      companyMemory?: string
    ) => string;
    buildAssistantFollowupPrompt: (params: {
      mode: string;
      userTopic: string;
      outputs?: Record<string, string>;
      currentSummary?: string;
      followupRequest?: string;
      companyMemory?: string;
    }) => string;
    buildMemoryExtractionPrompt: (params: {
      userTopic: string;
      outputs?: Record<string, string>;
      currentMemory?: string;
    }) => string;
    protectMathInMarkdown: (markdown: string) => { markdown: string; tokens: string[] };
    restoreMathInHtml: (html: string, tokens: string[]) => string;
    normalizeMarkdownTables: (mdText: string) => string;
    renderFallbackMarkdownToHtml: (markdown: string) => string;
    renderMarkdownToHtml: (mdText: string, markedLib?: { parse: (md: string, opts?: Record<string, unknown>) => string } | null) => string;
    buildExactApiErrorInfo: (
      provider: string,
      status: number,
      errorBodyText: string,
      rawError: Error | null,
      modelId?: string
    ) => { status: number; errorType: string; shortLabel: string; message: string };
    classifyOpenRouterError: (
      status: number,
      errorBodyText: string,
      rawError: Error | null,
      modelId?: string
    ) => string;
    extractOpenRouterContent: (payload: unknown) => string;
    callOpenRouterAgent: (
      apiKey: string,
      modelId: string,
      promptText: string,
      signal?: AbortSignal,
      options?: {
        maxRetries?: number;
        retryDelayMs?: number;
        timeoutMs?: number;
        maxTokens?: number;
        fallbackModel?: string;
        fallbackModels?: string[];
        omitMaxTokens?: boolean;
        systemPrompt?: string;
        onRetry?: (a: number, m: number, s: number | string) => void;
        onFallback?: (fallbackModel: string, reason: string) => void;
      }
    ) => Promise<{ text: string; totalTokens: number; actualModel: string }>;
    callOpenRouterWithKeyFallback: (params: {
      primaryKey: string;
      fallbackKey?: string;
      modelId: string;
      promptText: string;
      signal?: AbortSignal;
      options?: {
        maxRetries?: number;
        retryDelayMs?: number;
        timeoutMs?: number;
        maxTokens?: number;
        rescueOnModelError?: boolean;
        fallbackModel?: string;
        fallbackModels?: string[];
        systemPrompt?: string;
        onSilentRetry?: (attempt: number, maxAttempts: number, meta: Record<string, unknown>) => void;
        onRetry?: (a: number, m: number, s: number | string) => void;
        onFallback?: (fallbackModel: string, reason: string) => void;
        onKeyFallback?: (errStatus: number, err: Error) => void;
      };
    }) => Promise<{
      text: string;
      totalTokens: number;
      actualModel: string;
      attemptUsed: number;
      usedKeyFallback: boolean;
      usedModelFallback: boolean;
      fallbackFromStatus?: number;
      rescueModel?: string;
    }>;
    callAgentModel: (
      apiKey: string,
      modelId: string,
      promptText: string,
      signal?: AbortSignal,
      options?: Record<string, unknown>
    ) => Promise<{ text: string; totalTokens: number; actualModel: string }>;
    runHybrid3BeatSequence: (params: {
      runAgent: (agentId: string, staggerMs: number) => Promise<{ agent?: { id: string; name: string }; ok: boolean; error?: string }>;
      beat1CooldownMs?: number;
      staggerDelayMs?: number;
      signal?: AbortSignal;
      onBeatChange?: (beat: string) => void;
    }) => Promise<{ ok: boolean; failedBeat: number | null; failedAgents: Array<{ agent?: { id?: string; name?: string }; ok?: boolean; error?: string }> }>;
    SOUND_PRESETS: Record<string, Array<{ freq: number; endFreq: number; type: string; duration: number; gain: number; delay: number }>>;
    getSoundPreset: (name: string) => Array<{ freq: number; endFreq: number; type: string; duration: number; gain: number; delay: number }>;
    getPipelineProgressPercent: (statuses?: Record<string, string>, isRunning?: boolean) => number;
    getAgentProgressState: (
      status?: string,
      retryText?: string,
      startedAtMs?: number,
      nowMs?: number
    ) => { visible: boolean; percent: number; stageLabel: string };
    getNeuralTickerMessage: (mode: string, statuses?: Record<string, string>, isRunning?: boolean) => string;
    resolveBeamLinkState: (
      conn: { phase: string; sourceId: string; targetId: string },
      statuses?: Record<string, string>,
      outputs?: Record<string, string>,
      nowMs?: number,
      burstTimers?: Record<string, number>
    ) => { isStreaming: boolean; isPassed: boolean; isBursting: boolean };
    resolveJanitorTargetPlan: (
      statuses?: Record<string, string>,
      elapsedSec?: number,
      agentsList?: Array<{ id: string }>
    ) => { mode: string; targetAgentId: string | null; activeCount: number };
    ANALYTICS_MAX_RUNS: number;
    normalizeAnalyticsRunRecord: (rawEntry: Record<string, unknown>) => Record<string, unknown> | null;
    loadAnalyticsRuns: (rawJson: string | null) => Array<Record<string, unknown>>;
    upsertAnalyticsRun: (
      runsList: Array<Record<string, unknown>>,
      entry: Record<string, unknown>,
      maxItems?: number
    ) => Array<Record<string, unknown>>;
    mergeAnalyticsSources: (
      analyticsRuns?: Array<Record<string, unknown>>,
      sessionHistory?: Array<Record<string, unknown>>,
      liveSession?: Record<string, unknown> | null
    ) => Array<Record<string, unknown>>;
    computeAnalyticsDashboardMetrics: (runs?: Array<Record<string, unknown>>) => {
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
      agentMetrics: Array<{
        id: string;
        step: number;
        name: string;
        totalTokens: number;
        avgDurationSec: number;
        successRatePct: number;
        successCount: number;
        attemptCount: number;
      }>;
      modeDistribution: Array<{ id: string; label: string; count: number; pct: number }>;
      modelDistribution: Array<{ modelId: string; provider: string; calls: number; tokens: number; pct: number }>;
      auditRows: Array<{
        id: string;
        timestamp: string;
        topic: string;
        modeLabel: string;
        totalTokens: number;
        geminiTokens: number;
        openrouterTokens: number;
        durationSec: number;
        completedAll5: boolean;
        hasReportSnapshot: boolean;
      }>;
    };
    buildAnalyticsCsv: (auditRows?: Array<Record<string, unknown>>) => string;
  };
}

test('index.html defines 4 preset work modes, openrouter/free defaults for all 5 desks, and Critic audit rules', () => {
  const {
    WORK_MODES,
    DEFAULT_WORK_MODE,
    AGENTS,
    HALL_AGENTS,
    ASSISTANT_AGENT,
    SUGGESTED_MODELS,
    DEFAULT_AGENT_MODELS,
    RETRY_CONFIG,
    normalizeWorkMode,
    getDefaultSystemPrompt,
    loadSavedAgentModels,
  } = loadPureFunctionsFromIndexHtml();

  assert.equal(AGENTS.length, 5);
  assert.equal(HALL_AGENTS.length, 4);
  assert.equal(ASSISTANT_AGENT.id, 'assistant');
  assert.equal(DEFAULT_WORK_MODE, 'project_plan');
  assert.deepEqual(Object.keys(WORK_MODES), ['project_plan', 'study_research', 'econ_business', 'general_custom']);
  assert.equal(
    AGENTS.map((a) => `${a.id}:${a.beat}`).join(','),
    'researcher:1,quant:2,strategist:2,critic:3,assistant:3'
  );

  // Desks 1-4 default to openrouter/free; Trợ lý CEO defaults to meta-llama/llama-3.3-70b-instruct:free
  for (const id of ['researcher', 'quant', 'strategist', 'critic']) {
    assert.equal(DEFAULT_AGENT_MODELS[id], 'openrouter/free');
  }
  assert.equal(DEFAULT_AGENT_MODELS.assistant, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(SUGGESTED_MODELS[0].id, 'openrouter/free');
  assert.ok(SUGGESTED_MODELS.some((m) => m.id === 'meta-llama/llama-3.3-70b-instruct:free'));
  assert.ok(SUGGESTED_MODELS.some((m) => m.id === 'google/gemma-3-27b-it:free'));
  assert.ok(SUGGESTED_MODELS.some((m) => m.id === 'qwen/qwen-2.5-72b-instruct:free'));
  assert.equal(SUGGESTED_MODELS.some((m) => m.id === 'gemini-2.5-flash' || m.id === 'gemini-2.5-flash-lite'), false);
  assert.equal(SUGGESTED_MODELS.some((m) => m.label.includes('Google Free')), false);

  assert.equal(RETRY_CONFIG.maxRetries, 1);
  assert.equal(RETRY_CONFIG.retryDelayMs, 6000);
  assert.equal(RETRY_CONFIG.silentRetryDelayMs, 3000);
  assert.equal(RETRY_CONFIG.defaultMaxTokens, 4096);
  assert.equal(RETRY_CONFIG.beat1CooldownMs, 3000);
  assert.equal(RETRY_CONFIG.staggerDelayMs, 4000);
  assert.deepEqual(Array.from(RETRY_CONFIG.retryableStatuses), [429, 502, 503]);
  assert.deepEqual(Array.from(RETRY_CONFIG.keyFallbackStatuses), [429, 401, 402, 403, 502, 503]);

  // Legacy mode mapping
  assert.equal(normalizeWorkMode('case_study'), 'study_research');
  assert.equal(normalizeWorkMode('business_idea'), 'econ_business');
  assert.equal(normalizeWorkMode('unknown'), 'project_plan');

  // Anti-hallucination [Ước tính], [Tóm tắt cốt lõi], and Critic self-recalculation checks across all 4 modes
  for (const modeId of Object.keys(WORK_MODES)) {
    assert.match(getDefaultSystemPrompt(modeId, 'researcher'), /\[Ước tính\]/);
    assert.match(getDefaultSystemPrompt(modeId, 'researcher'), /\[Tóm tắt cốt lõi\]/);
    assert.match(getDefaultSystemPrompt(modeId, 'quant'), /\[Tóm tắt cốt lõi\]/);
    assert.match(getDefaultSystemPrompt(modeId, 'strategist'), /\[Tóm tắt cốt lõi\]/);
    assert.match(getDefaultSystemPrompt(modeId, 'critic'), /tự tính lại/i);
  }
  assert.match(getDefaultSystemPrompt('project_plan', 'critic'), /tổng số giờ.*quỹ thời gian/i);
  assert.match(getDefaultSystemPrompt('econ_business', 'critic'), /tổng chi phí.*ngân sách|vốn ban đầu/i);
  assert.match(getDefaultSystemPrompt('study_research', 'quant'), /LaTeX/);

  const customSaved = loadSavedAgentModels(
    JSON.stringify({
      researcher: 'meta-llama/llama-3.3-70b-instruct:free',
      quant: 'gemini-2.5-flash',
      critic: 'models/gemini-2.5-flash-lite',
      assistant: 'anthropic/claude-3.7-sonnet',
      strategist: '',
    })
  );
  assert.equal(customSaved.researcher, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(customSaved.quant, 'openrouter/free');
  assert.equal(customSaved.critic, 'openrouter/free');
  assert.equal(customSaved.assistant, 'anthropic/claude-3.7-sonnet');
  assert.equal(customSaved.strategist, 'openrouter/free');
  assert.equal(loadSavedAgentModels('{bad-json').critic, 'openrouter/free');
});

test('loadSavedSystemPrompts, resolveAgentSystemPrompt, and buildAgentPrompt handle per-mode roles cleanly', () => {
  const { loadSavedSystemPrompts, resolveAgentSystemPrompt, getDefaultSystemPrompt, buildAgentPrompt } =
    loadPureFunctionsFromIndexHtml();

  const saved = loadSavedSystemPrompts(
    JSON.stringify({
      project_plan: { critic: 'Chỉ thị kiểm duyệt giờ riêng' },
      study_research: { quant: '' },
    })
  );

  assert.equal(resolveAgentSystemPrompt('project_plan', 'critic', saved), 'Chỉ thị kiểm duyệt giờ riêng');
  assert.equal(
    resolveAgentSystemPrompt('econ_business', 'critic', saved),
    getDefaultSystemPrompt('econ_business', 'critic')
  );
  assert.equal(
    resolveAgentSystemPrompt('study_research', 'quant', saved),
    getDefaultSystemPrompt('study_research', 'quant')
  );

  const outputs = {
    researcher: 'DATA_BEAT_1',
    quant: 'TASK_SCHEDULE_HOURS',
    strategist: 'EXECUTION_TOOLS',
    critic: 'HOUR_AUDIT_OK',
  };
  const p2 = buildAgentPrompt('quant', 'project_plan', 'Làm app trong 12 giờ', outputs);
  assert.match(p2, /Lập Lịch & Chia Task/);
  assert.match(p2, /DATA_BEAT_1/);

  const p4 = buildAgentPrompt('critic', 'project_plan', 'Làm app trong 12 giờ', outputs);
  assert.match(p4, /Kiểm duyệt Tiến độ & Quỹ giờ/);
  assert.match(p4, /TASK_SCHEDULE_HOURS/);
  assert.match(p4, /EXECUTION_TOOLS/);

  const p5 = buildAgentPrompt('assistant', 'project_plan', 'Làm app trong 12 giờ', outputs);
  assert.match(p5, /Tổng hợp Kế hoạch Hành động/);
  assert.match(p5, /CEO Phúc/);
  assert.match(p5, /HOUR_AUDIT_OK/);
});

test('runHybrid3BeatSequence enforces 1 -> 2 -> 2 order, 3s Beat 1 cooldown, 4s Beat 2 & Beat 3 stagger, and stops cleanly on error', async () => {
  const { runHybrid3BeatSequence, RETRY_CONFIG } = loadPureFunctionsFromIndexHtml();

  const events: Array<{ phase: string; id: string; stagger: number }> = [];
  const beats: string[] = [];

  const okOutcome = await runHybrid3BeatSequence({
    beat1CooldownMs: 10,
    staggerDelayMs: RETRY_CONFIG.staggerDelayMs,
    onBeatChange: (b) => beats.push(b),
    runAgent: async (id, staggerMs) => {
      events.push({ phase: 'start', id, stagger: staggerMs });
      await new Promise((r) => setTimeout(r, id === 'quant' ? 15 : 5));
      events.push({ phase: 'end', id, stagger: staggerMs });
      return { agent: { id, name: id }, ok: true };
    },
  });

  assert.equal(okOutcome.ok, true);
  assert.equal(okOutcome.failedBeat, null);
  assert.deepEqual(beats, ['beat1', 'beat1_cooldown', 'beat2', 'beat3_critic', 'beat3_assistant']);

  const startIndices = Object.fromEntries(
    ['researcher', 'quant', 'strategist', 'critic', 'assistant'].map((id) => [
      id,
      events.findIndex((e) => e.phase === 'start' && e.id === id),
    ])
  );
  const endIndices = Object.fromEntries(
    ['researcher', 'quant', 'strategist', 'critic', 'assistant'].map((id) => [
      id,
      events.findIndex((e) => e.phase === 'end' && e.id === id),
    ])
  );

  assert.ok(endIndices.researcher < startIndices.quant);
  assert.ok(endIndices.researcher < startIndices.strategist);
  assert.equal(events[startIndices.quant].stagger, 0);
  assert.equal(events[startIndices.strategist].stagger, 4000);
  assert.ok(startIndices.strategist < endIndices.quant);
  assert.ok(endIndices.quant < startIndices.critic);
  assert.ok(endIndices.strategist < startIndices.critic);
  assert.ok(endIndices.critic < startIndices.assistant);
  assert.equal(events[startIndices.critic].stagger, 0);
  assert.equal(events[startIndices.assistant].stagger, 4000);

  const calledOnFailure: string[] = [];
  const failOutcome = await runHybrid3BeatSequence({
    beat1CooldownMs: 5,
    staggerDelayMs: 4000,
    runAgent: async (id) => {
      calledOnFailure.push(id);
      if (id === 'quant') return { agent: { id, name: 'Quant' }, ok: false, error: 'HTTP 429' };
      return { agent: { id, name: id }, ok: true };
    },
  });
  assert.equal(failOutcome.ok, false);
  assert.equal(failOutcome.failedBeat, 2);
  assert.ok(!calledOnFailure.includes('critic'));
  assert.ok(!calledOnFailure.includes('assistant'));
});

test('protectMathInMarkdown and restoreMathInHtml preserve $I_0$, $COGS$, and $$...$$ safely', () => {
  const { protectMathInMarkdown, restoreMathInHtml } = loadPureFunctionsFromIndexHtml();

  const md = [
    'Công thức vốn $I_0$ và giá vốn $COGS_{avg}$ kèm tiền $500 triệu.',
    '$$ROI = \\frac{L_{ròng}}{I_0} \\times 100\\%$$',
    'Code mẫu: `$not_math$`',
  ].join('\n');

  const { markdown, tokens } = protectMathInMarkdown(md);
  assert.equal(tokens.length, 3);
  assert.doesNotMatch(markdown, /\$I_0\$/);
  assert.doesNotMatch(markdown, /\$COGS_\{avg\}\$/);
  assert.match(markdown, /\$500 triệu/);
  assert.match(markdown, /`\$not_math\$`/);

  const simulatedHtml = `<p>${markdown.replace(/\n/g, '</p><p>')}</p>`;
  const restored = restoreMathInHtml(simulatedHtml, tokens);
  assert.match(restored, /\$I_0\$/);
  assert.match(restored, /\$COGS_\{avg\}\$/);
  assert.match(restored, /\$\$ROI = \\frac\{L_\{ròng\}\}\{I_0\} \\times 100\\%\$\$/);
});

test('extractOpenRouterUsageTokens, formatTokenCount, and callOpenRouterAgent handle system prompts, 1 retry, and token counts', async () => {
  let calls = 0;
  let capturedBody: { model?: string; messages?: Array<{ role: string; content: string }> } | null = null;

  const mockRetrySuccessFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    capturedBody = JSON.parse(String(init?.body || '{}'));
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { message: 'Service Unavailable' } }), { status: 503 });
    }
    return new Response(
      JSON.stringify({
        model: 'google/gemma-3-27b-it:free',
        choices: [{ message: { content: 'Thành công sau retry' } }],
        usage: { prompt_tokens: 400, completion_tokens: 850, total_tokens: 1250 },
      }),
      { status: 200 }
    );
  };

  const retryEvents: Array<[number, number, number | string]> = [];
  const fallbackEvents: Array<[string, string]> = [];
  const mod1 = loadPureFunctionsFromIndexHtml(mockRetrySuccessFetch as typeof fetch);
  const res = await mod1.callOpenRouterAgent('sk-test', 'openrouter/free', 'User context', undefined, {
    systemPrompt: 'Custom System Rule',
    retryDelayMs: 5,
    onRetry: (attempt, maxRetries, status) => retryEvents.push([attempt, maxRetries, status]),
    onFallback: (fbModel, reason) => fallbackEvents.push([fbModel, reason]),
  });

  assert.equal(res.text, 'Thành công sau retry');
  assert.equal(res.totalTokens, 1250);
  assert.equal(res.actualModel, 'google/gemma-3-27b-it:free');
  assert.equal(mod1.extractOpenRouterActualModel({}, 'openrouter/free'), 'openrouter/free');
  assert.equal(mod1.formatTokenCount(1250), '1.250 tokens');
  assert.equal(mod1.extractOpenRouterUsageTokens({ usage: { prompt_tokens: 120, completion_tokens: 80 } }), 200);
  assert.equal(mod1.extractOpenRouterUsageTokens({}), 0);
  assert.deepEqual(
    (capturedBody as { messages?: Array<{ role: string; content: string }> } | null)?.messages,
    [
      { role: 'system', content: 'Custom System Rule' },
      { role: 'user', content: 'User context' },
    ]
  );
  assert.equal(calls, 2);
  assert.deepEqual(retryEvents, [[1, 1, 503]]);
  assert.deepEqual(fallbackEvents, [['google/gemma-3-27b-it:free', '503']]);

  let permanentCalls = 0;
  const mockAlways503Fetch = async () => {
    permanentCalls += 1;
    return new Response(JSON.stringify({ error: { message: 'Overloaded' } }), { status: 503 });
  };
  const mod2 = loadPureFunctionsFromIndexHtml(mockAlways503Fetch as typeof fetch);
  await assert.rejects(
    () => mod2.callOpenRouterAgent('sk-test', 'openrouter/free', 'hello', undefined, { retryDelayMs: 5 }),
    (err: Error & { shortLabel?: string; status?: number }) =>
      err.status === 503 && err.shortLabel === 'Lỗi 503: Server quá tải'
  );
  assert.equal(permanentCalls, 2);
});

test('loadSavedAgentApiKeys, resolveAgentApiKey, and resolveAgentKeyPlan prioritize per-desk key with global OpenRouter fallback', () => {
  const {
    loadSavedAgentApiKeys,
    resolveAgentApiKey,
    resolveAgentKeyPlan,
  } = loadPureFunctionsFromIndexHtml();

  const loaded = loadSavedAgentApiKeys(
    JSON.stringify({
      quant: '  sk-or-quant-private  ',
      strategist: 'sk-or-global',
      assistant: 'sk-or-assistant-private',
    })
  );
  assert.equal(loaded.quant, 'sk-or-quant-private');
  assert.equal(loaded.assistant, 'sk-or-assistant-private');
  assert.equal(loaded.researcher, '');
  assert.equal(loadSavedAgentApiKeys('{invalid-json').critic, '');

  assert.equal(resolveAgentApiKey('quant', 'sk-or-global', loaded), 'sk-or-quant-private');
  assert.equal(resolveAgentApiKey('assistant', 'sk-or-global', loaded), 'sk-or-assistant-private');
  assert.equal(resolveAgentApiKey('researcher', '  sk-or-global  ', loaded), 'sk-or-global');
  assert.equal(resolveAgentApiKey('researcher', '', loaded), '');

  // Private key takes priority and carries global key as fallbackKey when distinct
  assert.deepEqual({ ...resolveAgentKeyPlan('quant', '  sk-or-global  ', loaded) }, {
    primaryKey: 'sk-or-quant-private',
    fallbackKey: 'sk-or-global',
    usingOwnKey: true,
  });

  // Empty private key uses global key directly with no redundant fallbackKey
  assert.deepEqual({ ...resolveAgentKeyPlan('researcher', '  sk-or-global  ', loaded) }, {
    primaryKey: 'sk-or-global',
    fallbackKey: '',
    usingOwnKey: false,
  });

  // Identical private & global keys do not set redundant fallbackKey
  assert.deepEqual({ ...resolveAgentKeyPlan('strategist', 'sk-or-global', loaded) }, {
    primaryKey: 'sk-or-global',
    fallbackKey: '',
    usingOwnKey: true,
  });

  // keyOverride matching private key still keeps global fallback; manual non-matching override clears fallback
  assert.deepEqual({ ...resolveAgentKeyPlan('quant', 'sk-or-global', loaded, 'sk-or-quant-private') }, {
    primaryKey: 'sk-or-quant-private',
    fallbackKey: 'sk-or-global',
    usingOwnKey: true,
  });
  assert.deepEqual({ ...resolveAgentKeyPlan('quant', 'sk-or-global', loaded, 'sk-or-manual-override') }, {
    primaryKey: 'sk-or-manual-override',
    fallbackKey: '',
    usingOwnKey: false,
  });
});

test('index.html enforces cleaned UI copy, 4 work modes, Nội quy / Chỉ thị riêng, token counters, and CEO naming', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.match(html, /https:\/\/openrouter\.ai\/api\/v1\/chat\/completions/);
  assert.match(html, /Chế độ làm việc/);
  assert.match(html, /Kế hoạch &amp; Dự án|Kế hoạch & Dự án/);
  assert.match(html, /Học tập &amp; Nghiên cứu|Học tập & Nghiên cứu/);
  assert.match(html, /Kinh tế &amp; Kinh doanh|Kinh tế & Kinh doanh/);
  assert.match(html, /Đa năng \/ Tùy chỉnh/);
  assert.match(html, /Nhập yêu cầu, mục tiêu hoặc vấn đề cần xử lý\.\.\./);
  assert.match(html, />Bắt đầu<\/span>/);
  assert.match(html, /Nội quy \/ Chỉ thị riêng/);
  assert.match(html, /Khôi phục mặc định/);
  assert.match(html, /session-total-tokens/);
  assert.match(html, /openrouter\/free/);
  assert.match(html, /Promise\.allSettled/);
  assert.match(html, /runHybrid3BeatSequence/);
  assert.match(html, /API Key riêng \(tùy chọn\)/);
  assert.match(html, /Đang ngủ/);
  assert.match(html, /Zzz/);
  assert.match(html, /CEO Phúc/);
  assert.match(html, /Yêu cầu Thư ký chỉnh sửa, đào sâu hoặc hỏi thêm về báo cáo này\.\.\./);
  assert.match(html, /Cập nhật báo cáo/);
  assert.match(html, /Sổ tay Ký ức \(Tự động ghi nhớ\)/);
  assert.match(html, /Xóa ký ức/);
  assert.match(html, /Lịch sử/);
  assert.match(html, /Tải \.md/);

  assert.doesNotMatch(html, /Điền đề bài mẫu/);
  assert.doesNotMatch(html, /Đề bài kinh tế \/ Ý tưởng kinh doanh/);
  assert.doesNotMatch(html, /Giao việc cho Team/);
  assert.doesNotMatch(html, /Chế độ phân tích/);
  assert.doesNotMatch(html, /Giám Đốc|Giám đốc/);
  assert.doesNotMatch(html, /towerInst|towerCrownInst|towerSpecs/);
  assert.doesNotMatch(html, /@google\/genai/);
});

test('Core summary extraction, Company Memory, follow-up QA prompt, history cap (10), and Markdown export work cleanly', () => {
  const {
    extractCoreSummary,
    formatContextForBeat3,
    normalizeMemoryBullets,
    parseAssistantMemoryExtraction,
    buildAgentPrompt,
    buildAssistantFollowupPrompt,
    upsertSessionHistory,
    loadSessionHistory,
    buildFullReportMarkdown,
  } = loadPureFunctionsFromIndexHtml();

  const verboseBeat1 = [
    'Phân tích chi tiết rất dài...',
    'Nhiều đoạn văn giải thích thừa...',
    '### [Tóm tắt cốt lõi]',
    '- [Ước tính] Giá thuê mặt bằng: 20 triệu/tháng',
    '- Quỹ thời gian tối đa: 14 ngày',
  ].join('\n');

  assert.equal(
    extractCoreSummary(verboseBeat1),
    '### [Tóm tắt cốt lõi]\n- [Ước tính] Giá thuê mặt bằng: 20 triệu/tháng\n- Quỹ thời gian tối đa: 14 ngày'
  );
  assert.doesNotMatch(formatContextForBeat3(verboseBeat1, 'Bàn 1'), /Phân tích chi tiết rất dài/);
  assert.equal(formatContextForBeat3('Plain output without block', 'Bàn 1'), 'Plain output without block');

  const p4 = buildAgentPrompt(
    'critic',
    'econ_business',
    'Mở quán trà sữa',
    { researcher: verboseBeat1, quant: 'Chi phí 250 triệu', strategist: 'Online-first' },
    '- Ngân sách tối đa 150 triệu\n- Ưu tiên bán mang đi'
  );
  assert.match(p4, /Ngân sách tối đa 150 triệu/);
  assert.doesNotMatch(p4, /Phân tích chi tiết rất dài/);

  const memParsed = parseAssistantMemoryExtraction(
    '## Báo cáo chính\nNội dung chốt.\n\n### [Ký ức cần ghi nhớ]\n- Ngân sách tối đa 150 triệu\n- Quỹ thời gian 2 giờ/ngày\n- Ưu tiên công cụ miễn phí',
    '- Ràng buộc cũ 1\n- Ràng buộc cũ 2\n- Ràng buộc cũ 3'
  );
  assert.equal(memParsed.cleanReport, '## Báo cáo chính\nNội dung chốt.');
  assert.equal(memParsed.mergedMemory.split('\n').length, 5);
  assert.equal(normalizeMemoryBullets('1. A\n2. B\n3. A\n4. C\n5. D\n6. E\n7. F', 5).split('\n').length, 5);

  const followupPrompt = buildAssistantFollowupPrompt({
    mode: 'project_plan',
    userTopic: 'Học TypeScript',
    outputs: { researcher: verboseBeat1, quant: '10h', strategist: 'Pomodoro', critic: 'OK' },
    currentSummary: 'Bản báo cáo v1',
    followupRequest: 'Rút gọn xuống còn 7 ngày',
    companyMemory: '- Quỹ 2h/ngày',
  });
  assert.match(followupPrompt, /Bản báo cáo v1/);
  assert.match(followupPrompt, /Rút gọn xuống còn 7 ngày/);
  assert.match(followupPrompt, /Quỹ 2h\/ngày/);

  let history: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= 12; i++) {
    history = upsertSessionHistory(history, { id: `s${i}`, topic: `Topic ${i}` }, 10);
  }
  assert.equal(history.length, 10);
  assert.equal(history[0].id, 's12');
  assert.equal(loadSessionHistory(JSON.stringify(history)).length, 10);

  const md = buildFullReportMarkdown({
    mode: 'econ_business',
    topic: 'Mở quán',
    outputs: { assistant: 'Chốt Go', researcher: 'Dữ liệu nền' },
    actualModels: { assistant: 'google/gemma-3-27b-it:free' },
    tokenCounts: { assistant: 500, researcher: 300 },
  });
  assert.match(md, /google\/gemma-3-27b-it:free/);
  assert.match(md, /800 tokens/);
  assert.match(md, /Chốt Go/);
});

test('Cyber-Executive UI controls, Sound presets, pipeline progress, neural ticker, and 3D beam transitions work accurately', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.match(html, /Chế độ Quay/);
  assert.match(html, /Live Neural Ticker/);
  assert.match(html, /sound-toggle-btn/);
  assert.match(html, /pipeline-progress-bar/);
  assert.match(html, /cinema-hide-tech/);

  const {
    SOUND_PRESETS,
    getSoundPreset,
    getPipelineProgressPercent,
    getNeuralTickerMessage,
    resolveBeamLinkState,
  } = loadPureFunctionsFromIndexHtml();

  assert.ok(SOUND_PRESETS.click.length >= 1);
  assert.ok(SOUND_PRESETS.beat2.length >= 2);
  assert.ok(SOUND_PRESETS.beat3.length >= 2);
  assert.ok(SOUND_PRESETS.complete.length >= 4);
  assert.deepEqual(getSoundPreset('unknown-preset'), SOUND_PRESETS.click);

  assert.equal(getPipelineProgressPercent({}, false), 0);
  assert.equal(getPipelineProgressPercent({}, true), 8);
  assert.equal(getPipelineProgressPercent({ researcher: 'active' }, true), 16);
  assert.equal(getPipelineProgressPercent({ researcher: 'done' }, true), 34);
  assert.equal(getPipelineProgressPercent({ researcher: 'done', quant: 'active', strategist: 'active' }, true), 48);
  assert.equal(getPipelineProgressPercent({ researcher: 'done', quant: 'done', strategist: 'done' }, true), 64);
  assert.equal(
    getPipelineProgressPercent({ researcher: 'done', quant: 'done', strategist: 'done', critic: 'active' }, true),
    72
  );
  assert.equal(
    getPipelineProgressPercent({ researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'active' }, true),
    90
  );
  assert.equal(
    getPipelineProgressPercent({ researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'done' }, false),
    100
  );

  assert.match(getNeuralTickerMessage('project_plan', {}, false), /CEO Phúc/);
  assert.match(getNeuralTickerMessage('project_plan', { researcher: 'active' }, true), /Nhịp 1\/3/);
  assert.match(
    getNeuralTickerMessage('project_plan', { researcher: 'done', quant: 'active', strategist: 'active' }, true),
    /Nhịp 2\/3/
  );
  assert.match(
    getNeuralTickerMessage('project_plan', { researcher: 'done', quant: 'done', strategist: 'done', critic: 'active' }, true),
    /Nhịp 3\/3/
  );
  assert.match(
    getNeuralTickerMessage('project_plan', { researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'active' }, true),
    /CEO Phúc/
  );
  assert.match(
    getNeuralTickerMessage('project_plan', { researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'done' }, false),
    /vàng kim/
  );
  assert.match(getNeuralTickerMessage('project_plan', { quant: 'error' }, false), /Cảnh báo/);

  // 3D Visual Data Flow: Beat 1 -> Beat 2 burst
  const beat2Burst = resolveBeamLinkState(
    { phase: 'beat2', sourceId: 'researcher', targetId: 'quant' },
    { researcher: 'done', quant: 'active' },
    { researcher: 'ok' },
    10000,
    { beat1DoneAt: 9200 }
  );
  assert.equal(beat2Burst.isBursting, true);
  assert.equal(beat2Burst.isStreaming, true);
  assert.equal(beat2Burst.isPassed, false);

  // Beat 2 -> Beat 3 burst (Critic and Assistant)
  const beat3Burst = resolveBeamLinkState(
    { phase: 'beat3_critic', sourceId: 'quant', targetId: 'critic' },
    { researcher: 'done', quant: 'done', strategist: 'done', critic: 'active' },
    { researcher: 'ok', quant: 'q', strategist: 's' },
    15000,
    { beat2DoneAt: 14500 }
  );
  assert.equal(beat3Burst.isBursting, true);
  assert.equal(beat3Burst.isStreaming, true);
  assert.equal(beat3Burst.isPassed, false);

  const synthPassed = resolveBeamLinkState(
    { phase: 'synthesize', sourceId: 'critic', targetId: 'assistant' },
    { researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'done' },
    { researcher: 'r', quant: 'q', strategist: 's', critic: 'c', assistant: 'a' },
    20000,
    {}
  );
  assert.equal(synthPassed.isPassed, true);

  // All done -> Golden beam to Director Phuc
  const dirBurst = resolveBeamLinkState(
    { phase: 'director', sourceId: 'assistant', targetId: 'director' },
    { researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'done' },
    { researcher: 'r', quant: 'q', strategist: 's', critic: 'c', assistant: 'a' },
    22000,
    { allDoneAt: 20500 }
  );
  assert.equal(dirBurst.isBursting, true);
  assert.equal(dirBurst.isStreaming, true);
  assert.equal(dirBurst.isPassed, true);
});

test('getAgentProgressState tracks active circular progress rings cleanly and CEO yellow window artifacts are fixed', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.match(html, /class="agent-progress-wrap hidden"/);
  assert.match(html, /class="agent-progress-arc"/);
  assert.match(html, /skyTopBar/);
  assert.doesNotMatch(html, /\bskyFrame\b/);
  assert.doesNotMatch(html, /\bchandelierRing\b/);

  const { getAgentProgressState } = loadPureFunctionsFromIndexHtml();

  assert.deepEqual({ ...getAgentProgressState('idle', '', 0, 1000) }, {
    visible: false,
    percent: 0,
    stageLabel: '',
  });
  assert.deepEqual({ ...getAgentProgressState('done', '', 1000, 5000) }, {
    visible: false,
    percent: 100,
    stageLabel: 'Hoàn tất',
  });
  assert.deepEqual({ ...getAgentProgressState('error', '', 1000, 5000) }, {
    visible: false,
    percent: 0,
    stageLabel: 'Lỗi',
  });

  const t0 = getAgentProgressState('active', '', 10000, 10000);
  const t2 = getAgentProgressState('active', '', 10000, 12000);
  const t8 = getAgentProgressState('active', '', 10000, 18000);
  const t30 = getAgentProgressState('active', '', 10000, 40000);
  const tRetry = getAgentProgressState('active', 'Thử lại 1/3...', 10000, 12000);

  assert.equal(t0.visible, true);
  assert.equal(t0.percent, 12);
  assert.equal(t0.stageLabel, 'Khởi tạo');

  assert.equal(t2.visible, true);
  assert.ok(t2.percent > t0.percent && t2.percent < t8.percent);
  assert.equal(t2.stageLabel, 'Phân tích');

  assert.equal(t8.visible, true);
  assert.ok(t8.percent >= 72 && t8.percent <= 94);
  assert.equal(t8.stageLabel, 'Hoàn thiện');

  assert.equal(t30.percent, 94);
  assert.equal(tRetry.stageLabel, 'Thử lại 1/3...');
});

test('35s timeout AbortController, openrouter/free auto-fallback, max_tokens=1500, concise prompts, sealed West wall, removed ceiling lights, and collapsible HUD panel', async () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  // Architectural & UI checks
  assert.match(html, /backWallWestBottom/);
  assert.match(html, /backWallWestTop/);
  assert.doesNotMatch(html, /\bbarGlow\b/);
  assert.match(html, /id="toggle-control-btn"/);
  assert.match(html, /setControlPanelCollapsed/);
  assert.match(html, /Lỗi \(Quá thời gian\)/);

  const { WORK_MODES, RETRY_CONFIG, getDefaultSystemPrompt } = loadPureFunctionsFromIndexHtml();
  assert.equal(RETRY_CONFIG.requestTimeoutMs, 35000);
  assert.equal(RETRY_CONFIG.defaultMaxTokens, 4096);
  assert.equal(RETRY_CONFIG.beat12MaxTokens, 4096);
  assert.ok(RETRY_CONFIG.autoFallbackModels.includes('meta-llama/llama-3.3-70b-instruct:free'));
  assert.ok(RETRY_CONFIG.autoFallbackModels.includes('google/gemma-3-27b-it:free'));

  // All 4 work modes & 5 roles enforce concise <400 words & short Markdown tables
  for (const modeId of Object.keys(WORK_MODES)) {
    for (const roleId of ['researcher', 'quant', 'strategist', 'critic', 'assistant']) {
      const sp = getDefaultSystemPrompt(modeId, roleId);
      assert.match(sp, /dưới 400 từ/);
      assert.match(sp, /tối đa 5 dòng\/bảng/);
      assert.match(sp, /không viết văn giải thích dài dòng/);
    }
  }

  // 1) max_tokens: 4096 forwarded by default and when explicitly passed
  const seenBodies: Array<Record<string, unknown>> = [];
  const modPayload = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
    seenBodies.push(JSON.parse(String(init?.body || '{}')));
    return new Response(
      JSON.stringify({
        model: 'openrouter/free',
        choices: [{ message: { content: 'OK' } }],
        usage: { total_tokens: 50 },
      }),
      { status: 200 }
    );
  }) as typeof fetch);

  await modPayload.callOpenRouterAgent('sk-test', 'openrouter/free', 'prompt 1', undefined, {
    maxTokens: RETRY_CONFIG.defaultMaxTokens,
  });
  await modPayload.callOpenRouterAgent('sk-test', 'openrouter/free', 'prompt 2', undefined, {});
  assert.equal(seenBodies[0].max_tokens, 4096);
  assert.equal(seenBodies[1].max_tokens, 4096);

  // 2) Auto-fallback from openrouter/free on network error (with 1 retry)
  const fallbackReasons: Array<[string, string]> = [];
  const calledModels: string[] = [];
  const modFallbackNet = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    calledModels.push(body.model);
    if (body.model === 'openrouter/free') {
      throw new TypeError('Failed to fetch');
    }
    return new Response(
      JSON.stringify({
        model: body.model,
        choices: [{ message: { content: 'Recovered via fast fallback' } }],
        usage: { total_tokens: 88 },
      }),
      { status: 200 }
    );
  }) as typeof fetch);

  const fbRes = await modFallbackNet.callOpenRouterAgent('sk-test', 'openrouter/free', 'hello', undefined, {
    retryDelayMs: 5,
    onFallback: (m, r) => fallbackReasons.push([m, r]),
  });
  assert.equal(fbRes.text, 'Recovered via fast fallback');
  assert.equal(fbRes.actualModel, 'google/gemma-3-27b-it:free');
  assert.deepEqual(calledModels, ['openrouter/free', 'google/gemma-3-27b-it:free']);
  assert.deepEqual(fallbackReasons, [['google/gemma-3-27b-it:free', 'network']]);

  // 3) 429 on openrouter/free triggers 1 retry switching immediately to stable free model
  const rateLimitModels: string[] = [];
  const modFallback429 = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    rateLimitModels.push(body.model);
    if (body.model === 'openrouter/free') {
      return new Response(JSON.stringify({ error: { message: 'Rate limited' } }), { status: 429 });
    }
    return new Response(
      JSON.stringify({
        model: body.model,
        choices: [{ message: { content: 'Fallback after 429' } }],
        usage: { total_tokens: 77 },
      }),
      { status: 200 }
    );
  }) as typeof fetch);
  const res429 = await modFallback429.callOpenRouterAgent('sk-test', 'openrouter/free', 'hello', undefined, {
    maxRetries: 1,
    retryDelayMs: 5,
  });
  assert.equal(res429.text, 'Fallback after 429');
  assert.deepEqual(rateLimitModels, ['openrouter/free', 'google/gemma-3-27b-it:free']);

  // 4) AbortController timeout rejects with isTimeout=true & exact shortLabel
  const modTimeout = loadPureFunctionsFromIndexHtml(((_url: RequestInfo | URL, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }) as typeof fetch);

  await assert.rejects(
    () =>
      modTimeout.callOpenRouterAgent('sk-test', 'openai/gpt-4o-mini', 'slow task', undefined, {
        timeoutMs: 25,
      }),
    (err: Error & { isTimeout?: boolean; shortLabel?: string }) =>
      err.isTimeout === true && err.shortLabel === 'Lỗi Timeout >35s'
  );
});

test('OpenRouter-only UI cleanup, automatic Global Key Fallback on 429/401/402/403, and exact error labels work end-to-end', async () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.match(html, /id="api-key-input"/);
  assert.doesNotMatch(html, /id="gemini-api-key-section"/);
  assert.doesNotMatch(html, /id="gemini-api-key-input"/);
  assert.doesNotMatch(html, /id="toggle-gemini-key-visibility"/);
  assert.doesNotMatch(html, /generativelanguage\.googleapis\.com/);
  assert.doesNotMatch(html, /\(Google Free/);
  assert.doesNotMatch(html, /Gặp lỗi API/);

  // 1) Automatic fallback from private key to global key on 429, 401, 402, and 403
  for (const status of [429, 401, 402, 403]) {
    const authHeaders: string[] = [];
    const fallbackCallbacks: number[] = [];
    const modFallback = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const auth = headers.Authorization || '';
      authHeaders.push(auth);
      if (auth === 'Bearer sk-or-private-bad') {
        return new Response(
          JSON.stringify({ error: { message: `Private key failed with ${status}` } }),
          { status }
        );
      }
      return new Response(
        JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          choices: [{ message: { content: `Thành công bằng Key gốc sau lỗi ${status}` } }],
          usage: { prompt_tokens: 90, completion_tokens: 110, total_tokens: 200 },
        }),
        { status: 200 }
      );
    }) as typeof fetch);

    const res = await modFallback.callOpenRouterWithKeyFallback({
      primaryKey: 'sk-or-private-bad',
      fallbackKey: 'sk-or-global-valid',
      modelId: 'meta-llama/llama-3.3-70b-instruct:free',
      promptText: 'Kiểm tra fallback key',
      options: {
        retryDelayMs: 5,
        onKeyFallback: (errStatus) => fallbackCallbacks.push(errStatus),
      },
    });

    assert.equal(res.usedKeyFallback, true);
    assert.equal(res.fallbackFromStatus, status);
    assert.equal(res.text, `Thành công bằng Key gốc sau lỗi ${status}`);
    assert.equal(res.totalTokens, 200);
    assert.deepEqual(fallbackCallbacks, [status]);
    assert.equal(authHeaders[authHeaders.length - 1], 'Bearer sk-or-global-valid');
    assert.ok(authHeaders.some((h) => h === 'Bearer sk-or-private-bad'));
  }

  // 2) Non-fallbackable HTTP status (e.g. 404 model not found) must NOT switch to global key
  const auth404: string[] = [];
  const modNoFallback = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    auth404.push(headers.Authorization || '');
    return new Response(JSON.stringify({ error: { message: 'Model not found' } }), { status: 404 });
  }) as typeof fetch);

  await assert.rejects(
    () =>
      modNoFallback.callOpenRouterWithKeyFallback({
        primaryKey: 'sk-or-private-bad',
        fallbackKey: 'sk-or-global-valid',
        modelId: 'unknown/model',
        promptText: 'No fallback on 404',
        options: { retryDelayMs: 5 },
      }),
    (err: Error & { status?: number }) => err.status === 404
  );
  assert.deepEqual(auth404, ['Bearer sk-or-private-bad']);

  // 3) If all 3 silent rescue attempts fail, propagate final error cleanly
  const authBothFail: string[] = [];
  const modelsBothFail: string[] = [];
  const modBothFail = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    const body = JSON.parse(String(init?.body || '{}'));
    const auth = headers.Authorization || '';
    authBothFail.push(auth);
    modelsBothFail.push(body.model);
    if (auth === 'Bearer sk-or-private-401') {
      return new Response(JSON.stringify({ error: { message: 'Invalid private key' } }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: { message: 'Global quota exceeded' } }), { status: 402 });
  }) as typeof fetch);

  await assert.rejects(
    () =>
      modBothFail.callOpenRouterWithKeyFallback({
        primaryKey: 'sk-or-private-401',
        fallbackKey: 'sk-or-global-402',
        modelId: 'openai/gpt-4o-mini',
        promptText: 'Both fail',
        options: { retryDelayMs: 5 },
      }),
    (err: Error & { status?: number; shortLabel?: string }) =>
      err.status === 402 && err.shortLabel === 'Lỗi 402: Hết hạn mức ngày'
  );
  assert.deepEqual(authBothFail, ['Bearer sk-or-private-401', 'Bearer sk-or-global-402', 'Bearer sk-or-global-402']);
  assert.deepEqual(modelsBothFail, ['openai/gpt-4o-mini', 'openai/gpt-4o-mini', 'google/gemma-3-27b-it:free']);

  // 4) Exact error labels
  const { buildExactApiErrorInfo } = modBothFail;
  assert.equal(buildExactApiErrorInfo('openrouter', 429, '', null, 'openrouter/free').shortLabel, 'Lỗi 429: Quá lượt gọi/phút');
  assert.equal(buildExactApiErrorInfo('openrouter', 402, '', null, 'openai/gpt-4o').shortLabel, 'Lỗi 402: Hết hạn mức ngày');
  assert.equal(buildExactApiErrorInfo('openrouter', 401, '', null, 'openai/gpt-4o').shortLabel, 'Lỗi 401: Sai API Key');
  assert.equal(
    buildExactApiErrorInfo(
      'openrouter',
      400,
      JSON.stringify({ error: { message: 'Invalid model ID specified' } }),
      null,
      'openai/gpt-4o'
    ).shortLabel,
    'Lỗi 400: Invalid model ID specified'
  );
  const timeoutDummy = new Error('Timed out') as Error & { isTimeout?: boolean };
  timeoutDummy.isTimeout = true;
  assert.equal(buildExactApiErrorInfo('openrouter', 0, '', timeoutDummy, 'openrouter/free').shortLabel, 'Lỗi Timeout >35s');
});

test('Right sidebar uses uniform top-4 bottom-4 right-4 viewport framing, internal Thu gọn button, and unified min-h-0 scroll region', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  const asideStart = html.indexOf('<aside\n      id="report-sidebar"');
  const asideEnd = html.indexOf('</aside>', asideStart);
  assert.ok(asideStart !== -1 && asideEnd !== -1, 'report-sidebar aside block must exist');
  const asideHtml = html.slice(asideStart, asideEnd + '</aside>'.length);

  assert.match(asideHtml, /top-4 bottom-4 right-4/);
  assert.match(asideHtml, /max-h-\[calc\(100vh-2rem\)\]/);
  assert.match(asideHtml, /flex flex-col overflow-hidden/);
  assert.match(asideHtml, /rounded-2xl/);
  assert.doesNotMatch(asideHtml, /top-\[282px\]/);
  assert.doesNotMatch(asideHtml, /max-h-\[55%\]/);

  const drawerStart = asideHtml.indexOf('id="sidebar-drawer"');
  const toggleBtnIdx = asideHtml.indexOf('id="toggle-sidebar-btn"');
  const reportScrollIdx = asideHtml.indexOf('id="report-scroll"');
  const progressListIdx = asideHtml.indexOf('id="agent-progress-list"');
  const reportSectionsIdx = asideHtml.indexOf('id="report-sections"');

  assert.ok(drawerStart !== -1 && toggleBtnIdx > drawerStart, 'toggle-sidebar-btn must be inside sidebar-drawer');
  assert.ok(reportScrollIdx !== -1 && progressListIdx > reportScrollIdx && reportSectionsIdx > reportScrollIdx, 'agent-progress-list and report-sections must live inside unified report-scroll');
  assert.match(asideHtml, /id="report-scroll"[^>]*class="[^"]*flex-1 overflow-y-auto min-h-0/);
  assert.match(html, /id="expand-sidebar-btn"/);
});

test('3D nameplate Zzz containment, Siêu nhân Điện quang + shock VFX, generalized Memory prompts, and errorType scope + error alerts', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

  // 1) Nameplate Zzz fit rules
  assert.match(html, /min-width:\s*176px;/);
  assert.doesNotMatch(html, /max-width:\s*212px;/);
  assert.match(html, /class="agent-label-card w-max max-w-\[280px\] px-3 py-2 flex flex-col gap-1 text-left"/);
  assert.match(html, /class="agent-badge-slot[^"]*shrink-0 whitespace-nowrap"/);
  assert.match(html, /class="agent-sleep-zzz[^"]*whitespace-nowrap">Zzz<\/span>/);

  // 2) 3D Electric Superhero ("⚡ Siêu nhân Điện quang") avatar, stun spear, shock arcs, sound & 3x typing
  assert.match(html, /class="janitor-label-card">⚡ Siêu nhân Điện quang<\/div>/);
  assert.doesNotMatch(html, />⚡ Lao công</);
  assert.match(html, /heroChestPlate/);
  assert.match(html, /heroCapePivot/);
  assert.match(html, /heroCrestFin/);
  assert.match(html, /heroColorTimer/);
  assert.match(html, /janitorWalkPhase/);
  assert.match(html, /janitorAnimSpeed/);
  assert.match(html, /janitorArrivedAtGoal/);
  assert.match(html, /shockBoltCyan/);
  assert.match(html, /shockBoltYellow/);
  assert.match(html, /SoundEngine\.playElectricZap\(\)/);
  assert.match(html, /const typeFreq = isShocked \? 66 : 22;/);

  // 3) errorType must be defined at agent loop scope before if (rig) and if (ctrl), plus error sound alert helper
  const syncFnStart = html.indexOf('function sync3DNameplatesAndProgress()');
  const syncFnEnd = html.indexOf('function renderReportSections()', syncFnStart);
  assert.ok(syncFnStart !== -1 && syncFnEnd > syncFnStart);
  const syncFnBody = html.slice(syncFnStart, syncFnEnd);
  const errTypeDeclIdx = syncFnBody.indexOf('const errorType = (appState.errorTypes && appState.errorTypes[agent.id]) || \'\';');
  const ifRigIdx = syncFnBody.indexOf('if (rig) {');
  const ifCtrlIdx = syncFnBody.indexOf('if (ctrl) {');
  assert.ok(errTypeDeclIdx !== -1 && errTypeDeclIdx < ifRigIdx && errTypeDeclIdx < ifCtrlIdx, 'errorType must be hoisted before if (rig) and if (ctrl)');
  assert.match(html, /function playErrorAlert\(errorType = 'api'\)/);
  assert.match(html, /SoundEngine\.playErrorAlert\(errorType\)/);

  const {
    WORK_MODES,
    SOUND_PRESETS,
    getDefaultSystemPrompt,
    buildAgentPrompt,
    buildMemoryExtractionPrompt,
    resolveJanitorTargetPlan,
  } = loadPureFunctionsFromIndexHtml();

  assert.ok(Array.isArray(SOUND_PRESETS.electricZap) && SOUND_PRESETS.electricZap.length >= 2);
  assert.ok(Array.isArray(SOUND_PRESETS.errorApi) && SOUND_PRESETS.errorApi.length >= 2);
  assert.ok(Array.isArray(SOUND_PRESETS.errorTimeout) && SOUND_PRESETS.errorTimeout.length >= 2);
  assert.ok(Array.isArray(SOUND_PRESETS.errorNetwork) && SOUND_PRESETS.errorNetwork.length >= 2);

  // Patrol when nobody is active
  assert.deepEqual({ ...resolveJanitorTargetPlan({}, 0) }, { mode: 'patrol', targetAgentId: null, activeCount: 0 });
  assert.deepEqual(
    { ...resolveJanitorTargetPlan({ researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'done' }, 12) },
    { mode: 'patrol', targetAgentId: null, activeCount: 0 }
  );

  // Single active worker (Beat 1)
  assert.deepEqual(
    { ...resolveJanitorTargetPlan({ researcher: 'active' }, 1.2) },
    { mode: 'shock', targetAgentId: 'researcher', activeCount: 1 }
  );

  // Beat 2 dual active workers alternate every 2.6s
  const slot0 = resolveJanitorTargetPlan({ researcher: 'done', quant: 'active', strategist: 'active' }, 0.5);
  const slot1 = resolveJanitorTargetPlan({ researcher: 'done', quant: 'active', strategist: 'active' }, 3.0);
  const slot2 = resolveJanitorTargetPlan({ researcher: 'done', quant: 'active', strategist: 'active' }, 5.5);
  assert.equal(slot0.mode, 'shock');
  assert.equal(slot0.activeCount, 2);
  assert.equal(slot0.targetAgentId, 'quant');
  assert.equal(slot1.targetAgentId, 'strategist');
  assert.equal(slot2.targetAgentId, 'quant');

  // 4) Generalized Company Memory rules (no product/industry specifics)
  for (const modeId of Object.keys(WORK_MODES)) {
    const sp = getDefaultSystemPrompt(modeId, 'assistant');
    assert.match(sp, /nguyên tắc quản trị dùng chung/i);
    assert.match(sp, /TUYỆT ĐỐI KHÔNG lưu tên sản phẩm/i);
  }
  const beat3Prompt = buildAgentPrompt('assistant', 'econ_business', 'Mở tiệm bánh ngọt', {
    researcher: 'R',
    quant: 'Q',
    strategist: 'S',
    critic: 'C',
  });
  assert.match(beat3Prompt, /nguyên tắc quản trị dùng chung/i);
  assert.match(beat3Prompt, /TUYỆT ĐỐI KHÔNG lưu tên sản phẩm/i);

  const memPrompt = buildMemoryExtractionPrompt({
    userTopic: 'Mở tiệm bánh ngọt',
    outputs: { assistant: 'Báo cáo' },
    currentMemory: '',
  });
  assert.match(memPrompt, /nguyên tắc quản trị dùng chung/i);
  assert.match(memPrompt, /TUYỆT ĐỐI KHÔNG lưu tên sản phẩm/i);
});

test('Full-screen Executive Analytics Dashboard computes real KPIs, provider token splits, 5-agent metrics, mode/model distribution, and CSV export cleanly', () => {
  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  assert.match(html, /id="workspace-view-switcher"/);
  assert.match(html, /id="view-tab-office"/);
  assert.match(html, /id="view-tab-analytics"/);
  assert.match(html, /id="analytics-dashboard-view"/);
  assert.match(html, /id="export-analytics-csv-btn"/);
  assert.match(html, /id="analytics-audit-tbody"/);

  const {
    ANALYTICS_MAX_RUNS,
    upsertAnalyticsRun,
    loadAnalyticsRuns,
    mergeAnalyticsSources,
    computeAnalyticsDashboardMetrics,
    buildAnalyticsCsv,
  } = loadPureFunctionsFromIndexHtml();

  assert.equal(ANALYTICS_MAX_RUNS, 50);

  const run1 = {
    id: 'sess_100',
    timestamp: '2026-11-16T08:00:00.000Z',
    mode: 'econ_business',
    topic: 'Kế hoạch mở tiệm cà phê "Đặc Biệt", vốn 200tr',
    outputs: {
      researcher: 'R1',
      quant: 'Q1',
      strategist: 'S1',
      critic: 'C1',
      assistant: 'A1',
    },
    actualModels: {
      researcher: 'gemini-2.5-flash',
      quant: 'gemini-2.5-flash-lite',
      strategist: 'google/gemma-3-27b-it:free',
      critic: 'gemini-2.5-flash',
      assistant: 'meta-llama/llama-3.3-70b-instruct:free',
    },
    tokenCounts: { researcher: 300, quant: 400, strategist: 500, critic: 250, assistant: 750 },
    agentDurations: { researcher: 2000, quant: 3000, strategist: 4000, critic: 2500, assistant: 3500 },
    agentStatuses: { researcher: 'done', quant: 'done', strategist: 'done', critic: 'done', assistant: 'done' },
    durationMs: 22000,
    shockCount: 8,
    autoRecoveries: 1,
    errorCount: 0,
  };

  const legacyHistorySession = {
    id: 'sess_90',
    timestamp: '2026-11-15T10:00:00.000Z',
    mode: 'project_plan',
    topic: 'Lộ trình học Rust trong 14 ngày',
    outputs: { researcher: 'R0', quant: '', strategist: '' },
    usedModels: { researcher: 'gemini-2.5-flash', quant: 'openrouter/free' },
    tokenCounts: { researcher: 600 },
  };

  let runs = upsertAnalyticsRun([], run1);
  runs = loadAnalyticsRuns(JSON.stringify(runs));
  assert.equal(runs.length, 1);

  const merged = mergeAnalyticsSources(runs, [legacyHistorySession, run1]);
  assert.equal(merged.length, 2);

  const metrics = computeAnalyticsDashboardMetrics(merged);
  assert.equal(metrics.totalSessions, 2);
  assert.equal(metrics.completed3BeatCount, 1);
  assert.equal(metrics.completionRatePct, 50);

  // Gemini tokens: 300 + 400 + 250 + 600 = 1550 | OpenRouter tokens: 500 + 750 = 1250 | Total = 2800
  assert.equal(metrics.geminiTokens, 1550);
  assert.equal(metrics.openrouterTokens, 1250);
  assert.equal(metrics.totalTokens, 2800);
  assert.equal(metrics.avgSessionDurationSec, 22);
  assert.equal(metrics.avgAgentResponseSec, 3);
  assert.equal(metrics.totalShocks, 8);
  assert.equal(metrics.totalAutoRecoveries, 1);

  const resMetric = metrics.agentMetrics.find((m) => m.id === 'researcher');
  assert.equal(resMetric?.totalTokens, 900);
  assert.equal(resMetric?.avgDurationSec, 2);
  assert.equal(resMetric?.successRatePct, 100);

  const econMode = metrics.modeDistribution.find((m) => m.id === 'econ_business');
  const planMode = metrics.modeDistribution.find((m) => m.id === 'project_plan');
  assert.equal(econMode?.count, 1);
  assert.equal(econMode?.pct, 50);
  assert.equal(planMode?.count, 1);

  assert.equal(metrics.modelDistribution[0].modelId, 'gemini-2.5-flash');
  assert.equal(metrics.modelDistribution[0].calls, 3);

  const csv = buildAnalyticsCsv(metrics.auditRows);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Vietnamese Excel compatibility');
  assert.match(csv, /"Kế hoạch mở tiệm cà phê ""Đặc Biệt"", vốn 200tr"/);
  assert.match(csv, /"2200"|"2800"|"1550"/);
});

test('3-stage silent auto-retry (502/empty + reasoning fallback), Mode-Adaptive Trợ lý CEO prompts, and GFM Markdown table renderer work cleanly', async () => {
  const {
    WORK_MODES,
    RETRY_CONFIG,
    getDefaultSystemPrompt,
    buildAgentPrompt,
    extractOpenRouterContent,
    normalizeMarkdownTables,
    renderFallbackMarkdownToHtml,
    renderMarkdownToHtml,
  } = loadPureFunctionsFromIndexHtml();

  assert.equal(RETRY_CONFIG.silentRetryDelayMs, 3000);
  assert.equal(RETRY_CONFIG.defaultMaxTokens, 4096);

  // 1) Reasoning fallback when message.content is empty
  assert.equal(
    extractOpenRouterContent({
      choices: [{ message: { content: '', reasoning: 'Nội dung tổng hợp từ reasoning' } }],
    }),
    'Nội dung tổng hợp từ reasoning'
  );
  assert.equal(
    extractOpenRouterContent({
      choices: [{ message: { content: '  Nội dung chính  ', reasoning: 'Reasoning phụ' } }],
    }),
    'Nội dung chính'
  );

  // 2) 3-Attempt Silent Auto-Retry:
  //    Attempt 1 (private key + selected model) -> HTTP 502
  //    Attempt 2 (global key + selected model)  -> Empty response (both content & reasoning empty)
  //    Attempt 3 (global key + google/gemma-3-27b-it:free) -> HTTP 200
  const traceCalls: Array<{ auth: string; model: string; maxTokens: number }> = [];
  const silentEvents: Array<{ attempt: number; rescueModel?: string }> = [];
  const mod3Stage = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers || {}) as Record<string, string>;
    const body = JSON.parse(String(init?.body || '{}'));
    const callIdx = traceCalls.length + 1;
    traceCalls.push({
      auth: headers.Authorization || '',
      model: body.model,
      maxTokens: body.max_tokens,
    });
    if (callIdx === 1) {
      return new Response(JSON.stringify({ error: { message: 'Bad Gateway' } }), { status: 502 });
    }
    if (callIdx === 2) {
      return new Response(
        JSON.stringify({ model: body.model, choices: [{ message: { content: '' }, finish_reason: 'length' }] }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        model: 'google/gemma-3-27b-it:free',
        choices: [{ message: { content: '### 1. Chốt giải pháp\nĐã cứu hộ thành công ở lần 3.' } }],
        usage: { total_tokens: 450 },
      }),
      { status: 200 }
    );
  }) as typeof fetch);

  const rescueResult = await mod3Stage.callOpenRouterWithKeyFallback({
    primaryKey: 'sk-or-private-key',
    fallbackKey: 'sk-or-global-key',
    modelId: 'meta-llama/llama-3.3-70b-instruct:free',
    promptText: 'Tổng hợp báo cáo',
    options: {
      retryDelayMs: 5,
      onSilentRetry: (attempt, _max, meta) =>
        silentEvents.push({ attempt, rescueModel: meta.rescueModel as string | undefined }),
    },
  });

  assert.equal(rescueResult.attemptUsed, 3);
  assert.equal(rescueResult.usedKeyFallback, true);
  assert.equal(rescueResult.usedModelFallback, true);
  assert.equal(rescueResult.rescueModel, 'google/gemma-3-27b-it:free');
  assert.equal(rescueResult.actualModel, 'google/gemma-3-27b-it:free');
  assert.deepEqual(traceCalls, [
    { auth: 'Bearer sk-or-private-key', model: 'meta-llama/llama-3.3-70b-instruct:free', maxTokens: 4096 },
    { auth: 'Bearer sk-or-global-key', model: 'meta-llama/llama-3.3-70b-instruct:free', maxTokens: 4096 },
    { auth: 'Bearer sk-or-global-key', model: 'google/gemma-3-27b-it:free', maxTokens: 4096 },
  ]);
  assert.deepEqual(silentEvents, [
    { attempt: 2, rescueModel: undefined },
    { attempt: 3, rescueModel: 'google/gemma-3-27b-it:free' },
  ]);

  // If primary model already IS google/gemma-3-27b-it:free, Attempt 3 switches to openrouter/free
  const gemmaRescueModels: string[] = [];
  const modGemmaSwap = loadPureFunctionsFromIndexHtml((async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    gemmaRescueModels.push(body.model);
    if (gemmaRescueModels.length < 3) {
      return new Response(JSON.stringify({ error: { message: 'Busy' } }), { status: 503 });
    }
    return new Response(
      JSON.stringify({ model: body.model, choices: [{ message: { content: 'OK' } }], usage: { total_tokens: 10 } }),
      { status: 200 }
    );
  }) as typeof fetch);

  await modGemmaSwap.callOpenRouterWithKeyFallback({
    primaryKey: 'sk-or-global-key',
    modelId: 'google/gemma-3-27b-it:free',
    promptText: 'Test rescue swap',
    options: { retryDelayMs: 5 },
  });
  assert.deepEqual(gemmaRescueModels, [
    'google/gemma-3-27b-it:free',
    'google/gemma-3-27b-it:free',
    'openrouter/free',
  ]);

  // 3) Mode-Adaptive 4-part Trợ lý CEO System Prompts & User Prompts
  for (const modeId of Object.keys(WORK_MODES)) {
    const sp = getDefaultSystemPrompt(modeId, 'assistant');
    assert.match(sp, /TRỰC DIỆN/);
    assert.match(sp, /KHÔNG dùng ký hiệu LaTeX phức tạp/);
    assert.doesNotMatch(sp, /Bảng chỉ số chính \(\$I_0\$/);
  }
  assert.match(getDefaultSystemPrompt('econ_business', 'assistant'), /Chốt mô hình\/sản phẩm cụ thể & Verdict/);
  assert.match(getDefaultSystemPrompt('econ_business', 'assistant'), /Bảng phân bổ vốn & chỉ số hòa vốn/);
  assert.match(getDefaultSystemPrompt('econ_business', 'assistant'), /Kế hoạch triển khai 7 ngày đầu/);
  assert.match(getDefaultSystemPrompt('econ_business', 'assistant'), /Rủi ro cần kiểm soát từ Critic/);

  assert.match(getDefaultSystemPrompt('project_plan', 'assistant'), /Chốt mục tiêu & Phương án tối ưu/);
  assert.match(getDefaultSystemPrompt('project_plan', 'assistant'), /Bảng phân bổ nguồn lực & Mốc thời gian/);
  assert.match(getDefaultSystemPrompt('study_research', 'assistant'), /Câu trả lời cốt lõi \/ Kết luận tổng hợp/);
  assert.match(getDefaultSystemPrompt('study_research', 'assistant'), /Lỗi sai thường gặp cần tránh/);
  assert.match(getDefaultSystemPrompt('general_custom', 'assistant'), /Chốt giải pháp tối ưu nhất/);

  const econPrompt = buildAgentPrompt('assistant', 'econ_business', 'Mở quán trà sữa 100tr', {});
  assert.match(econPrompt, /Chốt mô hình\/sản phẩm cụ thể & Verdict/);
  assert.match(econPrompt, /TRỰC DIỆN/);

  // 4) GFM Markdown Table normalization & HTML rendering (never leaks raw |---|---|)
  const messyMarkdown = [
    '### 2. Bảng phân bổ vốn',
    '   | Hạng mục | Ngân sách | Ghi chú |',
    '   | --- | ---: | :--- |',
    '   | **Thuê mặt bằng** | 20 triệu | Cọc 2 tháng |',
    '   | Nguyên liệu | 15 triệu | Đợt đầu |',
    '- [ ] Ký hợp đồng thuê',
  ].join('\n');

  const normalized = normalizeMarkdownTables(messyMarkdown);
  assert.match(normalized, /^### 2\. Bảng phân bổ vốn\n\n\| Hạng mục \|/m);

  const renderedFallback = renderFallbackMarkdownToHtml(messyMarkdown);
  assert.match(renderedFallback, /<div class="table-wrap"><table><thead><tr><th>Hạng mục<\/th>/);
  assert.match(renderedFallback, /<td><strong>Thuê mặt bằng<\/strong><\/td>/);
  assert.match(renderedFallback, /<input type="checkbox" disabled/);
  assert.doesNotMatch(renderedFallback, /\| --- \|/);

  // renderMarkdownToHtml also catches if a mock markedLib failed to parse a table and repairs it cleanly
  const renderedViaHtml = renderMarkdownToHtml(messyMarkdown, null);
  assert.match(renderedViaHtml, /<div class="table-wrap"><table>/);
  assert.doesNotMatch(renderedViaHtml, /\| --- \|/);
});








