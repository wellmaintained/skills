import type { IssueStatus } from './types';

export const STATUS_OPTIONS: Array<{ value: IssueStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'closed', label: 'Completed' },
];

export const STATUS_STYLES: Record<
  IssueStatus,
  { bg: string; border: string; text: string }
> = {
  open: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  in_progress: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
  blocked: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
  closed: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
};
