import type { WorkspaceView } from '../types/office';

interface ViewSwitcherProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
}

const ACTIVE_TAB_CLS =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300';
const IDLE_TAB_CLS =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 text-slate-300 hover:text-white hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400';

export function ViewSwitcher({ activeView, onSelectView }: ViewSwitcherProps) {
  const isAnalytics = activeView === 'analytics';

  return (
    <nav
      id="workspace-view-switcher"
      aria-label="Chuyển đổi chế độ xem toàn màn hình"
      className={
        isAnalytics
          ? 'fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto glass-panel hud-gold-panel rounded-xl p-1 inline-flex items-center gap-1 shadow-2xl cinema-hide-tech'
          : 'fixed bottom-[10.25rem] sm:bottom-[6.5rem] xl:bottom-auto xl:top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto glass-panel hud-gold-panel rounded-xl p-1 inline-flex items-center gap-1 shadow-2xl cinema-hide-tech'
      }
    >
      <button
        id="view-tab-office"
        type="button"
        aria-pressed={!isAnalytics}
        onClick={() => onSelectView('office')}
        className={isAnalytics ? IDLE_TAB_CLS : ACTIVE_TAB_CLS}
      >
        <span aria-hidden="true">🏢</span>
        <span>Văn phòng 3D</span>
      </button>
      <button
        id="view-tab-analytics"
        type="button"
        aria-pressed={isAnalytics}
        onClick={() => onSelectView('analytics')}
        className={isAnalytics ? ACTIVE_TAB_CLS : IDLE_TAB_CLS}
      >
        <span aria-hidden="true">📊</span>
        <span>Thống kê Chi tiết</span>
      </button>
    </nav>
  );
}
