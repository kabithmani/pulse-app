'use client';

import { Task } from '@/lib/types';
import { format, isPast, isToday } from 'date-fns';
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}

const typeConfig = {
  task: { label: 'Task', bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
  follow_up: { label: 'Follow-up', bg: '#E5F1FF', color: '#007AFF' },
  reminder: { label: 'Reminder', bg: '#FFF7ED', color: '#FF9500' },
  habit: { label: 'Habit', bg: '#EEFBF2', color: '#34C759' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'var(--text-tertiary)' },
  medium: { label: 'Medium', color: 'var(--text-secondary)' },
  high: { label: 'High', color: '#FF9500' },
  urgent: { label: 'Urgent', color: '#FF3B30' },
};

export default function TaskCard({ task, onToggle, onDelete }: TaskCardProps) {
  const [showActions, setShowActions] = useState(false);
  const isCompleted = task.status === 'completed';
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !isCompleted;
  const type = typeConfig[task.type];
  const priority = priorityConfig[task.priority];

  const formatDueDate = () => {
    if (!task.due_date) return null;
    const date = new Date(task.due_date);
    if (isToday(date)) return task.due_time ? `Today ${task.due_time}` : 'Today';
    return format(date, 'MMM d') + (task.due_time ? ` ${task.due_time}` : '');
  };

  return (
    <div
      className="group rounded-xl p-4 relative"
      style={{
        background: 'var(--bg)',
        border: `1px solid ${isOverdue ? 'rgba(255,59,48,0.2)' : 'var(--border)'}`,
        opacity: isCompleted ? 0.55 : 1,
      }}
      onClick={() => setShowActions(!showActions)}
    >
      <div className="flex gap-3">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: isCompleted ? 'var(--success)' : isOverdue ? 'var(--danger)' : 'var(--border)',
            background: isCompleted ? 'var(--success)' : 'transparent',
          }}>
          {isCompleted && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type + Priority badges */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: type.bg, color: type.color }}>
              {type.label}
            </span>
            {(task.priority === 'high' || task.priority === 'urgent') && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: task.priority === 'urgent' ? '#FFF0EF' : '#FFF7ED', color: priority.color }}>
                {priority.label}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-snug"
            style={{
              color: 'var(--text-primary)',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}>
            {task.title}
          </p>

          {/* Description */}
          {task.description && (
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {task.description}
            </p>
          )}

          {/* Footer: contact + date */}
          <div className="flex items-center gap-3 mt-2">
            {task.contact && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: '#5856D6' }}>
                  {task.contact.name[0]}
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {task.contact.name}
                </span>
              </div>
            )}
            {task.due_date && (
              <span className="text-[11px]"
                style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                {formatDueDate()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons (shown on click/tap) */}
      {showActions && (
        <div className="flex justify-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={(e) => { e.stopPropagation(); onToggle(); setShowActions(false); }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {isCompleted ? 'Reopen' : 'Complete'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowActions(false); }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#FFF0EF', color: 'var(--danger)' }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
