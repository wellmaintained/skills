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
  const logger = new ClientLogger('NodeCard');

  const status = (issue.metadata?.beadsStatus ?? 'open') as IssueStatus;
  const statusStyle = STATUS_STYLES[status];

  return (
    <div
      className={clsx(
        'relative w-64 cursor-default rounded-2xl border bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur',
        statusStyle.border
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-slate-400" />
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="relative">
          <button
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
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
            <div className="absolute z-20 mt-2 w-36 rounded-lg border border-slate-200 bg-white shadow-lg">
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
        <div
          data-handleid="drag-handle"
          className="drag-handle rounded-full border border-dashed border-slate-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing select-none"
          title="Drag to reparent"
          draggable={false}
        >
          Drag
        </div>
        <button
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
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

      <div
        className="cursor-pointer px-4 pb-4 pt-2"
        onClick={() => onSelect(issue.id)}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
            <p className="mt-1 text-xs font-mono text-slate-500">{issue.id}</p>
          </div>
        </div>

      </div>

      {childCount > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex justify-center">
            <button
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              onClick={() => onToggleCollapse(issue.id)}
            >
              {isCollapsed ? `Show ${childCount}` : `Hide ${childCount}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

NodeCard.displayName = 'NodeCard';

export default NodeCard;
