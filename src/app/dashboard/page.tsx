'use client';

import { useState, useEffect, useMemo } from 'react';
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

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('ea');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [webhookKey, setWebhookKey] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const {
    tasks, loading: tasksLoading, completedTasks,
    createTask, toggleComplete, deleteTask, updateTask,
    error: taskError, clearError,
  } = useTasks(user?.id);

  const { contacts, findOrCreateByName } = useContacts(user?.id);
  const { alerts, dismissAlert, dismissAll } = useTaskAlerts(tasks);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const scoredTasks = useMemo(() => scoreAllTasks(tasks), [tasks]);
  const highRisk = useMemo(() => scoredTasks.filter(t => t.risk === 'high'), [scoredTasks]);
  const mediumRisk = useMemo(() => scoredTasks.filter(t => t.risk === 'medium'), [scoredTasks]);
  const safe = useMemo(() => scoredTasks.filter(t => t.risk === 'safe'), [scoredTasks]);
  const noDate = useMemo(() => scoredTasks.filter(t => t.risk === 'no_date'), [scoredTasks]);

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'there';
  const sub = useSubscription(user);

  const fetchWebhookKey = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
      const res = await fetch('/api/webhook/keygen', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      setWebhookKey(json.zapier_url || null);
    } catch { setWebhookKey(null); }
  };

  const copyWebhook = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  };
  const eaInsight = useMemo(
    () => generateEAInsight(tasks, displayName),
    [tasks, displayName]
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-3"
            style={{ background: 'var(--accent)' }}>P</div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading Pulse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Subscription Banner ── */}
      <SubscriptionBanner sub={sub} />

      {/* ── Error Banner ── */}
      {taskError && (
        <div className="sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between text-xs font-medium text-white"
          style={{ background: '#FF3B30' }}>
          <span>⚠ {taskError}</span>
          <button onClick={clearError} className="ml-3 opacity-80 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Offline Banner ── */}
      {!isOnline && (
        <div className="offline-banner sticky top-0 z-50 px-4 py-2.5 text-center text-xs font-medium text-white"
          style={{ background: '#636366' }}>
          📡 You're offline — showing cached tasks. Changes will sync when you reconnect.
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 safe-top"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Pulse
          </h1>
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

            {/* Reports button */}
            <button onClick={() => router.push('/reports')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm ml-1"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              📊
            </button>

            {/* Profile menu */}
            <div className="relative ml-1">
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
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {displayName}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{user.email}</p>
                    </div>
                    <button onClick={() => { setShowWebhook(true); setShowMenu(false); fetchWebhookKey(); }}
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ color: 'var(--text-primary)' }}>
                      🔗 Webhook / Zapier
                    </button>
                    <button onClick={async () => {
                      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
                      const res = await fetch('/api/webhook/keygen', { headers: { Authorization: `Bearer ${session?.access_token}` } });
                      const json = await res.json();
                      const key = json.key;
                      if (key) window.open(`/api/calendar/ics?key=${key}`, '_blank');
                      setShowMenu(false);
                    }}
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ color: 'var(--text-primary)' }}>
                      📅 Sync to Google Calendar
                    </button>
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

      {/* ── Alert Toasts ── */}
      <AlertToast alerts={alerts} onDismiss={dismissAlert} onDismissAll={dismissAll} />
      <InstallPrompt />

      {/* ── Main Content ── */}
      <main className="max-w-2xl mx-auto px-4 pb-24">

        {view === 'ea' ? (
          <>
            <EABriefing insight={eaInsight} />

            {tasksLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : scoredTasks.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                  style={{ background: 'var(--bg-secondary)' }}>
                  ✨
                </div>
                <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  You're all clear
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Tap the + button to add your first task, follow-up, or reminder.
                </p>
              </div>
            ) : (
              <>
                <RiskSection
                  title="Needs immediate attention"
                  icon="🔴"
                  tasks={highRisk}
                  accentColor="#FF3B30"
                  onToggle={toggleComplete}
                  onDelete={deleteTask}
                  onUpdate={updateTask}
                />
                <RiskSection
                  title="Today's focus"
                  icon="🟠"
                  tasks={mediumRisk}
                  accentColor="#FF9500"
                  onToggle={toggleComplete}
                  onDelete={deleteTask}
                  onUpdate={updateTask}
                />
                {noDate.length > 0 && (
                  <RiskSection
                    title="No due date"
                    icon="⚪"
                    tasks={noDate}
                    accentColor="var(--text-tertiary)"
                    onToggle={toggleComplete}
                    onDelete={deleteTask}
                    onUpdate={updateTask}
                  />
                )}
                <RiskSection
                  title="On track"
                  icon="🟢"
                  tasks={safe}
                  accentColor="#34C759"
                  onToggle={toggleComplete}
                  onDelete={deleteTask}
                  onUpdate={updateTask}
                />
                {completedTasks.length > 0 && (
                  <details className="mb-6">
                    <summary className="flex items-center gap-2 px-1 cursor-pointer text-xs font-semibold tracking-wide uppercase"
                      style={{ color: 'var(--text-tertiary)' }}>
                      <span>✓</span> Completed ({completedTasks.length})
                    </summary>
                    <div className="mt-3 space-y-2 opacity-60">
                      {completedTasks.slice(0, 5).map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={() => toggleComplete(task.id, task.status)}
                          onDelete={() => deleteTask(task.id)}
                          onUpdate={(updates: Partial<Task>) => updateTask(task.id, updates)}
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
            <div className="mt-6 mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                All pending tasks
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {scoredTasks.length}
              </span>
            </div>
            {tasksLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : scoredTasks.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                  style={{ background: 'var(--bg-secondary)' }}>
                  📋
                </div>
                <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  No tasks yet
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Tap + to add your first one. Try saying it with your voice.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {scoredTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => toggleComplete(task.id, task.status)}
                    onDelete={() => deleteTask(task.id)}
                    onUpdate={(updates: Partial<Task>) => updateTask(task.id, updates)}
                  />
                ))}
              </div>
            )}
          </>

        ) : (
          <PeopleView
  contacts={contacts}
  tasks={tasks}
  onUpdateTask={updateTask}
  onCreateTask={createTask}
/>
        )}
      </main>

      {/* ── Floating Add Button ── */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-lg z-20 active:scale-95"
        style={{ background: 'var(--accent)', boxShadow: '0 4px 20px rgba(0,122,255,0.35)' }}>
        +
      </button>

      {/* ── Webhook Modal ── */}
      {showWebhook && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowWebhook(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-2xl p-6 max-w-lg mx-auto shadow-2xl"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
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
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>YOUR WEBHOOK URL (for Zapier / Make / Pabbly)</p>
                  <div className="flex gap-2">
                    <div className="flex-1 text-xs px-3 py-2 rounded-lg font-mono break-all"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                      {webhookKey}
                    </div>
                    <button onClick={() => copyWebhook(webhookKey)}
                      className="px-3 py-2 rounded-lg text-xs font-medium text-white shrink-0"
                      style={{ background: webhookCopied ? '#1D9E75' : 'var(--accent)' }}>
                      {webhookCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-secondary)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>HOW TO USE IN ZAPIER</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>1. Add a "Webhooks by Zapier" action → POST</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>2. Paste the URL above</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>3. Set body: <span className="font-mono" style={{ color: 'var(--accent)' }}>{"{ \"title\": \"...\", \"type\": \"follow_up\" }"}</span></p>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>PAYLOAD FIELDS</p>
                  <div className="space-y-1">
                    {[
                      ['title', 'required', 'Task name'],
                      ['type', 'optional', 'task / follow_up / reminder / habit'],
                      ['priority', 'optional', 'low / medium / high / urgent'],
                      ['due_date', 'optional', 'e.g. 2026-04-10'],
                      ['contact', 'optional', 'Contact name to link'],
                      ['description', 'optional', 'Notes or context'],
                    ].map(([field, req, desc]) => (
                      <div key={field} className="flex gap-2 text-xs">
                        <span className="font-mono w-20 shrink-0" style={{ color: 'var(--accent)' }}>{field}</span>
                        <span className="w-14 shrink-0" style={{ color: req === 'required' ? '#E24B4A' : 'var(--text-tertiary)' }}>{req}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

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
