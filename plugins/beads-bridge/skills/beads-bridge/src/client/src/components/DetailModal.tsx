import clsx from 'clsx';
import { STATUS_OPTIONS, STATUS_STYLES } from '../status';
import type { DashboardIssue, IssueStatus } from '../types';

interface DetailModalProps {
  issue?: DashboardIssue | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (issueId: string, status: IssueStatus) => void;
  onReparent: (issueId: string, newParentId: string) => void;
  parentOptions: Array<{ id: string; title: string }>;
}

export function DetailModal({
  issue,
  isOpen,
  onClose,
  onStatusChange,
  onReparent,
  parentOptions,
}: DetailModalProps) {
  if (!isOpen || !issue) {
    return null;
  }

  const currentStatus = (issue.metadata?.beadsStatus ?? 'open') as IssueStatus;
  const currentParent = issue.metadata?.parentId ?? '';
  const statusStyle = STATUS_STYLES[currentStatus];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className={clsx(
          'w-full max-w-lg rounded-3xl border bg-white p-6 shadow-2xl',
          statusStyle?.border ?? 'border-slate-200'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="relative">
            <button
              className={clsx(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                statusStyle?.bg,
                statusStyle?.border,
                statusStyle?.text
              )}
            >
              {STATUS_OPTIONS.find((status) => status.value === currentStatus)?.label ?? currentStatus}
            </button>
          </div>
          <button
            className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500 hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs font-mono uppercase tracking-wide text-slate-400">{issue.id}</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{issue.title}</h2>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
              value={currentStatus}
              onChange={(event) => onStatusChange(issue.id, event.target.value as IssueStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Parent</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
              value={currentParent ?? ''}
              onChange={(event) => onReparent(issue.id, event.target.value)}
            >
              <option value="" disabled>
                Select new parent
              </option>
              {parentOptions
                .filter((option) => option.id !== issue.id)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Details</label>
            <div className="mt-1 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
              {issue.body || 'No description provided.'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-400">Type</p>
              <p className="text-slate-900">{issue.metadata?.beadsType ?? 'task'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-400">Priority</p>
              <p className="text-slate-900">P{issue.metadata?.beadsPriority ?? '—'}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
