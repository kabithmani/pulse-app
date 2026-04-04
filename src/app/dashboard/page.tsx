'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useContacts } from '@/hooks/useContacts';
import EABriefing from '@/lib/EABriefing';
import RiskSection from '@/lib/RiskSection';
import TaskCard from '@/components/TaskCard';
import SkeletonCard from '@/components/SkeletonCard';
import QuickAdd from '@/components/QuickAdd';
import PeopleView from '@/components/PeopleView';
import { scoreAllTasks, generateEAInsight } from '@/lib/riskEngine';
import { useTaskAlerts, requestNotificationPermission } from '@/hooks/useTaskAlerts';
import AlertToast from '@/hooks/AlertToast';
import { Task } from '@/lib/types';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import InstallPrompt from '@/components/InstallPrompt';

type ViewMode = 'ea' | 'all' | 'people';
type AllFilter = 'today' | 'overdue' | 'upcoming' | 'completed' | 'all';

const isToday = (d: string) => {
  const t = new Date(d); const n = new Date();
  return t.getDate()===n.getDate() && t.getMonth()===n.getMonth() && t.getFullYear()===n.getFullYear();
};
const isPast = (d: string) => new Date(d) < new Date();
const isFuture = (d: string) => { const t = new Date(d); const n = new Date(); n.setHours(23,59,59,999); return t > n; };

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('ea');
  const [allFilter, setAllFilter] = useState<AllFilter>('all');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [webhookKey, setWebhookKey] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [myDay, setMyDay] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    tasks, loading: tasksLoading, completedTasks,
    createTask, toggleComplete, deleteTask, updateTask,
    error: taskError, clearError,
  } = useTasks(user?.id);

  const { contacts, findOrCreateByName } = useContacts(user?.id);
  const { alerts, dismissAlert, dismissAll } = useTaskAlerts(tasks);
  const sub = useSubscription(user);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  useEffect(() => { requestNotificationPermission(); }, []);
  useEffect(() => { if (!authLoading && !user) router.replace('/login'); }, [user, authLoading, router]);

  // Load My Day from localStorage
  useEffect(() => {
    try { const s = localStorage.getItem('pulse_myday'); if (s) setMyDay(new Set(JSON.parse(s))); } catch {}
  }, []);

  const toggleMyDay = (id: string) => {
    setMyDay(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      try { localStorage.setItem('pulse_myday', JSON.stringify([...n])); } catch {}
      return n;
    });
  };

  const scoredTasks = useMemo(() => scoreAllTasks(tasks), [tasks]);
  const highRisk = useMemo(() => scoredTasks.filter(t => t.risk === 'high'), [scoredTasks]);
  const mediumRisk = useMemo(() => scoredTasks.filter(t => t.risk === 'medium'), [scoredTasks]);
  const safe = useMemo(() => scoredTasks.filter(t => t.risk === 'safe'), [scoredTasks]);
  const noDate = useMemo(() => scoredTasks.filter(t => t.risk === 'no_date'), [scoredTasks]);
  const myDayTasks = useMemo(() => scoredTasks.filter(t => myDay.has(t.id)), [scoredTasks, myDay]);

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'there';
  const eaInsight = useMemo(() => generateEAInsight(tasks, displayName), [tasks, displayName]);

  // Filtered "All" view
  const filteredAll = useMemo(() => {
    let base = allFilter === 'completed' ? completedTasks : scoredTasks;
    if (allFilter === 'today') base = scoredTasks.filter(t => t.due_date && isToday(t.due_date));
    else if (allFilter === 'overdue') base = scoredTasks.filter(t => t.due_date && isPast(t.due_date));
    else if (allFilter === 'upcoming') base = scoredTasks.filter(t => t.due_date && isFuture(t.due_date));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    return base;
  }, [scoredTasks, completedTasks, allFilter, searchQuery]);

  // Search across all tasks
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return [...scoredTasks, ...completedTasks].filter(t =>
      t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    );
  }, [searchQuery, scoredTasks, completedTasks]);

  const fetchWebhookKey = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      const res = await fetch('/api/webhook/keygen', { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const json = await res.json();
      setWebhookKey(json.zapier_url || null);
    } catch { setWebhookKey(null); }
  };

  const copyWebhook = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setWebhookCopied(true); setTimeout(() => setWebhookCopied(false), 2000); });
  };

  const allFilterCounts = useMemo(() => ({
    today: scoredTasks.filter(t => t.due_date && isToday(t.due_date)).length,
    overdue: scoredTasks.filter(t => t.due_date && isPast(t.due_date)).length,
    upcoming: scoredTasks.filter(t => t.due_date && isFuture(t.due_date)).length,
    completed: completedTasks.length,
    all: scoredTasks.length,
  }), [scoredTasks, completedTasks]);

  if (authLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-3" style={{ background: 'var(--accent)' }}>P</div>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading Pulse...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <SubscriptionBanner sub={sub} />

      {taskError && (
        <div className="sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between text-xs font-medium text-white" style={{ background: '#FF3B30' }}>
          <span>⚠ {taskError}</span>
          <button onClick={clearError} className="ml-3 opacity-80 hover:opacity-100">✕</button>
        </div>
      )}
      {!isOnline && (
        <div className="sticky top-0 z-50 px-4 py-2.5 text-center text-xs font-medium text-white" style={{ background: '#636366' }}>
          📡 Offline — cached tasks shown. Will sync when reconnected.
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 safe-top" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>

        {/* Row 1: Logo + actions */}
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Pulse</h1>
          <div className="flex items-center gap-2">
            {/* Search */}
            <button onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchRef.current?.focus(), 50); }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: showSearch ? 'var(--accent)' : 'var(--bg-secondary)', color: showSearch ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              🔍
            </button>
            {/* Webhook */}
            <button onClick={() => { setShowWebhook(true); fetchWebhookKey(); }}
              title="Webhook / Zapier"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              🔗 <span className="hidden sm:inline">Webhook</span>
            </button>
            {/* Calendar */}
            <button
              title="Sync tasks to your calendar (Google, Outlook, Apple)"
              onClick={async () => {
                const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
                const res = await fetch('/api/webhook/keygen', { headers: { Authorization: `Bearer ${session?.access_token}` } });
                const json = await res.json();
                if (json.key) window.open(`/api/calendar/ics?key=${json.key}`, '_blank');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              📅 <span className="hidden sm:inline">Calendar</span>
            </button>
            {/* Avatar */}
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                title={user.email ?? ''}
                style={{ background: 'var(--accent)' }}>
                {displayName[0].toUpperCase()}
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 w-52 rounded-xl py-1 shadow-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{user.email}</p>
                    </div>
                    <button onClick={() => { signOut(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm" style={{ color: 'var(--danger)' }}>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="max-w-2xl mx-auto px-4 pb-2">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
          </div>
        )}

        {/* Row 2: Main nav tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-0" style={{ borderTop: '1px solid var(--border)' }}>
          {([
            { key: 'ea',      label: '⚡ EA' },
            { key: 'all',     label: '☰  All' },
            { key: 'people',  label: '👤 People' },
            { key: 'reports', label: '📊 Reports' },
          ] as const).map(({ key, label }) => (
            <button key={key}
              onClick={() => key === 'reports' ? router.push('/reports') : setView(key as ViewMode)}
              className="flex-1 py-2.5 text-xs font-semibold text-center"
              style={{
                color: view === key ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: view === key ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* All-view filter tabs */}
        {view === 'all' && (
          <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto" style={{ borderTop: '1px solid var(--border)' }}>
            {([
              { key: 'all', label: 'All', count: allFilterCounts.all },
              { key: 'today', label: 'Today', count: allFilterCounts.today },
              { key: 'overdue', label: 'Overdue', count: allFilterCounts.overdue },
              { key: 'upcoming', label: 'Upcoming', count: allFilterCounts.upcoming },
              { key: 'completed', label: 'Done', count: allFilterCounts.completed },
            ] as { key: AllFilter; label: string; count: number }[]).map(f => (
              <button key={f.key} onClick={() => setAllFilter(f.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 mt-2"
                style={{
                  background: allFilter === f.key ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: allFilter === f.key ? 'white' : 'var(--text-secondary)',
                  border: allFilter === f.key ? 'none' : '1px solid var(--border)',
                }}>
                {f.label}
                {f.count > 0 && <span className="text-xs opacity-80">{f.count}</span>}
              </button>
            ))}
          </div>
        )}
      </header>

      <AlertToast alerts={alerts} onDismiss={dismissAlert} onDismissAll={dismissAll} />
      <InstallPrompt />

      {/* ── Main Content ── */}
      <main className="max-w-2xl mx-auto px-4 pb-24">

        {/* Search results overlay */}
        {showSearch && searchQuery.trim() && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold px-1" style={{ color: 'var(--text-tertiary)' }}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
            {searchResults.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No tasks match your search</p>
              </div>
            ) : searchResults.map(task => (
              <TaskCard key={task.id} task={task}
                onToggle={() => toggleComplete(task.id, task.status)}
                onDelete={() => deleteTask(task.id)}
                onUpdate={(u: Partial<Task>) => updateTask(task.id, u)} />
            ))}
          </div>
        )}

        {/* EA View */}
        {!showSearch && view === 'ea' && (
          <>
            {/* My Day section */}
            {myDayTasks.length > 0 && (
              <div className="mt-4 mb-2">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>☀️ My Day — {myDayTasks.length} task{myDayTasks.length > 1 ? 's' : ''}</p>
                  <button onClick={() => { setMyDay(new Set()); localStorage.removeItem('pulse_myday'); }}
                    className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Clear</button>
                </div>
                <div className="space-y-2">
                  {myDayTasks.map(task => (
                    <TaskCard key={task.id} task={task}
                      onToggle={() => toggleComplete(task.id, task.status)}
                      onDelete={() => deleteTask(task.id)}
                      onUpdate={(u: Partial<Task>) => updateTask(task.id, u)}
                      myDay={true} onToggleMyDay={() => toggleMyDay(task.id)} />
                  ))}
                </div>
                <div className="mt-3 mb-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
            )}

            <EABriefing insight={eaInsight} />

            {tasksLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : scoredTasks.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4" style={{ background: 'var(--bg-secondary)' }}>✨</div>
                <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>You're all clear</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tap + to add your first task, follow-up, or reminder.</p>
              </div>
            ) : (
              <>
                <RiskSection title="Needs immediate attention" icon="🔴" tasks={highRisk} accentColor="#FF3B30"
                  onToggle={toggleComplete} onDelete={deleteTask} onUpdate={updateTask}
                  myDay={myDay} onToggleMyDay={toggleMyDay} />
                <RiskSection title="Today's focus" icon="🟠" tasks={mediumRisk} accentColor="#FF9500"
                  onToggle={toggleComplete} onDelete={deleteTask} onUpdate={updateTask}
                  myDay={myDay} onToggleMyDay={toggleMyDay} />
                {noDate.length > 0 && (
                  <RiskSection title="No due date" icon="⚪" tasks={noDate} accentColor="var(--text-tertiary)"
                    onToggle={toggleComplete} onDelete={deleteTask} onUpdate={updateTask}
                    myDay={myDay} onToggleMyDay={toggleMyDay} />
                )}
                <RiskSection title="On track" icon="🟢" tasks={safe} accentColor="#34C759"
                  onToggle={toggleComplete} onDelete={deleteTask} onUpdate={updateTask}
                  myDay={myDay} onToggleMyDay={toggleMyDay} />
                {completedTasks.length > 0 && (
                  <details className="mb-6">
                    <summary className="flex items-center gap-2 px-1 cursor-pointer text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-tertiary)' }}>
                      <span>✓</span> Completed ({completedTasks.length})
                    </summary>
                    <div className="mt-3 space-y-2 opacity-60">
                      {completedTasks.slice(0, 10).map(task => (
                        <TaskCard key={task.id} task={task}
                          onToggle={() => toggleComplete(task.id, task.status)}
                          onDelete={() => deleteTask(task.id)}
                          onUpdate={(u: Partial<Task>) => updateTask(task.id, u)} />
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </>
        )}

        {/* All View */}
        {!showSearch && view === 'all' && (
          <div className="mt-4">
            {tasksLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : filteredAll.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4" style={{ background: 'var(--bg-secondary)' }}>📋</div>
                <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {allFilter === 'today' ? 'Nothing due today' : allFilter === 'overdue' ? 'No overdue tasks' : allFilter === 'upcoming' ? 'Nothing upcoming' : allFilter === 'completed' ? 'No completed tasks yet' : 'No tasks yet'}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tap + to add your first task.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAll.map(task => (
                  <TaskCard key={task.id} task={task}
                    onToggle={() => toggleComplete(task.id, task.status)}
                    onDelete={() => deleteTask(task.id)}
                    onUpdate={(u: Partial<Task>) => updateTask(task.id, u)}
                    myDay={myDay.has(task.id)} onToggleMyDay={() => toggleMyDay(task.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* People View */}
        {!showSearch && view === 'people' && (
          <PeopleView contacts={contacts} tasks={tasks} onUpdateTask={updateTask} onCreateTask={createTask} />
        )}
      </main>

      {/* ── Floating Add Button ── */}
      <button onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-lg z-20 active:scale-95"
        style={{ background: 'var(--accent)', boxShadow: '0 4px 20px rgba(0,122,255,0.35)' }}>
        +
      </button>

      {/* ── Webhook Modal ── */}
      {showWebhook && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowWebhook(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-2xl p-6 max-w-lg mx-auto shadow-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>🔗 Webhook API</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Connect Zapier, Make, or Pabbly to auto-create tasks</p>
              </div>
              <button onClick={() => setShowWebhook(false)} style={{ color: 'var(--text-tertiary)' }}>✕</button>
            </div>
            {!webhookKey ? (
              <div className="py-4 text-center">
                <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>Generating your key...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>YOUR WEBHOOK URL</p>
                  <div className="flex gap-2">
                    <div className="flex-1 text-xs px-3 py-2 rounded-lg font-mono break-all" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>{webhookKey}</div>
                    <button onClick={() => copyWebhook(webhookKey)} className="px-3 py-2 rounded-lg text-xs font-medium text-white shrink-0" style={{ background: webhookCopied ? '#1D9E75' : 'var(--accent)' }}>
                      {webhookCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-secondary)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>HOW TO USE IN ZAPIER</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>1. Add "Webhooks by Zapier" → POST</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>2. Paste the URL above</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>3. Body: <span className="font-mono" style={{ color: 'var(--accent)' }}>{'{"title":"...","type":"follow_up"}'}</span></p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Quick Add Modal ── */}
      {showQuickAdd && (
        <QuickAdd contacts={contacts} onClose={() => setShowQuickAdd(false)}
          onSubmit={async (formData) => {
            if (formData.contact_id === '__new__' && formData.context) {
              const contact = await findOrCreateByName(formData.context);
              if (contact) formData.contact_id = contact.id;
              delete (formData as any).context;
            }
            await createTask(formData);
            setShowQuickAdd(false);
          }} />
      )}
    </div>
  );
}
