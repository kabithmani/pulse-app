'use client';

import { Task, TaskType, TaskPriority } from '@/lib/types';
import { format, isPast, isToday } from 'date-fns';
import { useState, useRef } from 'react';

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

const SWIPE_THRESHOLD = 72;

export default function TaskCard({ task, onToggle, onDelete, onUpdate }: TaskCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isSwiping.current && Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) > 8) isSwiping.current = true;
    if (!isSwiping.current) return;
    const clamped = Math.max(-100, Math.min(100, dx));
    setSwipeX(clamped);
  };

  const handleTouchEnd = () => {
    if (swipeX > SWIPE_THRESHOLD) onToggle();
    else if (swipeX < -SWIPE_THRESHOLD) onDelete();
    setSwipeX(0);
    isSwiping.current = false;
  };

  const swipeBg = swipeX > 0
    ? `rgba(52, 199, 89, ${Math.min(swipeX / SWIPE_THRESHOLD, 1) * 0.15})`
    : `rgba(255, 59, 48, ${Math.min(-swipeX / SWIPE_THRESHOLD, 1) * 0.15})`;

  const swipeIconOpacity = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);

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

  if (isEditing) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg)', border: '1px solid var(--accent)' }}
        onClick={e => e.stopPropagation()}
      >
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          autoFocus
          className="w-full text-sm font-medium bg-transparent outline-none mb-3"
          style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}
        />
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {([
            { value: 'task', label: 'Task' },
            { value: 'follow_up', label: 'Follow-up' },
            { value: 'reminder', label: 'Reminder' },
            { value: 'habit', label: 'Habit' },
          ] as { value: TaskType; label: string }[]).map(t => (
            <button key={t.value}
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
        <div className="flex gap-1.5 mb-3">
          {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
            <button key={p}
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
        <div className="flex gap-2 mb-4">
          <input type="date" value={editDate}
            onChange={e => setEditDate(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
          <input type="time" value={editTime}
            onChange={e => setEditTime(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="w-28 text-sm px-3 py-2 rounded-lg outline-none"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleEditSave}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            Save
          </button>
          <button onClick={handleEditCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ background: swipeBg }}>
      <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none">
        <span style={{ fontSize: 20, opacity: swipeX > 0 ? swipeIconOpacity : 0 }}>✓</span>
        <span style={{ fontSize: 20, opacity: swipeX < 0 ? swipeIconOpacity : 0 }}>🗑</span>
      </div>
      <div
        className="group rounded-xl p-4 relative"
        style={{
          background: 'var(--bg)',
          border: `1px solid ${isOverdue ? 'rgba(255,59,48,0.2)' : 'var(--border)'}`,
          opacity: isCompleted ? 0.55 : 1,
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? 'transform 0.3s ease' : 'none',
          touchAction: 'pan-y',
        }}
        onClick={() => { if (!isSwiping.current) setShowActions(!showActions); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex gap-3">
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
          <div className="flex-1 min-w-0">
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
            <p className="text-sm font-medium leading-snug"
              style={{ color: 'var(--text-primary)', textDecoration: isCompleted ? 'line-through' : 'none' }}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {task.description}
              </p>
            )}
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
        {showActions && (
          <div className="flex justify-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={handleEditOpen}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: '#E5F1FF', color: '#007AFF' }}>
              Edit
            </button>
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
    </div>
  );
}
