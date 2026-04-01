'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useContacts } from '@/hooks/useContacts';
import MorningBriefing from '@/components/MorningBriefing';
import TaskCard from '@/components/TaskCard';
import QuickAdd from '@/components/QuickAdd';
import PeopleView from '@/components/PeopleView';
import TaskFilters from '@/components/TaskFilters';

type ViewMode = 'today' | 'people';
type FilterMode = 'all' | 'today' | 'overdue' | 'upcoming' | 'completed';

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('today');
  const [filter, setFilter] = useState<FilterMode>('today');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const {
    tasks, loading: tasksLoading, todayTasks, overdueTasks, upcomingTasks,
    completedTasks, pendingTasks, createTask, toggleComplete, deleteTask, refetch,
  } = useTasks(user?.id);

  const { contacts, createContact, findOrCreateByName } = useContacts(user?.id);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // Pick which tasks to show based on filter
  const getFilteredTasks = () => {
    switch (filter) {
      case 'today': return todayTasks;
      case 'overdue': return overdueTasks;
      case 'upcoming': return upcomingTasks;
      case 'completed': return completedTasks;
      default: return pendingTasks;
    }
  };

  const filteredTasks = getFilteredTasks();
  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 safe-top" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Pulse</h1>
          <div className="flex items-center gap-1">
            {/* View toggles */}
            <div className="flex rounded-lg overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <button onClick={() => setView('today')}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  background: view === 'today' ? 'var(--bg)' : 'transparent',
                  color: view === 'today' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: view === 'today' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  borderRadius: '6px', margin: '2px',
                }}>
                Today
              </button>
              <button onClick={() => setView('people')}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  background: view === 'people' ? 'var(--bg)' : 'transparent',
                  color: view === 'people' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: view === 'people' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  borderRadius: '6px', margin: '2px',
                }}>
                People
              </button>
            </div>
            {/* Profile menu */}
            <div className="relative ml-2">
              <button onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                style={{ background: 'var(--accent)' }}>
                {displayName[0].toUpperCase()}
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 w-48 rounded-xl py-1 shadow-lg"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{user.email}</p>
                    </div>
                    <button onClick={() => { signOut(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ color: 'var(--danger)' }}>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-2xl mx-auto px-4 pb-24">
        {view === 'today' ? (
          <>
            {/* Morning briefing */}
            <MorningBriefing
              name={displayName}
              todayCount={todayTasks.length}
              overdueCount={overdueTasks.length}
              followUpCount={todayTasks.filter(t => t.type === 'follow_up').length}
            />

            {/* Filters */}
            <TaskFilters
              active={filter}
              onChange={setFilter}
              counts={{
                all: pendingTasks.length,
                today: todayTasks.length,
                overdue: overdueTasks.length,
                upcoming: upcomingTasks.length,
                completed: completedTasks.length,
              }}
            />

            {/* Task list */}
            <div className="mt-4 space-y-2">
              {tasksLoading ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading tasks...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-4xl mb-3">{filter === 'completed' ? '🎉' : '✨'}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {filter === 'completed' ? 'No completed tasks yet' :
                     filter === 'overdue' ? 'Nothing overdue — you\'re on track!' :
                     filter === 'today' ? 'No tasks for today' :
                     'All clear!'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    Tap the + button to add something
                  </p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => toggleComplete(task.id, task.status)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <PeopleView contacts={contacts} tasks={tasks} />
        )}
      </main>

      {/* ── Floating Add Button ── */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-lg z-20 active:scale-95"
        style={{ background: 'var(--accent)', boxShadow: '0 4px 20px rgba(0,122,255,0.35)' }}>
        +
      </button>

      {/* ── Quick Add Modal ── */}
      {showQuickAdd && (
        <QuickAdd
          contacts={contacts}
          onClose={() => setShowQuickAdd(false)}
          onSubmit={async (formData) => {
            // If a person was detected, find or create contact
            if (formData.contact_id === '__new__' && formData.context) {
              const contact = await findOrCreateByName(formData.context);
              if (contact) formData.contact_id = contact.id;
              delete (formData as any).context;
            }
            await createTask(formData);
            setShowQuickAdd(false);
          }}
        />
      )}
    </div>
  );
}
