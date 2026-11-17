import { useEffect, useRef, useState, type RefObject } from 'react';
import { WORK_MODES, type WorkModeId } from '../core/workModes';
import type { CameraView } from '../types/office';

interface ControlPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  cinemaMode: boolean;
  onToggleCinemaMode: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  cameraView: CameraView;
  onSelectCameraView: (view: CameraView) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  apiKeyInputRef: RefObject<HTMLInputElement | null>;
  mode: WorkModeId;
  onSelectMode: (mode: WorkModeId) => void;
  companyMemory: string;
  onCompanyMemoryChange: (value: string) => void;
  onClearCompanyMemory: () => void;
  onPlayClick: () => void;
}

const MODE_BUTTON_META: Array<{ id: string; mode: WorkModeId }> = [
  { id: 'mode-project-plan', mode: 'project_plan' },
  { id: 'mode-study-research', mode: 'study_research' },
  { id: 'mode-econ-business', mode: 'econ_business' },
  { id: 'mode-general-custom', mode: 'general_custom' },
];

export function ControlPanel({
  collapsed,
  onToggleCollapse,
  cinemaMode,
  onToggleCinemaMode,
  soundEnabled,
  onToggleSound,
  cameraView,
  onSelectCameraView,
  apiKey,
  onApiKeyChange,
  apiKeyInputRef,
  mode,
  onSelectMode,
  companyMemory,
  onCompanyMemoryChange,
  onClearCompanyMemory,
  onPlayClick,
}: ControlPanelProps) {
  const [showKey, setShowKey] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(360);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (drawerRef.current?.offsetWidth) {
        setDrawerWidth(drawerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [collapsed]);

  const trimmedKey = apiKey.trim();
  const apiKeyStatusText =
    trimmedKey.length > 10 ? 'Đã lưu cục bộ' : trimmedKey.length > 0 ? 'Key quá ngắn' : 'Chưa nhập Key';
  const apiKeyStatusCls =
    trimmedKey.length > 10
      ? 'text-[11px] font-medium text-emerald-400'
      : trimmedKey.length > 0
        ? 'text-[11px] font-medium text-amber-400'
        : 'text-[11px] font-medium text-slate-400';

  const memoryLines = String(companyMemory || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const isDirectorCam = cameraView === 'director';

  return (
    <header
      id="control-panel"
      aria-label="Bảng điều khiển Executive AI Studio"
      style={{ transform: collapsed ? `translateX(-${drawerWidth + 12}px)` : 'translateX(0)' }}
      className="fixed top-4 left-4 z-20 flex items-start pointer-events-none transition-transform duration-300 ease-out"
    >
      <div
        ref={drawerRef}
        id="control-drawer"
        className={`${
          collapsed ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'
        } glass-panel hud-gold-panel rounded-2xl p-3.5 sm:p-4 space-y-3 w-[min(360px,calc(100vw-8.25rem))] sm:w-[360px] max-h-[calc(100vh-7.5rem)] overflow-y-auto custom-scroll transition-opacity duration-200`}
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
              Executive AI Studio
            </div>
            <h1 className="text-base font-bold tracking-tight text-slate-50 leading-snug">
              Văn phòng AI 3D
            </h1>
            <p className="text-[11.5px] font-medium text-amber-200/90 mt-0.5">CEO Phúc</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="cinema-mode-btn"
              type="button"
              aria-pressed={cinemaMode}
              onClick={() => {
                onPlayClick();
                onToggleCinemaMode();
              }}
              title="Bật/tắt Chế độ Quay Video (ẩn API Key, xoay camera điện ảnh & hiện Live Neural Ticker)"
              aria-label="Chế độ Quay"
              className={
                cinemaMode
                  ? 'inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border border-cyan-400/75 bg-cyan-400 text-slate-950 shadow-sm shadow-cyan-500/25 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
                  : 'inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-white/15 bg-slate-950/75 text-slate-200 hover:text-cyan-200 hover:border-cyan-400/45 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'
              }
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
                <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
                <rect x="2" y="6" width="14" height="12" rx="2" />
              </svg>
              <span>Chế độ Quay</span>
            </button>
            <button
              id="sound-toggle-btn"
              type="button"
              aria-pressed={soundEnabled}
              onClick={onToggleSound}
              title="Bật hoặc tắt hiệu ứng âm thanh công nghệ"
              aria-label="Bật hoặc tắt âm thanh"
              className={
                soundEnabled
                  ? 'inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-cyan-400/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'
                  : 'inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-white/15 bg-slate-950/75 text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'
              }
            >
              <svg
                id="sound-on-icon"
                className={`w-3.5 h-3.5 shrink-0 ${soundEnabled ? '' : 'hidden'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <svg
                id="sound-off-icon"
                className={`w-3.5 h-3.5 shrink-0 ${soundEnabled ? 'hidden' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
              <span id="sound-toggle-label">{soundEnabled ? 'Âm thanh' : 'Tắt âm'}</span>
            </button>
          </div>
        </div>

        {/* Top Toolbar: Camera Views */}
        <div
          className="flex flex-wrap items-center justify-between gap-1.5 p-1 bg-slate-950/75 border border-white/10 rounded-xl"
          role="group"
          aria-label="Thanh công cụ góc nhìn 3D"
        >
          <span className="text-[10.5px] font-medium text-slate-400 pl-2 whitespace-nowrap">
            Góc nhìn 3D
          </span>
          <div className="inline-flex flex-wrap items-center gap-1 min-w-0 max-w-full">
            <button
              id="reset-camera-btn"
              type="button"
              aria-pressed={!isDirectorCam}
              onClick={() => {
                onPlayClick();
                onSelectCameraView('overview');
              }}
              title="Góc nhìn toàn cảnh văn phòng"
              aria-label="Góc nhìn toàn cảnh"
              className={
                isDirectorCam
                  ? 'cam-view-btn px-2 sm:px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 border border-transparent text-slate-300 hover:text-white hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400'
                  : 'cam-view-btn px-2 sm:px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 bg-amber-400/20 border border-amber-400/45 text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400'
              }
            >
              Toàn cảnh
            </button>
            <button
              id="director-camera-btn"
              type="button"
              aria-pressed={isDirectorCam}
              onClick={() => {
                onPlayClick();
                onSelectCameraView('director');
              }}
              title="Phóng tới Phòng CEO Phúc"
              aria-label="Xem Phòng CEO Phúc"
              className={
                isDirectorCam
                  ? 'cam-view-btn px-2 sm:px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 bg-amber-400 text-slate-950 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400'
                  : 'cam-view-btn px-2 sm:px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 border border-transparent text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400'
              }
            >
              Phòng CEO Phúc
            </button>
          </div>
        </div>

        {/* OpenRouter Global API Key */}
        <div id="api-key-section" className="space-y-1.5 cinema-hide-tech">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="api-key-input" className="text-xs font-medium text-slate-300">
              OpenRouter API Key
            </label>
            <span id="api-key-status" className={apiKeyStatusCls}>
              {apiKeyStatusText}
            </span>
          </div>
          <div className="relative flex items-center">
            <input
              ref={apiKeyInputRef}
              id="api-key-input"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full bg-slate-950/80 border border-white/10 focus:border-amber-400/70 rounded-lg pl-3 pr-9 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors"
            />
            <button
              id="toggle-key-visibility"
              type="button"
              onClick={() => {
                onPlayClick();
                setShowKey((prev) => !prev);
              }}
              aria-label="Hiện hoặc ẩn OpenRouter API Key"
              className="absolute right-2 p-1 text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <svg
                id="eye-icon"
                className="w-4 h-4"
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

        {/* Preset Work Modes */}
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-slate-300">Chế độ làm việc</span>
          <div
            className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/75 border border-white/10 rounded-xl"
            role="group"
            aria-label="Chọn chế độ làm việc"
          >
            {MODE_BUTTON_META.map((item) => {
              const active = mode === item.mode;
              return (
                <button
                  key={item.mode}
                  id={item.id}
                  type="button"
                  data-mode={item.mode}
                  aria-pressed={active}
                  onClick={() => {
                    onPlayClick();
                    onSelectMode(item.mode);
                  }}
                  className={
                    active
                      ? 'mode-btn px-2 py-2 rounded-lg text-[11.5px] font-semibold transition-colors text-center leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 shadow-sm'
                      : 'mode-btn px-2 py-2 rounded-lg text-[11.5px] font-medium transition-colors text-center leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 text-slate-300 hover:text-amber-100 hover:bg-slate-800/70'
                  }
                >
                  {WORK_MODES[item.mode].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Company Persistent Memory Notebook */}
        <details
          id="company-memory-details"
          data-agent-rules="memory"
          className="pt-2 border-t border-white/10 cinema-hide-tech"
        >
          <summary className="cursor-pointer select-none flex items-center justify-between gap-2 py-0.5 text-xs font-medium text-slate-300 hover:text-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <svg
                className="rules-chevron w-3.5 h-3.5 text-amber-400/80 shrink-0 transition-transform duration-150"
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
              <span className="truncate">Sổ tay Ký ức (Tự động ghi nhớ)</span>
            </span>
            <span
              id="company-memory-status"
              className={`text-[11px] font-mono tabular-nums shrink-0 ${
                memoryLines.length > 0 ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              {memoryLines.length > 0 ? `${memoryLines.length} mục` : 'Trống'}
            </span>
          </summary>
          <div className="mt-2 space-y-1.5">
            <textarea
              id="company-memory-input"
              rows={4}
              value={companyMemory}
              onChange={(e) => onCompanyMemoryChange(e.target.value)}
              aria-label="Sổ tay Ký ức Công ty"
              placeholder="Ghi chú dài hạn (tối đa 5 gạch đầu dòng về thói quen, ngân sách, quỹ giờ). Trợ lý sẽ tự động cập nhật sau mỗi phiên..."
              className="w-full resize-y bg-slate-950/85 border border-white/10 focus:border-amber-400/70 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-slate-400 truncate">
                Tự động đính kèm khi bấm Bắt đầu
              </span>
              <button
                id="clear-memory-btn"
                type="button"
                onClick={onClearCompanyMemory}
                className="text-[11px] font-medium text-slate-400 hover:text-red-300 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded px-1.5 py-0.5"
              >
                Xóa ký ức
              </button>
            </div>
          </div>
        </details>
      </div>

      <button
        id="toggle-control-btn"
        type="button"
        aria-expanded={!collapsed}
        aria-controls="control-drawer"
        aria-label={collapsed ? 'Mở bảng Executive AI Studio' : 'Thu gọn bảng Executive AI Studio'}
        onClick={() => {
          onPlayClick();
          onToggleCollapse();
        }}
        className={`pointer-events-auto ml-2 sm:ml-3 ${
          collapsed ? 'mt-0 sm:mt-2' : 'mt-12 sm:mt-2'
        } glass-panel rounded-xl px-2.5 py-2 text-xs font-medium text-slate-200 hover:text-amber-200 hover:border-amber-400/40 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
      >
        <svg
          id="control-chevron"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          className="w-4 h-4 transition-transform duration-200"
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
        <span id="control-toggle-text">{collapsed ? 'Điều khiển' : 'Thu gọn'}</span>
      </button>
    </header>
  );
}
