'use client';

import { Task, TaskType, TaskPriority } from '@/lib/types';
import { format, isPast, isToday } from 'date-fns';
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Task>) => void;
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

export default function TaskCard({ task, onToggle, onDelete, onUpdate }: TaskCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState(task.title);
  const [editType, setEditType] = useState<TaskType>(task.type);
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editDate, setEditDate] = useState(
    task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''
  );
  const [editTime, setEditTime] = useState(task.due_time || '');

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

  const handleEditOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(task.title);
    setEditType(task.type);
    setEditPriority(task.priority);
    setEditDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
    setEditTime(task.due_time || '');
    setIsEditing(true);
    setShowActions(false);
  };

  const handleEditSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    onUpdate({
      title: editTitle.trim(),
      type: editType,
      priority: editPriority,
      due_date: editDate ? new Date(editDate + 'T00:00:00').toISOString() : undefined,
      due_time: editTime || undefined,
    });
    setIsEditing(false);
  };

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  // ── EDIT MODE ──
  if (isEditing) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg)', border: '1px solid var(--accent)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title input */}
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          autoFocus
          className="w-full text-sm font-medium bg-transparent outline-none mb-3"
          style={{
            color: 'var(--text-primary)',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '8px',
          }}
        />

        {/* Type selector */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {([
            { value: 'task', label: 'Task' },
            { value: 'follow_up', label: 'Follow-up' },
            { value: 'reminder', label: 'Reminder' },
            { value: 'habit', label: 'Habit' },
          ] as { value: TaskType; label: string }[]).map(t => (
            <button
              key={t.value}
              onClick={e => { e.stopPropagation(); setEditType(t.value); }}
              className="text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap"
              style={{
                background: editType === t.value ? 'var(--text-primary)' : 'var(--bg-secondary)',
                color: editType === t.value ? 'var(--bg)' : 'var(--text-secondary)',
                border: editType === t.value ? 'none' : '1px solid var(--border)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Priority selector */}
        <div className="flex gap-1.5 mb-3">
          {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
            <button
              key={p}
              onClick={e => { e.stopPropagation(); setEditPriority(p); }}
              className="text-xs px-3 py-1.5 rounded-full font-medium capitalize"
              style={{
                background: editPriority === p ? 'var(--text-primary)' : 'var(--bg-secondary)',
                color: editPriority === p ? 'var(--bg)' : 'var(--text-secondary)',
                border: editPriority === p ? 'none' : '1px solid var(--border)',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Date + Time */}
        <div className="flex gap-2 mb-4">
          <input
            type="date"
            value={editDate}
            onChange={e => setEditDate(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
          <input
            type="time"
            value={editTime}
            onChange={e => setEditTime(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="w-28 text-sm px-3 py-2 rounded-lg outline-none"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-2">
          <button
            onClick={handleEditSave}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            Save
          </button>
          <button
            onClick={handleEditCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── NORMAL MODE ──
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

      {/* Action buttons */}
      {showActions && (
        <div className="flex justify-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleEditOpen}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#E5F1FF', color: '#007AFF' }}>
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); setShowActions(false); }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {isCompleted ? 'Reopen' : 'Complete'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); setShowActions(false); }}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#FFF0EF', color: 'var(--danger)' }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
