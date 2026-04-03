'use client';

import { Contact, Task } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';
import { useState } from 'react';

interface PeopleViewProps {
  contacts: Contact[];
  tasks: Task[];
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onCreateTask?: (data: any) => void;
}

const FOLLOW_UP_TEMPLATES = [
  { label: 'Checked in', icon: '✓' },
  { label: 'Sent document', icon: '📄' },
  { label: 'Scheduled meeting', icon: '📅' },
  { label: 'Left voicemail', icon: '📞' },
  { label: 'Sent email', icon: '✉' },
  { label: 'WhatsApp message', icon: '💬' },
];

const SNOOZE_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

const colors = ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55'];

export default function PeopleView({ contacts, tasks, onUpdateTask, onCreateTask }: PeopleViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState<string | null>(null);
  const [showSnooze, setShowSnooze] = useState<string | null>(null);

  const getTasksForContact = (contactId: string) =>
    tasks.filter(t => t.contact_id === contactId).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const getLastContacted = (contactId: string) => {
    const done = tasks.filter(t => t.contact_id === contactId && t.status === 'completed');
    if (!done.length) return null;
    return done.sort((a, b) =>
      new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime()
    )[0].completed_at || done[0].created_at;
  };

  const getStaleness = (last: string | null) => {
    if (!last) return null;
    const days = differenceInDays(new Date(), new Date(last));
    if (days <= 2)  return { label: 'Recent',           color: 'var(--success)', bg: '#EEFBF2' };
    if (days <= 7)  return { label: `${days}d ago`,     color: '#FF9500',        bg: '#FFF7ED' };
    if (days <= 14) return { label: `${days}d ago`,     color: '#FF6B00',        bg: '#FFF0E5' };
    return           { label: `${days}d ago — stale`,   color: 'var(--danger)',  bg: '#FFF0EF' };
  };

  const handleTemplate = async (contactId: string, t: typeof FOLLOW_UP_TEMPLATES[0]) => {
    if (!onCreateTask) return;
    await onCreateTask({
      title: `${t.icon} ${t.label}`,
      type: 'follow_up',
      priority: 'medium',
      contact_id: contactId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
    setShowTemplates(null);
  };

  const handleSnooze = async (taskId: string, days: number) => {
    if (!onUpdateTask) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    await onUpdateTask(taskId, { due_date: d.toISOString(), status: 'pending' });
    setShowSnooze(null);
  };

  if (contacts.length === 0) {
    return (
      <div className="py-16 text-center mt-6">
        <p className="text-4xl mb-3">👥</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No contacts yet</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Create a task linked to a person and they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider mb-3 px-1"
        style={{ color: 'var(--text-tertiary)' }}>
        {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
      </p>

      {contacts.map((contact, i) => {
        const contactTasks = getTasksForContact(contact.id);
        const pendingTasks  = contactTasks.filter(t => t.status !== 'completed');
        const isExpanded    = expandedId === contact.id;
        const color         = colors[i % colors.length];
        const lastContacted = getLastContacted(contact.id);
        const staleness     = getStaleness(lastContacted);

        return (
          <div key={contact.id} className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>

            {/* ── Contact header ── */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : contact.id)}
              className="w-full flex items-center gap-3 p-4 text-left">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: color }}>
                {contact.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {contact.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {contact.company && (
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{contact.company}</p>
                  )}
                  {staleness ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: staleness.bg, color: staleness.color }}>
                      {staleness.label}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                      Never contacted
                    </span>
                  )}
                </div>
              </div>
              {pendingTasks.length > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#E5F1FF', color: '#007AFF' }}>
                  {pendingTasks.length} pending
                </span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                style={{ color: 'var(--text-tertiary)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}>
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* ── Expanded section ── */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)' }}>

                {/* Quick actions */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTemplates(showTemplates === contact.id ? null : contact.id)}
                      className="flex-1 text-xs py-2 rounded-lg font-medium"
                      style={{ background: '#E5F1FF', color: '#007AFF', border: '1px solid rgba(0,122,255,0.15)' }}>
                      + Log interaction
                    </button>
                    {pendingTasks[0] && (
                      <button
                        onClick={() => setShowSnooze(showSnooze === pendingTasks[0].id ? null : pendingTasks[0].id)}
                        className="flex-1 text-xs py-2 rounded-lg font-medium"
                        style={{ background: '#FFF7ED', color: '#FF9500', border: '1px solid rgba(255,149,0,0.15)' }}>
                        ⏸ Snooze
                      </button>
                    )}
                  </div>

                  {/* Template picker */}
                  {showTemplates === contact.id && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {FOLLOW_UP_TEMPLATES.map(t => (
                        <button key={t.label}
                          onClick={() => handleTemplate(contact.id, t)}
                          className="text-xs px-3 py-2 rounded-lg text-left font-medium"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Snooze picker */}
                  {pendingTasks[0] && showSnooze === pendingTasks[0].id && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {SNOOZE_OPTIONS.map(opt => (
                        <button key={opt.label}
                          onClick={() => handleSnooze(pendingTasks[0].id, opt.days)}
                          className="text-xs px-3 py-2 rounded-lg font-medium"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                {contactTasks.length > 0 ? (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider mb-2"
                      style={{ color: 'var(--text-tertiary)' }}>
                      Timeline
                    </p>
                    {contactTasks.map((task, idx) => (
                      <div key={task.id} className="flex items-start gap-3 py-2 relative">
                        {idx < contactTasks.length - 1 && (
                          <div className="absolute left-[6px] top-5 bottom-0 w-px"
                            style={{ background: 'var(--border)' }} />
                        )}
                        <div className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 border-2"
                          style={{
                            background: task.status === 'completed' ? 'var(--success)' : 'var(--bg)',
                            borderColor: task.status === 'completed' ? 'var(--success)' : color,
                            zIndex: 1,
                          }} />
                        <div className="flex-1 pb-1">
                          <p className="text-xs font-medium" style={{
                            color: 'var(--text-primary)',
                            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                            opacity: task.status === 'completed' ? 0.6 : 1,
                          }}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                              {format(new Date(task.created_at), 'MMM d, yyyy')}
                            </p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{
                                background: task.type === 'follow_up' ? '#E5F1FF' : 'var(--bg-tertiary)',
                                color: task.type === 'follow_up' ? '#007AFF' : 'var(--text-tertiary)',
                              }}>
                              {task.type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 pb-4">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      No interactions yet. Log your first one above.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
