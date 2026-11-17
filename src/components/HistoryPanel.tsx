import { getModeMeta } from '../core/workModes';
import { formatTokenCount } from '../services/openrouter';
import { AGENTS } from '../core/workModes';
import type { SessionHistoryEntry } from '../core/analytics';

interface HistoryPanelProps {
  open: boolean;
  entries: SessionHistoryEntry[];
  currentSessionId: string;
  onSelectSession: (entry: SessionHistoryEntry) => void;
  onClearHistory: () => void;
  onClose: () => void;
}

export function HistoryPanel({
  open,
  entries,
  currentSessionId,
  onSelectSession,
  onClearHistory,
  onClose,
}: HistoryPanelProps) {
  return (
    <div
      id="history-panel"
      className={`${open ? 'flex' : 'hidden'} flex-col flex-1 overflow-y-auto min-h-0 custom-scroll p-3.5 space-y-2.5 bg-slate-950/60`}
      aria-label="Lịch sử 10 phiên làm việc gần nhất"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div>
          <h3 className="text-xs font-semibold text-amber-200">Lịch sử 10 phiên gần nhất</h3>
          <p className="text-[11px] text-slate-400">Chọn một phiên để mở lại toàn bộ báo cáo</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="clear-history-btn"
            type="button"
            onClick={onClearHistory}
            className="text-[11px] font-medium text-slate-400 hover:text-red-300 transition-colors px-1.5 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Xóa tất cả
          </button>
          <button
            id="close-history-btn"
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-white/10 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Quay lại
          </button>
        </div>
      </div>

      <div id="history-list" className="space-y-2">
        {entries.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-400">
            Chưa có phiên làm việc nào được lưu. Sau khi chạy xong, 10 phiên gần nhất sẽ tự động hiển thị tại đây.
          </div>
        ) : (
          entries.map((entry) => {
            const modeLabel = getModeMeta(entry.mode).label;
            const totalTokens = AGENTS.reduce((acc, a) => acc + (Number(entry.tokenCounts?.[a.id]) || 0), 0);
            let timeStr = '';
            if (entry.timestamp) {
              try {
                timeStr = new Date(entry.timestamp).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              } catch {
                timeStr = '';
              }
            }
            const isCurrent = entry.id === currentSessionId;
            return (
              <button
                key={entry.id}
                type="button"
                data-history-item={entry.id}
                onClick={() => onSelectSession(entry)}
                className={`w-full text-left rounded-xl p-3 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isCurrent
                    ? 'bg-amber-950/30 border-amber-400/50'
                    : 'bg-slate-900/75 border-white/10 hover:border-amber-400/40 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-400">
                  <span className="font-medium text-amber-300/90 truncate">{modeLabel}</span>
                  <span className="font-mono tabular-nums shrink-0">
                    {timeStr}
                    {totalTokens > 0 ? ` · ${formatTokenCount(totalTokens)}` : ''}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-100 mt-1 line-clamp-2">{entry.topic}</p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
