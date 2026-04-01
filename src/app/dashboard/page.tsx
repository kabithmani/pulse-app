'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useContacts } from '@/hooks/useContacts';
import EABriefing from '@/lib/EABriefing';
import RiskSection from '@/lib/RiskSection';
import TaskCard from '@/components/TaskCard';
import QuickAdd from '@/components/QuickAdd';
import PeopleView from '@/components/PeopleView';
import { scoreAllTasks, generateEAInsight, ScoredTask } from '@/lib/riskEngine';

type ViewMode = 'ea' | 'all' | 'people';

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('ea');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const {
    tasks, loading: tasksLoading, completedTasks,
    createTask, toggleComplete, deleteTask,
  } = useTasks(user?.id);

  const { contacts, findOrCreateByName } = useContacts(user?.id);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // ── Risk scoring ──
  const scoredTasks = useMemo(() => scoreAllTasks(tasks), [tasks]);
  const highRisk = useMemo(() => scoredTasks.filter(t => t.risk === 'high'), [scoredTasks]);
  const mediumRisk = useMemo(() => scoredTasks.filter(t => t.risk === 'medium'), [scoredTasks]);
  const safe = useMemo(() => scoredTasks.filter(t => t.risk === 'safe'), [scoredTasks]);
  const noDate = useMemo(() => scoredTasks.filter(t => t.risk === 'no_date'), [scoredTasks]);

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'there';
  const eaInsight = useMemo(
    () => generateEAInsight(tasks, displayName),
    [tasks, displayName]
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 safe-top" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Pulse</h1>
          <div className="flex items-center gap-1">
            {/* View toggles */}
            <div className="flex rounded-lg overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              {(['ea', 'all', 'people'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: view === v ? 'var(--bg)' : 'transparent',
                    color: view === v ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    borderRadius: '6px', margin: '2px',
                  }}>
                  {v === 'ea' ? 'EA' : v === 'all' ? 'All' : 'People'}
                </button>
              ))}
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
        {view === 'ea' ? (
          <>
            {/* EA Briefing */}
            <EABriefing insight={eaInsight} />

            {/* Loading state */}
            {tasksLoading ? (
              <div className="py-12 text-center">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Analyzing your tasks...</p>
              </div>
            ) : scoredTasks.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl mb-3">✨</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  No tasks yet. Tap + to add your first one.
                </p>
              </div>
            ) : (
              <>
                {/* 🔴 High Risk */}
                <RiskSection
                  title="Needs immediate attention"
                  icon="🔴"
                  tasks={highRisk}
                  accentColor="#FF3B30"
                  onToggle={toggleComplete}
                  onDelete={deleteTask}
                />

                {/* 🟠 Today Focus */}
                <RiskSection
                  title="Today's focus"
                  icon="🟠"
                  tasks={mediumRisk}
                  accentColor="#FF9500"
                  onToggle={toggleComplete}
                  onDelete={deleteTask}
                />

                {/* ⚪ No date set */}
                {noDate.length > 0 && (
                  <RiskSection
                    title="No due date"
                    icon="⚪"
                    tasks={noDate}
                    accentColor="var(--text-tertiary)"
                    onToggle={toggleComplete}
                    onDelete={deleteTask}
                  />
                )}

                {/* 🟢 Safe */}
                <RiskSection
                  title="On track"
                  icon="🟢"
                  tasks={safe}
                  accentColor="#34C759"
                  onToggle={toggleComplete}
                  onDelete={deleteTask}
                />

                {/* Completed section (collapsed) */}
                {completedTasks.length > 0 && (
                  <details className="mb-6">
                    <summary className="flex items-center gap-2 px-1 cursor-pointer text-xs font-semibold tracking-wide uppercase"
                      style={{ color: 'var(--text-tertiary)' }}>
                      <span>✓</span>
                      Completed ({completedTasks.length})
                    </summary>
                    <div className="mt-3 space-y-2 opacity-60">
                      {completedTasks.slice(0, 5).map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={() => toggleComplete(task.id, task.status)}
                          onDelete={() => deleteTask(task.id)}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </>
        ) : view === 'all' ? (
          <>
            {/* Simple flat list of all pending tasks */}
            <div className="mt-6 mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                All pending tasks ({scoredTasks.length})
              </h2>
            </div>
            <div className="space-y-2">
              {scoredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={() => toggleComplete(task.id, task.status)}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
              {scoredTasks.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-4xl mb-3">✨</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>All clear!</p>
                </div>
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
