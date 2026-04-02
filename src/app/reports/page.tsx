'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, subDays, subMonths, startOfDay, endOfDay, differenceInHours } from 'date-fns';

type Period = '7d' | '30d' | '90d' | '180d';
type ExportFormat = 'csv' | 'json';

interface TaskEvent {
  id: string;
  task_id: string;
  event_type: string;
  old_value: any;
  new_value: any;
  note: string;
  source: string;
  created_at: string;
}

interface ReportData {
  total_created: number;
  total_completed: number;
  total_overdue: number;
  total_deleted: number;
  completion_rate: number;
  avg_completion_hours: number;
  busiest_day: string;
  by_type: Record<string, number>;
  daily_trend: { date: string; created: number; completed: number }[];
  events: TaskEvent[];
}

const PERIODS: { label: string; value: Period; days: number }[] = [
  { label: '7 days', value: '7d', days: 7 },
  { label: '30 days', value: '30d', days: 30 },
  { label: '3 months', value: '90d', days: 90 },
  { label: '6 months', value: '180d', days: 180 },
];

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('30d');
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'insights'>('overview');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchEvents();
  }, [user, period]);

  const fetchEvents = async () => {
    setLoading(true);
    const days = PERIODS.find(p => p.value === period)?.days || 30;
    const since = subDays(new Date(), days).toISOString();

    const { data, error } = await supabase
      .from('task_events')
      .select('*')
      .eq('user_id', user!.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (!error) setEvents(data || []);
    setLoading(false);
  };

  const report = useMemo((): ReportData => {
    const created = events.filter(e => e.event_type === 'created');
    const completed = events.filter(e => e.event_type === 'completed');
    const deleted = events.filter(e => e.event_type === 'deleted');

    // Avg completion time
    const completionTimes = completed.map(c => {
      const createdEvent = events.find(
        e => e.task_id === c.task_id && e.event_type === 'created'
      );
      if (!createdEvent) return null;
      return differenceInHours(new Date(c.created_at), new Date(createdEvent.created_at));
    }).filter((h): h is number => h !== null && h >= 0);

    const avgHours = completionTimes.length
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      : 0;

    // By type from new_value
    const byType: Record<string, number> = {};
    created.forEach(e => {
      const type = e.new_value?.type || 'task';
      byType[type] = (byType[type] || 0) + 1;
    });

    // Daily trend
    const days = PERIODS.find(p => p.value === period)?.days || 30;
    const dailyMap: Record<string, { created: number; completed: number }> = {};
    for (let i = 0; i < Math.min(days, 30); i++) {
      const d = format(subDays(new Date(), i), 'MMM d');
      dailyMap[d] = { created: 0, completed: 0 };
    }
    created.forEach(e => {
      const d = format(new Date(e.created_at), 'MMM d');
      if (dailyMap[d]) dailyMap[d].created++;
    });
    completed.forEach(e => {
      const d = format(new Date(e.created_at), 'MMM d');
      if (dailyMap[d]) dailyMap[d].completed++;
    });

    const daily_trend = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, ...v }))
      .reverse();

    // Busiest day
    const dayCount: Record<string, number> = {};
    events.forEach(e => {
      const day = format(new Date(e.created_at), 'EEEE');
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    const busiestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const completionRate = created.length
      ? Math.round((completed.length / created.length) * 100)
      : 0;

    // Overdue: tasks that were updated after their due date
    const overdueCount = events.filter(e =>
      e.event_type === 'overdue_flagged' ||
      (e.event_type === 'completed' && e.old_value?.due_date &&
        new Date(e.created_at) > new Date(e.old_value.due_date))
    ).length;

    return {
      total_created: created.length,
      total_completed: completed.length,
      total_overdue: overdueCount,
      total_deleted: deleted.length,
      completion_rate: completionRate,
      avg_completion_hours: avgHours,
      busiest_day: busiestDay,
      by_type: byType,
      daily_trend,
      events,
    };
  }, [events, period]);

  const exportData = (fmt: ExportFormat) => {
    if (fmt === 'json') {
      const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-activity-${period}-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
    } else {
      const headers = ['id', 'task_id', 'event_type', 'source', 'created_at', 'note'];
      const rows = events.map(e =>
        headers.map(h => JSON.stringify((e as any)[h] ?? '')).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-activity-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-3"
            style={{ background: 'var(--accent)' }}>P</div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <header className="sticky top-0 z-30"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')}
              className="text-sm" style={{ color: 'var(--accent)' }}>
              ← Back
            </button>
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Reports
            </h1>
          </div>
          {/* Export buttons */}
          <div className="flex gap-2">
            <button onClick={() => exportData('csv')}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              ↓ CSV
            </button>
            <button onClick={() => exportData('json')}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              ↓ JSON
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{
                background: period === p.value ? 'var(--accent)' : 'var(--bg-secondary)',
                color: period === p.value ? '#fff' : 'var(--text-secondary)',
                border: period === p.value ? 'none' : '1px solid var(--border)',
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-0 flex gap-0"
          style={{ borderTop: '1px solid var(--border)' }}>
          {(['overview', 'activity', 'insights'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2.5 text-xs font-medium capitalize"
              style={{
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {loading ? (
          <div className="space-y-3 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl skeleton" />
            ))}
          </div>
        ) : (

          <>
            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className="space-y-4">

                {/* Stat grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tasks created', value: report.total_created, color: 'var(--accent)' },
                    { label: 'Completed', value: report.total_completed, color: 'var(--success)' },
                    { label: 'Went overdue', value: report.total_overdue, color: 'var(--danger)' },
                    { label: 'Deleted', value: report.total_deleted, color: 'var(--text-tertiary)' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-xl p-4"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <p className="text-2xl font-bold mb-1" style={{ color: stat.color }}>
                        {stat.value}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Completion rate */}
                <div className="rounded-xl p-4"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Completion rate
                    </p>
                    <p className="text-lg font-bold" style={{ color: report.completion_rate >= 70 ? 'var(--success)' : report.completion_rate >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                      {report.completion_rate}%
                    </p>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${report.completion_rate}%`,
                        background: report.completion_rate >= 70 ? 'var(--success)' : report.completion_rate >= 40 ? 'var(--warning)' : 'var(--danger)',
                      }} />
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    {report.total_completed} of {report.total_created} tasks completed
                  </p>
                </div>

                {/* Avg completion + busiest day */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Avg completion time
                    </p>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {report.avg_completion_hours < 24
                        ? `${report.avg_completion_hours}h`
                        : `${Math.round(report.avg_completion_hours / 24)}d`}
                    </p>
                  </div>
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Most active day
                    </p>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {report.busiest_day}
                    </p>
                  </div>
                </div>

                {/* Task type breakdown */}
                {Object.keys(report.by_type).length > 0 && (
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                      By task type
                    </p>
                    {Object.entries(report.by_type).map(([type, count]) => {
                      const pct = Math.round((count / report.total_created) * 100);
                      const colors: Record<string, string> = {
                        task: 'var(--text-secondary)',
                        follow_up: '#007AFF',
                        reminder: '#FF9500',
                        habit: '#34C759',
                      };
                      return (
                        <div key={type} className="mb-2">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                              {type.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: colors[type] || 'var(--accent)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Daily trend */}
                {report.daily_trend.length > 0 && (
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                      Daily trend
                    </p>
                    <div className="flex items-end gap-1 h-20">
                      {report.daily_trend.slice(-14).map((d, i) => {
                        const max = Math.max(...report.daily_trend.map(x => x.created + x.completed), 1);
                        return (
                          <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                            <div className="w-full rounded-sm"
                              style={{
                                height: `${Math.round((d.created / max) * 60)}px`,
                                background: 'var(--accent)',
                                opacity: 0.7,
                                minHeight: d.created > 0 ? '3px' : '0',
                              }} />
                            <div className="w-full rounded-sm"
                              style={{
                                height: `${Math.round((d.completed / max) * 60)}px`,
                                background: 'var(--success)',
                                opacity: 0.7,
                                minHeight: d.completed > 0 ? '3px' : '0',
                              }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--accent)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Created</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--success)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Completed</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVITY TAB ── */}
            {activeTab === 'activity' && (
              <div className="space-y-2">
                {events.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-3xl mb-3">📋</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      No activity in this period yet.
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Start creating and completing tasks to see your log here.
                    </p>
                  </div>
                ) : (
                  events.map(event => {
                    const icons: Record<string, string> = {
                      created: '✦',
                      completed: '✓',
                      reopened: '↩',
                      updated: '✎',
                      deleted: '✕',
                      snoozed: '⏸',
                      overdue_flagged: '⚠',
                      commented: '💬',
                    };
                    const colors: Record<string, string> = {
                      created: 'var(--accent)',
                      completed: 'var(--success)',
                      reopened: 'var(--warning)',
                      updated: 'var(--text-secondary)',
                      deleted: 'var(--danger)',
                      snoozed: 'var(--warning)',
                      overdue_flagged: 'var(--danger)',
                      commented: 'var(--text-secondary)',
                    };
                    return (
                      <div key={event.id} className="flex gap-3 px-1 py-2"
                        style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                          style={{
                            background: `${colors[event.event_type]}18`,
                            color: colors[event.event_type],
                          }}>
                          {icons[event.event_type] || '•'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            <span className="font-medium capitalize">
                              {event.event_type.replace('_', ' ')}
                            </span>
                            {event.new_value?.title && (
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {' '}— {event.new_value.title}
                              </span>
                            )}
                            {!event.new_value?.title && event.old_value?.title && (
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {' '}— {event.old_value.title}
                              </span>
                            )}
                          </p>
                          {event.note && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {event.note}
                            </p>
                          )}
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {format(new Date(event.created_at), 'MMM d, yyyy · h:mm a')}
                            {' · '}{event.source}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── INSIGHTS TAB ── */}
            {activeTab === 'insights' && (
              <div className="space-y-4">
                {/* Pattern cards */}
                {report.completion_rate < 50 && (
                  <div className="rounded-xl p-4"
                    style={{ background: '#FFF0EF', border: '1px solid rgba(255,59,48,0.15)' }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--danger)' }}>
                      ⚠ Backlog growing
                    </p>
                    <p className="text-sm" style={{ color: '#7A2020' }}>
                      You're completing only {report.completion_rate}% of tasks you create. Consider reducing how many tasks you add, or breaking them into smaller steps.
                    </p>
                  </div>
                )}

                {report.completion_rate >= 70 && (
                  <div className="rounded-xl p-4"
                    style={{ background: '#EEFBF2', border: '1px solid rgba(52,199,89,0.2)' }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--success)' }}>
                      ✓ Strong execution
                    </p>
                    <p className="text-sm" style={{ color: '#1A5C2A' }}>
                      {report.completion_rate}% completion rate — you're consistently following through. Keep this pace.
                    </p>
                  </div>
                )}

                {report.total_overdue > 3 && (
                  <div className="rounded-xl p-4"
                    style={{ background: '#FFF7ED', border: '1px solid rgba(255,149,0,0.2)' }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--warning)' }}>
                      → Overdue pattern detected
                    </p>
                    <p className="text-sm" style={{ color: '#7A4A00' }}>
                      {report.total_overdue} tasks went overdue this period. Try setting more realistic due dates or using the snooze feature when priorities shift.
                    </p>
                  </div>
                )}

                {report.busiest_day && (
                  <div className="rounded-xl p-4"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      📅 {report.busiest_day} is your most active day
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      You create and complete most tasks on {report.busiest_day}s. Consider front-loading important follow-ups earlier in the week.
                    </p>
                  </div>
                )}

                {report.by_type.follow_up > report.by_type.task && (
                  <div className="rounded-xl p-4"
                    style={{ background: '#E5F1FF', border: '1px solid rgba(0,122,255,0.15)' }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent)' }}>
                      🤝 Follow-up heavy week
                    </p>
                    <p className="text-sm" style={{ color: '#003A7A' }}>
                      Most of your tasks are follow-ups — you're in active BD mode. Make sure none go stale by checking the People view regularly.
                    </p>
                  </div>
                )}

                <div className="rounded-xl p-4"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Period summary
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Tasks created', value: report.total_created },
                      { label: 'Tasks completed', value: report.total_completed },
                      { label: 'Tasks went overdue', value: report.total_overdue },
                      { label: 'Avg time to complete', value: report.avg_completion_hours < 24 ? `${report.avg_completion_hours}h` : `${Math.round(report.avg_completion_hours / 24)}d` },
                      { label: 'Completion rate', value: `${report.completion_rate}%` },
                      { label: 'Most active day', value: report.busiest_day },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI predictions coming soon */}
                <div className="rounded-xl p-4"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    Coming next
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    AI-powered predictions — Pulse will analyse your patterns and tell you which tasks are likely to go overdue before they do.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
