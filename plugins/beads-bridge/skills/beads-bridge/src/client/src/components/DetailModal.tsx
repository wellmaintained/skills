import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { STATUS_OPTIONS, STATUS_STYLES } from '../status';
import type { DashboardIssue, IssueStatus } from '../types';

interface DetailModalProps {
  issue?: DashboardIssue | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (issueId: string, status: IssueStatus) => void;
  onReparent: (issueId: string, newParentId: string) => void;
  onTitleChange?: (issueId: string, title: string) => Promise<void>;
  onDescriptionChange?: (issueId: string, description: string) => Promise<void>;
  parentOptions: Array<{ id: string; title: string }>;
  childCount?: number;
}

// Simple SVG icons
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const FlagIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
    />
  </svg>
);

const LayoutIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
    />
  </svg>
);

const CheckSquareIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function DetailModal({
  issue,
  isOpen,
  onClose,
  onStatusChange,
  onReparent,
  onTitleChange,
  onDescriptionChange,
  parentOptions,
  childCount = 0,
}: DetailModalProps) {
  const [isStatusMenuOpen, setStatusMenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedTitleRef = useRef<string>('');
  const lastSavedDescriptionRef = useRef<string>('');
  const currentIssueIdRef = useRef<string>('');

  // Initialize and sync local state when issue changes, but preserve user edits
  useEffect(() => {
    if (!issue) return;

    const issueTitle = issue.title;
    const issueBody = issue.body || '';
    const isNewIssue = issue.id !== currentIssueIdRef.current;

    // If this is a new issue, reset everything
    if (isNewIssue) {
      setTitleValue(issueTitle);
      setDescriptionValue(issueBody);
      lastSavedTitleRef.current = issueTitle;
      lastSavedDescriptionRef.current = issueBody;
      currentIssueIdRef.current = issue.id;
      return;
    }

    // CRITICAL: Don't sync if we're currently saving - preserve the user's edits
    // This prevents the useEffect from overwriting edits during the save cycle
    if (isSavingTitle || isSavingDescription) {
      return;
    }

    // Only sync if there are no unsaved edits (local value matches what we last saved)
    // This means the user hasn't made any changes that haven't been saved yet
    const hasUnsavedTitleEdits = titleValue !== lastSavedTitleRef.current;
    if (!hasUnsavedTitleEdits) {
      // No unsaved edits - safe to sync if issue value differs
      // This handles external updates or optimistic updates that we haven't synced yet
      if (issueTitle !== titleValue) {
        setTitleValue(issueTitle);
        lastSavedTitleRef.current = issueTitle;
      }
    }
    // If there ARE unsaved edits, we don't sync - preserve the user's work

    const hasUnsavedDescriptionEdits = descriptionValue !== lastSavedDescriptionRef.current;
    if (!hasUnsavedDescriptionEdits) {
      // No unsaved edits - safe to sync if issue value differs
      if (issueBody !== descriptionValue) {
        setDescriptionValue(issueBody);
        lastSavedDescriptionRef.current = issueBody;
      }
    }
    // If there ARE unsaved edits, we don't sync - preserve the user's work
  }, [issue?.id, issue?.title, issue?.body, isSavingTitle, isSavingDescription, titleValue, descriptionValue]);

  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [titleValue]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !issue) {
    return null;
  }

  const currentStatus = (issue.metadata?.beadsStatus ?? 'open') as IssueStatus;
  const statusStyle = STATUS_STYLES[currentStatus];

  // Get border color based on status (2px border for better visibility)
  // To Do: Slate-300, In Progress: Blue-300, Blocked: Red-300, Completed: Green-300
  const borderColor =
    currentStatus === 'closed'
      ? 'border-2 border-green-300'
      : currentStatus === 'in_progress'
        ? 'border-2 border-blue-300'
        : currentStatus === 'blocked'
          ? 'border-2 border-red-300'
          : 'border-2 border-slate-300';

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(issue.id);
      setIsCopied(true);
      // Reset the copied indicator after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setTitleValue(newValue);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleTitleBlur = async () => {
    if (!issue || !onTitleChange || titleValue === lastSavedTitleRef.current) {
      return;
    }

    const valueToSave = titleValue;
    setIsSavingTitle(true);
    try {
      await onTitleChange(issue.id, valueToSave);
      // Update the ref to track what we just saved
      lastSavedTitleRef.current = valueToSave;
    } catch (error) {
      console.error('Failed to save title:', error);
      // Revert on error to the last saved value
      setTitleValue(lastSavedTitleRef.current);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescriptionValue(e.target.value);
  };

  const handleDescriptionBlur = async () => {
    if (!issue || !onDescriptionChange || descriptionValue === lastSavedDescriptionRef.current) {
      setIsDescriptionFocused(false);
      return;
    }

    const valueToSave = descriptionValue;
    setIsSavingDescription(true);
    try {
      await onDescriptionChange(issue.id, valueToSave);
      // Update the ref to track what we just saved
      lastSavedDescriptionRef.current = valueToSave;
    } catch (error) {
      console.error('Failed to save description:', error);
      // Revert on error to the last saved value
      setDescriptionValue(lastSavedDescriptionRef.current);
    } finally {
      setIsSavingDescription(false);
      setIsDescriptionFocused(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={clsx(
          'w-full max-w-2xl rounded-lg bg-white shadow-2xl',
          'max-h-[80vh] flex flex-col',
          borderColor, // Dynamic 2px border: Slate-300 (To Do), Blue-300 (In Progress), Red-300 (Blocked), Green-300 (Completed)
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Task ID with copy */}
            <button
              onClick={handleCopyId}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Click to copy ID"
            >
              <span className="font-mono text-sm font-medium text-slate-700">{issue.id}</span>
              {isCopied ? (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Copied!</span>
                </div>
              ) : (
                <svg
                  className="h-4 w-4 flex-shrink-0 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>

            {/* Timestamp */}
            <span className="text-xs text-slate-400">
              Updated {formatRelativeTime(issue.updatedAt)}
            </span>

            {/* Status Pill */}
            <div className="relative ml-auto">
              <button
                className={clsx(
                  'flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition',
                  statusStyle.bg,
                  statusStyle.border,
                  statusStyle.text
                )}
                onClick={() => setStatusMenuOpen(!isStatusMenuOpen)}
              >
                {STATUS_OPTIONS.find((status) => status.value === currentStatus)?.label ?? currentStatus}
                <ChevronDownIcon className="h-3 w-3" />
              </button>

              {isStatusMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setStatusMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-36 rounded-lg border border-slate-200 bg-white shadow-lg">
                    {STATUS_OPTIONS.map((option) => {
                      const optionStyle = STATUS_STYLES[option.value];
                      return (
                        <button
                          key={option.value}
                          className={clsx(
                            'block w-full px-3 py-2 text-left text-xs hover:bg-slate-50',
                            option.value === currentStatus
                              ? 'text-slate-900 font-semibold'
                              : 'text-slate-600'
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            setStatusMenuOpen(false);
                            if (option.value !== currentStatus) {
                              onStatusChange(issue.id, option.value);
                            }
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Title Field - Auto-resizing textarea */}
          <textarea
            ref={titleTextareaRef}
            value={titleValue}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            disabled={isSavingTitle}
            className="w-full resize-none border-0 bg-slate-50 text-2xl font-bold text-slate-900 focus:outline-none focus:ring-0 disabled:opacity-50"
            rows={1}
            style={{ minHeight: '2.5rem' }}
            placeholder="Enter title..."
          />

          {/* Description - Large scrollable area */}
          <textarea
            value={descriptionValue}
            onChange={handleDescriptionChange}
            onFocus={() => setIsDescriptionFocused(true)}
            onBlur={handleDescriptionBlur}
            disabled={isSavingDescription}
            className={clsx(
              'mt-4 min-h-[200px] w-full resize-none rounded-lg border p-4 text-sm text-slate-700 transition-colors',
              isDescriptionFocused
                ? 'bg-white ring-2 ring-blue-300 border-blue-300'
                : 'bg-slate-50/50 border-slate-200',
              isSavingDescription && 'opacity-50'
            )}
            placeholder="Enter description..."
          />
        </div>

        {/* Footer Metadata */}
        <div className="flex items-center gap-4 border-t border-slate-100 px-6 py-3 text-sm text-slate-600">
          {/* Priority */}
          <div className="flex items-center gap-2">
            <FlagIcon className="h-4 w-4 text-slate-500" />
            <span>P{issue.metadata?.beadsPriority ?? '—'}</span>
          </div>

          {/* Type */}
          <div className="flex items-center gap-2">
            <LayoutIcon className="h-4 w-4 text-slate-500" />
            <span className="capitalize">{issue.metadata?.beadsType ?? 'task'}</span>
          </div>

          {/* Subtasks */}
          <div className="flex items-center gap-2">
            <CheckSquareIcon className="h-4 w-4 text-slate-500" />
            <span>{childCount} {childCount === 1 ? 'Subtask' : 'Subtasks'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
