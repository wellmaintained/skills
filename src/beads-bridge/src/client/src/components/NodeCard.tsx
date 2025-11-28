import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import clsx from 'clsx';
import type { IssueNodeData } from '../hooks/useTreeLayout';
import type { IssueStatus } from '../types';
import { STATUS_OPTIONS, STATUS_STYLES } from '../status';
import { ClientLogger } from '../utils/logger';

export interface NodeActions {
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onStatusChange: (id: string, status: IssueStatus) => void;
}

export type IssueNodeComponentData = IssueNodeData & NodeActions;

const NodeCard = memo(({ data }: NodeProps<IssueNodeComponentData>) => {
  const { issue, isCollapsed, childCount, onToggleCollapse, onSelect, onCreateChild, onStatusChange } = data;
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const logger = new ClientLogger('NodeCard');

  const status = (issue.metadata?.beadsStatus ?? 'open') as IssueStatus;
  const statusStyle = STATUS_STYLES[status];

  const handleCopyId = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(issue.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      logger.debug('Failed to copy ID', { error: err });
    }
  };

  return (
    <div className="relative w-64 cursor-default overflow-visible">
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-slate-400" />

      {/* Top Drag Handle - Protruding */}
      <div
        data-handleid="drag-handle"
        className="drag-handle absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-slate-500 shadow-md transition hover:border-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-grab active:cursor-grabbing select-none"
        title="Drag to reparent"
        draggable={false}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <circle cx="4" cy="2" r="1.5" />
          <circle cx="4" cy="6" r="1.5" />
          <circle cx="4" cy="10" r="1.5" />
          <circle cx="12" cy="2" r="1.5" />
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="10" r="1.5" />
        </svg>
      </div>

      {/* Inner Card Wrapper with Rounded Corners */}
      <div
        className={clsx(
          'rounded-md border bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur',
          statusStyle.border
        )}
      >
        {/* Header - ID with Copy (left) and Status (right) */}
        <div className="flex items-center justify-between gap-2 px-3 py-3 pt-4">
          {/* Left: Issue ID + Copy Button */}
          <button
            className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 hover:bg-slate-200 transition cursor-pointer"
            onClick={handleCopyId}
            title={copied ? 'Copied!' : 'Click to copy ID'}
            aria-label="Copy issue ID"
          >
            <span className="text-xs font-medium text-slate-600">{issue.id}</span>
            <div
              className={clsx(
                "flex items-center justify-center rounded-sm p-0.5 transition",
                copied
                  ? "text-green-600 bg-green-50"
                  : "text-slate-400"
              )}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7l3 3 5-6" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="7" height="7" rx="1" />
                  <path d="M3 10V3.5C3 3.22386 3.22386 3 3.5 3H10" />
                </svg>
              )}
            </div>
          </button>

          {/* Right: Status Dropdown */}
          <div className="relative">
            <button
              className={clsx(
                'rounded-md border px-3 py-1 text-xs font-medium transition',
                statusStyle.bg,
                statusStyle.border,
                statusStyle.text
              )}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
            >
              {STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status}
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-36 rounded-md border border-slate-200 bg-white shadow-lg">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={clsx(
                      'block w-full px-3 py-2 text-left text-xs hover:bg-slate-50',
                      option.value === status ? 'text-slate-900 font-semibold' : 'text-slate-600'
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen(false);
                      if (option.value !== status) {
                        onStatusChange(issue.id, option.value);
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content - Title Only */}
        <div
          className="cursor-pointer px-4 pb-8 pt-1"
          onClick={() => onSelect(issue.id)}
        >
          <p className="text-base font-bold text-slate-900">
            {status === 'blocked' && <span className="mr-1.5">🚫</span>}
            {issue.title}
          </p>
        </div>

        {/* Bottom Footer Pill - Protruding */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
          <div className={clsx(
            "flex items-center rounded-md bg-slate-50 border border-slate-200 px-1.5 py-0.5 shadow-md",
            childCount > 0 ? "gap-1.5" : ""
          )}>
          {childCount > 0 && (
            <>
              <button
                className="flex items-center gap-1 text-[10px] font-medium text-slate-600 hover:text-slate-900 transition whitespace-nowrap"
                onClick={() => onToggleCollapse(issue.id)}
              >
                <span>{isCollapsed ? '▶' : '▼'}</span>
                <span className="whitespace-nowrap">subtasks ({childCount})</span>
              </button>
              <span className="text-slate-300 text-[10px]">|</span>
            </>
          )}
            <button
              className="flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition w-4 h-4 text-[10px]"
              aria-label="Create subtask"
              onClick={(event) => {
                event.stopPropagation();
                logger.debug('onCreateChild called', { issueId: issue.id, issueTitle: issue.title });
                onCreateChild(issue.id);
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

NodeCard.displayName = 'NodeCard';

export default NodeCard;
