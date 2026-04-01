'use client';

import { Contact, Task } from '@/lib/types';
import { format } from 'date-fns';
import { useState } from 'react';

interface PeopleViewProps {
  contacts: Contact[];
  tasks: Task[];
}

export default function PeopleView({ contacts, tasks }: PeopleViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group tasks by contact
  const getTasksForContact = (contactId: string) =>
    tasks.filter(t => t.contact_id === contactId).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  // Unlinked tasks (tasks without a contact)
  const unlinkedTasks = tasks.filter(t => !t.contact_id && t.status !== 'completed');

  const colors = ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55'];

  if (contacts.length === 0) {
    return (
      <div className="py-16 text-center mt-6">
        <p className="text-4xl mb-3">👥</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          No contacts yet
        </p>
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
        const pendingCount = contactTasks.filter(t => t.status !== 'completed').length;
        const isExpanded = expandedId === contact.id;
        const color = colors[i % colors.length];

        return (
          <div key={contact.id} className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            {/* Contact header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : contact.id)}
              className="w-full flex items-center gap-3 p-4 text-left">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: color }}>
                {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {contact.name}
                </p>
                {contact.company && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{contact.company}</p>
                )}
              </div>
              {/* Badge */}
              {pendingCount > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#E5F1FF', color: '#007AFF' }}>
                  {pendingCount} pending
                </span>
              )}
              {/* Chevron */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                style={{
                  color: 'var(--text-tertiary)',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms',
                }}>
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Expanded task list */}
            {isExpanded && contactTasks.length > 0 && (
              <div className="px-4 pb-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider mt-3 mb-2"
                  style={{ color: 'var(--text-tertiary)' }}>
                  Interaction history
                </p>
                {contactTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: task.status === 'completed' ? 'var(--success)' : color }} />
                    <div className="flex-1">
                      <p className="text-xs" style={{
                        color: 'var(--text-primary)',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        opacity: task.status === 'completed' ? 0.5 : 1,
                      }}>
                        {task.title}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {format(new Date(task.created_at), 'MMM d, yyyy')}
                        {task.context && ` — ${task.context}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && contactTasks.length === 0 && (
              <div className="px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No tasks linked to this contact yet</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
