import { useState } from 'react';
import type { CreateSubtaskPayload } from '../types';

const ISSUE_TYPES = ['task', 'feature', 'bug', 'chore', 'epic'];
const PRIORITIES = [0, 1, 2, 3, 4];

interface CreateModalProps {
  parentTitle?: string;
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateSubtaskPayload) => void;
}

export function CreateModal({ parentTitle, isOpen, onClose, onSubmit, isSubmitting }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState(2);
  const [description, setDescription] = useState('');

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Create subtask</p>
            <h2 className="text-lg font-semibold text-slate-900">{parentTitle}</h2>
          </div>
          <button
            className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500 hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ title, type, priority, description });
            setTitle('');
            setDescription('');
            setPriority(2);
            setType('task');
          }}
        >
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Title</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Type</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {ISSUE_TYPES.map((issueType) => (
                  <option key={issueType} value={issueType}>
                    {issueType}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Priority</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={priority}
                onChange={(event) => setPriority(Number(event.target.value))}
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    P{value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Description</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create subtask'}
          </button>
        </form>
      </div>
    </div>
  );
}
