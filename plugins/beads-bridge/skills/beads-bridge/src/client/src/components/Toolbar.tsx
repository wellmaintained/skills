import type { DashboardMetrics } from '../types';

interface ToolbarProps {
  metrics?: DashboardMetrics;
  lastUpdate?: string;
  onFitView: () => void;
  errorMessage?: string | null;
  onDismissError?: () => void;
}

export function Toolbar({ metrics, lastUpdate, onFitView, errorMessage, onDismissError }: ToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-6 py-3 text-sm text-slate-600 backdrop-blur supports/backdrop-blur:bg-white/80">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-slate-900">Beads Bridge</span>
        {metrics && (
          <div className="flex gap-3 text-xs text-slate-500">
            <span>In progress: {metrics.inProgress}</span>
            <span>Blocked: {metrics.blocked}</span>
            <span>Completed: {metrics.completed}</span>
          </div>
        )}
        {lastUpdate && (
          <span className="text-xs text-slate-400">
            Updated {new Date(lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {errorMessage && (
          <div className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
            {errorMessage}{' '}
            <button className="font-semibold underline" onClick={onDismissError}>
              Dismiss
            </button>
          </div>
        )}
        <button
          className="rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold text-white shadow hover:bg-slate-800"
          onClick={onFitView}
        >
          Fit View
        </button>
      </div>
    </div>
  );
}
