import { useEffect, useRef } from 'react';
import type { AgentStatus } from '../core/workModes';
import type { AnalyticsDashboardMetrics } from '../core/analytics';
import { formatTokenCount } from '../services/openrouter';
import type { AnalyticsAgentMetricKey } from '../types/office';

interface AnalyticsDashboardProps {
  visible: boolean;
  metrics: AnalyticsDashboardMetrics;
  activeMetric: AnalyticsAgentMetricKey;
  onSelectMetric: (metric: AnalyticsAgentMetricKey) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onBackToOffice: () => void;
  onBackAndFocusPrompt: () => void;
  onExportCsv: () => void;
  onOpenReport: (runId: string) => void;
  onPlayClick: () => void;
}

const BEAT_CHIP_STYLES: Record<AgentStatus, string> = {
  done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  error: 'bg-red-500/20 text-red-300 border-red-500/45',
  active: 'bg-blue-500/20 text-blue-300 border-blue-500/45',
  idle: 'bg-slate-800/80 text-slate-500 border-white/10',
};

export function AnalyticsDashboard({
  visible,
  metrics,
  activeMetric,
  onSelectMetric,
  searchQuery,
  onSearchChange,
  onBackToOffice,
  onBackAndFocusPrompt,
  onExportCsv,
  onOpenReport,
  onPlayClick,
}: AnalyticsDashboardProps) {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (visible && sectionRef.current) {
      sectionRef.current.scrollTop = 0;
    }
  }, [visible]);

  const gemPct = metrics.totalTokens > 0 ? Math.round((metrics.geminiTokens / metrics.totalTokens) * 100) : 0;
  const orPct = metrics.totalTokens > 0 ? Math.max(0, 100 - gemPct) : 0;

  const maxTokens = Math.max(1, ...metrics.agentMetrics.map((m) => m.totalTokens));
  const maxDur = Math.max(0.1, ...metrics.agentMetrics.map((m) => m.avgDurationSec));

  const donutRadius = 42;
  const donutCirc = 2 * Math.PI * donutRadius;
  let offsetAcc = 0;
  const donutSegments =
    metrics.totalSessions > 0
      ? metrics.modeDistribution
          .filter((m) => m.count > 0)
          .map((m) => {
            const segLen = (m.count / metrics.totalSessions) * donutCirc;
            const seg = {
              id: m.id,
              colorHex: m.colorHex,
              dashArray: `${segLen.toFixed(2)} ${(donutCirc - segLen).toFixed(2)}`,
              dashOffset: (-offsetAcc).toFixed(2),
            };
            offsetAcc += segLen;
            return seg;
          })
      : [];

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = trimmedQuery
    ? metrics.auditRows.filter(
        (r) =>
          r.topic.toLowerCase().includes(trimmedQuery) ||
          r.modeLabel.toLowerCase().includes(trimmedQuery) ||
          r.id.toLowerCase().includes(trimmedQuery)
      )
    : metrics.auditRows;

  return (
    <section
      ref={sectionRef}
      id="analytics-dashboard-view"
      aria-label="Thống kê và Hiệu suất Điều hành"
      className={`${
        visible ? '' : 'hidden'
      } fixed inset-0 z-50 overflow-y-auto custom-scroll bg-[#070a12]/95 backdrop-blur-2xl pb-10`}
    >
      <div className="sticky top-0 z-30 h-[4.25rem] bg-[#070a12]/92 backdrop-blur-xl border-b border-white/10 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-50" style={{ textWrap: 'balance' }}>
              Thống kê &amp; Hiệu suất Điều hành
            </h2>
            <p id="analytics-meta-summary" className="text-xs sm:text-sm text-slate-400 mt-1 tabular-nums">
              Dữ liệu thực tế từ Lịch sử phiên và Chuẩn đoán API · {metrics.totalSessions} phiên đã ghi nhận
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              id="export-analytics-csv-btn"
              type="button"
              disabled={metrics.auditRows.length === 0}
              onClick={() => {
                onPlayClick();
                onExportCsv();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-cyan-400/35 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
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
              <span>Xuất báo cáo thống kê (.csv)</span>
            </button>
            <button
              id="analytics-back-btn"
              type="button"
              onClick={() => {
                onPlayClick();
                onBackToOffice();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 hover:from-amber-300 hover:to-yellow-300 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Quay lại Văn phòng 3D</span>
            </button>
          </div>
        </div>

        {/* Empty State Notice */}
        <div
          id="analytics-empty-banner"
          className={`${
            metrics.totalSessions > 0 ? 'hidden' : 'flex'
          } rounded-xl border border-amber-400/25 bg-slate-900/75 p-5 flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-amber-200">Chưa có dữ liệu phiên điều hành</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Hãy quay lại Văn phòng 3D và chạy ít nhất một yêu cầu với luồng 3 nhịp (1 → 2 → 2). Toàn bộ số liệu Token, thời gian phản hồi từng bàn, số lượt Siêu nhân Điện quang chích điện và nhật ký API sẽ tự động cập nhật tại đây.
            </p>
          </div>
          <button
            id="analytics-empty-back-btn"
            type="button"
            onClick={() => {
              onPlayClick();
              onBackAndFocusPrompt();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Chạy phiên đầu tiên
          </button>
        </div>

        {/* Row 1: 4 KPI Overview Cards */}
        <div id="analytics-kpi-grid" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <article className="rounded-xl border border-white/10 bg-slate-900/75 p-4 flex flex-col justify-between gap-2">
            <div className="text-xs font-medium text-slate-400">Tổng số phiên điều hành</div>
            <div id="kpi-total-sessions" className="text-2xl font-bold font-mono tabular-nums text-slate-50">
              {metrics.totalSessions}
            </div>
            <div id="kpi-completion-sub" className="text-xs text-emerald-400/90 tabular-nums">
              Hoàn thành 3 nhịp: {metrics.completed3BeatCount}/{metrics.totalSessions} ({metrics.completionRatePct}%)
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-900/75 p-4 flex flex-col justify-between gap-2">
            <div className="text-xs font-medium text-slate-400">Tổng lượng Token tiêu thụ</div>
            <div id="kpi-total-tokens" className="text-2xl font-bold font-mono tabular-nums text-amber-300">
              {formatTokenCount(metrics.totalTokens)}
            </div>
            <div className="space-y-1.5">
              <div id="kpi-provider-tokens-sub" className="text-xs text-slate-300 tabular-nums">
                {metrics.geminiTokens > 0
                  ? `Cũ (Gemini): ${metrics.geminiTokens.toLocaleString('vi-VN')} · OpenRouter: ${metrics.openrouterTokens.toLocaleString('vi-VN')}`
                  : `OpenRouter: ${metrics.openrouterTokens.toLocaleString('vi-VN')} tokens`}
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                <div id="kpi-gemini-bar" className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${gemPct}%` }} />
                <div id="kpi-openrouter-bar" className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${orPct}%` }} />
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-900/75 p-4 flex flex-col justify-between gap-2">
            <div className="text-xs font-medium text-slate-400">Thời gian xử lý trung bình</div>
            <div id="kpi-avg-duration" className="text-2xl font-bold font-mono tabular-nums text-cyan-300">
              {metrics.avgSessionDurationSec.toFixed(1)}s / phiên
            </div>
            <div id="kpi-avg-agent-sub" className="text-xs text-slate-300 tabular-nums">
              Phản hồi TB mỗi bàn: {metrics.avgAgentResponseSec.toFixed(1)}s
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-900/75 p-4 flex flex-col justify-between gap-2">
            <div className="text-xs font-medium text-slate-400">Siêu nhân Điện quang &amp; Phục hồi API</div>
            <div id="kpi-shock-count" className="text-2xl font-bold font-mono tabular-nums text-slate-50">
              {metrics.totalShocks.toLocaleString('vi-VN')} lượt chích điện
            </div>
            <div id="kpi-recovery-sub" className="text-xs text-slate-300 tabular-nums">
              Tự động phục hồi: {metrics.totalAutoRecoveries} lần · {metrics.totalErrors} lỗi
            </div>
          </article>
        </div>

        {/* Row 2: Visual SVG/CSS Charts */}
        <div id="analytics-charts-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* 5-Agent Bar Comparison Chart */}
          <section className="lg:col-span-7 rounded-xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Hiệu suất 5 chuyên gia theo bàn</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  So sánh tổng Token, thời gian phản hồi trung bình và tỷ lệ thành công
                </p>
              </div>
              <div
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-950/80 border border-white/10 shrink-0"
                role="group"
                aria-label="Chọn chỉ số biểu đồ 5 nhân viên"
              >
                {(
                  [
                    { key: 'tokens', label: 'Token' },
                    { key: 'duration', label: 'Thời gian (s)' },
                    { key: 'success', label: 'Tỷ lệ OK (%)' },
                  ] as const
                ).map((item) => {
                  const isActive = activeMetric === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-agent-chart-metric={item.key}
                      aria-pressed={isActive}
                      onClick={() => {
                        onPlayClick();
                        onSelectMetric(item.key);
                      }}
                      className={
                        isActive
                          ? 'analytics-metric-btn px-2.5 py-1 text-[11px] font-semibold rounded-md bg-amber-400 text-slate-950 whitespace-nowrap transition-colors'
                          : 'analytics-metric-btn px-2.5 py-1 text-[11px] font-medium rounded-md text-slate-300 hover:text-white whitespace-nowrap transition-colors'
                      }
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div id="analytics-agent-chart" className="space-y-3">
              {metrics.agentMetrics.map((am) => {
                let pctWidth = 0;
                let primaryLabel = '';
                if (activeMetric === 'duration') {
                  pctWidth = am.avgDurationSec > 0 ? Math.max(6, Math.round((am.avgDurationSec / maxDur) * 100)) : 0;
                  primaryLabel = `${am.avgDurationSec.toFixed(1)}s`;
                } else if (activeMetric === 'success') {
                  pctWidth = am.attemptCount > 0 ? Math.max(4, am.successRatePct) : 0;
                  primaryLabel = `${am.successRatePct}% (${am.successCount}/${am.attemptCount})`;
                } else {
                  pctWidth = am.totalTokens > 0 ? Math.max(4, Math.round((am.totalTokens / maxTokens) * 100)) : 0;
                  primaryLabel = formatTokenCount(am.totalTokens);
                }

                return (
                  <div key={am.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: am.colorHex }} />
                        <span className="font-medium text-slate-100 truncate">
                          Bàn {am.step} · {am.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums shrink-0">
                        <span className="text-slate-300">{primaryLabel}</span>
                        <span className="text-slate-500 hidden sm:inline">
                          TB {am.avgDurationSec.toFixed(1)}s · OK {am.successRatePct}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-950/90 border border-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pctWidth}%`, backgroundColor: am.colorHex }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Mode Distribution & AI Model Breakdown */}
          <section className="lg:col-span-5 rounded-xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Phân bổ Chế độ làm việc</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tỷ trọng theo 4 chế độ điều hành</p>
              </div>
              <div id="analytics-mode-chart" className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 112 112" className="w-28 h-28 -rotate-90" aria-hidden="true">
                    <circle cx="56" cy="56" r={donutRadius} fill="none" stroke="rgba(15,23,42,0.9)" strokeWidth="12" />
                    {donutSegments.length > 0 ? (
                      donutSegments.map((seg) => (
                        <circle
                          key={seg.id}
                          cx="56"
                          cy="56"
                          r={donutRadius}
                          fill="none"
                          stroke={seg.colorHex}
                          strokeWidth="12"
                          strokeDasharray={seg.dashArray}
                          strokeDashoffset={seg.dashOffset}
                        />
                      ))
                    ) : (
                      <circle
                        cx="56"
                        cy="56"
                        r={donutRadius}
                        fill="none"
                        stroke="rgba(148,163,184,0.18)"
                        strokeWidth="12"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-base font-bold font-mono tabular-nums text-slate-100">
                      {metrics.totalSessions}
                    </span>
                    <span className="text-[10px] text-slate-400">phiên</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2 min-w-0">
                  {metrics.modeDistribution.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: m.colorHex }} />
                        <span className="text-slate-200 truncate">{m.label}</span>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                        {m.count} ({m.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-100">Tỷ lệ sử dụng Model AI</h3>
                <span id="analytics-model-count-meta" className="text-xs text-slate-400 tabular-nums">
                  {metrics.totalModelCalls} lượt gọi
                </span>
              </div>
              <div id="analytics-model-chart" className="space-y-2.5">
                {metrics.modelDistribution.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa ghi nhận lượt gọi model AI nào.</p>
                ) : (
                  metrics.modelDistribution.slice(0, 6).map((item) => {
                    const isGem = item.provider === 'gemini';
                    const barColor = isGem ? '#22d3ee' : '#f59e0b';
                    const tag = isGem ? 'Gemini (Cũ)' : 'OpenRouter';
                    return (
                      <div key={item.modelId} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono text-slate-200 truncate" title={item.modelId}>
                            {item.modelId}
                          </span>
                          <span className="font-mono tabular-nums text-slate-400 shrink-0">
                            {item.calls} lượt ({item.pct}%) · {tag}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-950/90 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(5, item.pct)}%`, backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Row 3: Execution Audit Log Table */}
        <section className="rounded-xl border border-white/10 bg-slate-900/75 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Nhật ký Hiệu suất &amp; Chẩn đoán API</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Theo dõi từng phiên chạy, trạng thái 3 nhịp (1 → 2 → 2) và mở lại báo cáo nhanh
              </p>
            </div>
            <div className="w-full sm:w-64">
              <input
                id="analytics-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Tìm kiếm nhật ký hiệu suất"
                placeholder="Lọc theo đề bài hoặc chế độ..."
                className="w-full bg-slate-950/80 border border-white/10 focus:border-cyan-400/70 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/55 text-slate-400 font-medium">
                  <th className="py-2.5 px-4 whitespace-nowrap">Thời gian</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Đề bài tóm tắt</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Chế độ</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Tổng Token</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Thời gian chạy</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Trạng thái nhịp (1-2-2)</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Báo cáo</th>
                </tr>
              </thead>
              <tbody id="analytics-audit-tbody" className="divide-y divide-white/5">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-400">
                      {metrics.auditRows.length === 0
                        ? 'Chưa có phiên nào được ghi nhận.'
                        : 'Không tìm thấy phiên phù hợp với từ khóa lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    let timeLabel = row.timestamp;
                    try {
                      timeLabel = new Date(row.timestamp).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } catch {
                      // Keep fallback
                    }
                    const durationLabel = row.durationSec > 0 ? `${row.durationSec.toFixed(1)}s` : '—';
                    const chips: Array<{ label: string; state: AgentStatus }> = [
                      { label: '1', state: row.beatStates.b1 },
                      { label: '2a', state: row.beatStates.b2q },
                      { label: '2b', state: row.beatStates.b2s },
                      { label: '3a', state: row.beatStates.b3c },
                      { label: '3b', state: row.beatStates.b3a },
                    ];

                    return (
                      <tr key={row.id} className="hover:bg-slate-800/35 transition-colors">
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {timeLabel}
                        </td>
                        <td className="py-3 px-4 text-slate-100 max-w-xs">
                          <p className="line-clamp-2 leading-snug font-medium">{row.topic}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{row.modeLabel}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="text-amber-300 font-medium">{row.totalTokens.toLocaleString('vi-VN')}</div>
                          <div className="text-[10px] text-slate-500">
                            G: {row.geminiTokens.toLocaleString('vi-VN')} · OR:{' '}
                            {row.openrouterTokens.toLocaleString('vi-VN')}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-cyan-300 whitespace-nowrap">
                          {durationLabel}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {chips.map((c) => (
                              <span
                                key={c.label}
                                className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${BEAT_CHIP_STYLES[c.state]}`}
                              >
                                {c.label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            data-open-report-id={row.id}
                            disabled={!row.hasReportSnapshot}
                            onClick={() => {
                              onPlayClick();
                              onOpenReport(row.id);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-amber-400/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            Xem báo cáo
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
