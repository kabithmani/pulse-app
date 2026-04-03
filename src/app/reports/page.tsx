'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  format, subDays, differenceInHours, differenceInDays,
  startOfWeek, endOfWeek, isWithinInterval
} from 'date-fns';

type Period = '7d' | '15d' | '30d' | '90d' | '180d' | 'custom';
type Tab = 'briefing' | 'ea' | 'pivot' | 'log';
type XAxis = 'day' | 'week' | 'type' | 'priority' | 'dow';
type YAxis = 'created' | 'completed' | 'overdue' | 'rate' | 'avg_time' | 'delayed' | 'ontime';

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

interface EACard {
  kind: 'inference' | 'miss' | 'forecast' | 'recommendation';
  title: string;
  body: string;
  evidence?: string;
  action?: string;
  severity: 'positive' | 'warning' | 'danger' | 'neutral';
}

const PERIODS: { label: string; value: Period; days: number }[] = [
  { label: '7 days',   value: '7d',   days: 7   },
  { label: '15 days',  value: '15d',  days: 15  },
  { label: '30 days',  value: '30d',  days: 30  },
  { label: '3 months', value: '90d',  days: 90  },
  { label: '6 months', value: '180d', days: 180 },
  { label: 'Custom',   value: 'custom', days: 0 },
];

const X_OPTIONS: { label: string; value: XAxis }[] = [
  { label: 'Day',         value: 'day'      },
  { label: 'Week',        value: 'week'     },
  { label: 'Task type',   value: 'type'     },
  { label: 'Priority',    value: 'priority' },
  { label: 'Day of week', value: 'dow'      },
];

const Y_OPTIONS: { label: string; value: YAxis }[] = [
  { label: 'Created',      value: 'created'   },
  { label: 'Completed',    value: 'completed' },
  { label: 'Overdue',      value: 'overdue'   },
  { label: 'On-time %',    value: 'ontime'    },
  { label: 'Delayed %',    value: 'delayed'   },
  { label: 'Completion %', value: 'rate'      },
  { label: 'Avg time (h)', value: 'avg_time'  },
];

const severityStyle = {
  positive: { bg: '#EEFBF2', border: 'rgba(52,199,89,0.2)',   title: 'var(--success)', body: '#1A5C2A', icon: '✓' },
  warning:  { bg: '#FFF7ED', border: 'rgba(255,149,0,0.2)',   title: '#FF9500',        body: '#7A4A00', icon: '→' },
  danger:   { bg: '#FFF0EF', border: 'rgba(255,59,48,0.15)',  title: 'var(--danger)',  body: '#7A2020', icon: '⚠' },
  neutral:  { bg: 'var(--bg-secondary)', border: 'var(--border)', title: 'var(--text-primary)', body: 'var(--text-secondary)', icon: '•' },
};

const kindLabel: Record<EACard['kind'], string> = {
  inference:      'Inference',
  miss:           'Miss',
  forecast:       'Forecast',
  recommendation: 'Recommendation',
};

export default function EAIntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [period, setPeriod]             = useState<Period>('30d');
  const [customStart, setCustomStart]   = useState('');
  const [customEnd, setCustomEnd]       = useState('');
  const [events, setEvents]             = useState<TaskEvent[]>([]);
  const [allTasks, setAllTasks]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<Tab>('briefing');
  const [xAxis, setXAxis]               = useState<XAxis>('day');
  const [yAxis, setYAxis]               = useState<YAxis>('created');
  const [eaCards, setEaCards]           = useState<EACard[]>([]);
  const [eaLoading, setEaLoading]       = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, period, customStart, customEnd]);

  const getDateRange = () => {
    if (period === 'custom' && customStart && customEnd) {
      return { since: new Date(customStart).toISOString(), until: new Date(customEnd + 'T23:59:59').toISOString() };
    }
    const days = PERIODS.find(p => p.value === period)?.days || 30;
    return { since: subDays(new Date(), days).toISOString(), until: new Date().toISOString() };
  };

  const fetchData = async () => {
    setLoading(true);
    const { since, until } = getDateRange();

    const [eventsRes, tasksRes] = await Promise.all([
      supabase.from('task_events').select('*').eq('user_id', user!.id)
        .gte('created_at', since).lte('created_at', until)
        .order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('user_id', user!.id),
    ]);

    if (!eventsRes.error) setEvents(eventsRes.data || []);
    if (!tasksRes.error)  setAllTasks(tasksRes.data || []);
    setLoading(false);
  };

  // ── Deep stats ──
  const stats = useMemo(() => {
    const created   = events.filter(e => e.event_type === 'created');
    const completed = events.filter(e => e.event_type === 'completed');
    const deleted   = events.filter(e => e.event_type === 'deleted');
    const now       = new Date();

    // On-time vs delayed
    let onTime = 0, delayed = 0;
    completed.forEach(c => {
      const dueDate = c.old_value?.due_date || c.new_value?.due_date;
      if (!dueDate) return;
      if (new Date(c.created_at) <= new Date(dueDate)) onTime++;
      else delayed++;
    });

    const onTimeRate  = completed.length ? Math.round((onTime  / completed.length) * 100) : 0;
    const delayedRate = completed.length ? Math.round((delayed / completed.length) * 100) : 0;

    // Overdue = tasks currently past due that aren't completed
    const overdueNow = allTasks.filter(t =>
      t.status !== 'completed' && t.due_date && new Date(t.due_date) < now
    );

    // Task aging — how long open tasks have been open
    const openTasks = allTasks.filter(t => t.status !== 'completed');
    const agingDays = openTasks.map(t => differenceInDays(now, new Date(t.created_at)));
    const avgAgeDays = agingDays.length
      ? Math.round(agingDays.reduce((a, b) => a + b, 0) / agingDays.length) : 0;
    const longestOpen = openTasks.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];

    // Avg completion time
    const completionTimes = completed.map(c => {
      const ce = events.find(e => e.task_id === c.task_id && e.event_type === 'created');
      if (!ce) return null;
      const h = differenceInHours(new Date(c.created_at), new Date(ce.created_at));
      return h >= 0 ? h : null;
    }).filter((h): h is number => h !== null);
    const avgHours = completionTimes.length
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) : 0;

    // By type
    const byType: Record<string, { created: number; completed: number; delayed: number; ontime: number }> = {};
    created.forEach(e => {
      const t = e.new_value?.type || 'task';
      if (!byType[t]) byType[t] = { created: 0, completed: 0, delayed: 0, ontime: 0 };
      byType[t].created++;
    });
    completed.forEach(e => {
      const t = e.new_value?.type || e.old_value?.type || 'task';
      if (!byType[t]) byType[t] = { created: 0, completed: 0, delayed: 0, ontime: 0 };
      byType[t].completed++;
      const dueDate = e.old_value?.due_date || e.new_value?.due_date;
      if (dueDate) {
        if (new Date(e.created_at) <= new Date(dueDate)) byType[t].ontime++;
        else byType[t].delayed++;
      }
    });

    // By priority
    const byPriority: Record<string, { created: number; completed: number; delayed: number }> = {};
    created.forEach(e => {
      const p = e.new_value?.priority || 'medium';
      if (!byPriority[p]) byPriority[p] = { created: 0, completed: 0, delayed: 0 };
      byPriority[p].created++;
    });
    completed.forEach(e => {
      const p = e.new_value?.priority || e.old_value?.priority || 'medium';
      if (!byPriority[p]) byPriority[p] = { created: 0, completed: 0, delayed: 0 };
      byPriority[p].completed++;
      const dueDate = e.old_value?.due_date || e.new_value?.due_date;
      if (dueDate && new Date(e.created_at) > new Date(dueDate)) byPriority[p].delayed++;
    });

    // Bottleneck — which type has worst delayed rate
    const bottleneckType = Object.entries(byType)
      .filter(([, v]) => v.completed > 0)
      .map(([type, v]) => ({ type, delayRate: Math.round((v.delayed / v.completed) * 100) }))
      .sort((a, b) => b.delayRate - a.delayRate)[0];

    // Day of week patterns
    const dowMissed: Record<string, number> = {};
    const dowCreated: Record<string, number> = {};
    events.forEach(e => {
      const d = format(new Date(e.created_at), 'EEEE');
      if (e.event_type === 'created') dowCreated[d] = (dowCreated[d] || 0) + 1;
    });
    completed.forEach(c => {
      const dueDate = c.old_value?.due_date || c.new_value?.due_date;
      if (dueDate && new Date(c.created_at) > new Date(dueDate)) {
        const d = format(new Date(dueDate), 'EEEE');
        dowMissed[d] = (dowMissed[d] || 0) + 1;
      }
    });
    const worstDay = Object.entries(dowMissed).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const busiestDay = Object.entries(dowCreated).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Week over week trend
    const thisWeekEvents = events.filter(e => {
      const d = new Date(e.created_at);
      return d >= subDays(now, 7);
    });
    const lastWeekEvents = events.filter(e => {
      const d = new Date(e.created_at);
      return d >= subDays(now, 14) && d < subDays(now, 7);
    });
    const thisWeekRate = thisWeekEvents.filter(e => e.event_type === 'created').length > 0
      ? Math.round((thisWeekEvents.filter(e => e.event_type === 'completed').length /
          thisWeekEvents.filter(e => e.event_type === 'created').length) * 100) : 0;
    const lastWeekRate = lastWeekEvents.filter(e => e.event_type === 'created').length > 0
      ? Math.round((lastWeekEvents.filter(e => e.event_type === 'completed').length /
          lastWeekEvents.filter(e => e.event_type === 'created').length) * 100) : 0;
    const weekTrend = thisWeekRate - lastWeekRate;

    // Follow-up gaps — follow_up type tasks that went overdue
    const followUpMissed = allTasks.filter(t =>
      t.type === 'follow_up' && t.status !== 'completed' &&
      t.due_date && new Date(t.due_date) < now
    );

    const rate = created.length ? Math.round((completed.length / created.length) * 100) : 0;

    return {
      created: created.length,
      completed: completed.length,
      overdue: overdueNow.length,
      deleted: deleted.length,
      onTime, delayed, onTimeRate, delayedRate,
      rate, avgHours, avgAgeDays,
      busiestDay, worstDay, weekTrend,
      thisWeekRate, lastWeekRate,
      byType, byPriority,
      bottleneckType,
      longestOpen,
      openTaskCount: openTasks.length,
      followUpMissed: followUpMissed.length,
      followUpMissedTasks: followUpMissed.slice(0, 3),
      hasEnoughData: events.length >= 5,
    };
  }, [events, allTasks]);

  // ── Pivot data ──
  const pivotData = useMemo(() => {
    const rows: { label: string; value: number }[] = [];
    const days = PERIODS.find(p => p.value === period)?.days || 30;

    const getValue = (subset: TaskEvent[]): number => {
      const cr = subset.filter(e => e.event_type === 'created');
      const co = subset.filter(e => e.event_type === 'completed');
      const ov = subset.filter(e => e.event_type === 'overdue_flagged');
      let onT = 0, del = 0;
      co.forEach(c => {
        const d = c.old_value?.due_date || c.new_value?.due_date;
        if (!d) return;
        if (new Date(c.created_at) <= new Date(d)) onT++; else del++;
      });
      switch (yAxis) {
        case 'created':   return cr.length;
        case 'completed': return co.length;
        case 'overdue':   return ov.length;
        case 'rate':      return cr.length ? Math.round((co.length / cr.length) * 100) : 0;
        case 'ontime':    return co.length ? Math.round((onT / co.length) * 100) : 0;
        case 'delayed':   return co.length ? Math.round((del / co.length) * 100) : 0;
        case 'avg_time': {
          const times = co.map(c => {
            const ce = events.find(e => e.task_id === c.task_id && e.event_type === 'created');
            if (!ce) return null;
            const h = differenceInHours(new Date(c.created_at), new Date(ce.created_at));
            return h >= 0 ? h : null;
          }).filter((h): h is number => h !== null);
          return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        }
        default: return 0;
      }
    };

    if (xAxis === 'type') {
      ['task', 'follow_up', 'reminder', 'habit'].forEach(type => {
        rows.push({ label: type.replace('_', ' '), value: getValue(events.filter(e => (e.new_value?.type || e.old_value?.type) === type)) });
      });
    } else if (xAxis === 'priority') {
      ['urgent', 'high', 'medium', 'low'].forEach(p => {
        rows.push({ label: p, value: getValue(events.filter(e => (e.new_value?.priority || e.old_value?.priority) === p)) });
      });
    } else if (xAxis === 'dow') {
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(d => {
        rows.push({ label: d.slice(0, 3), value: getValue(events.filter(e => format(new Date(e.created_at), 'EEEE') === d)) });
      });
    } else if (xAxis === 'day') {
      for (let i = Math.min(days, 14) - 1; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const label = format(d, 'MMM d');
        rows.push({ label, value: getValue(events.filter(e => format(new Date(e.created_at), 'MMM d') === label)) });
      }
    } else if (xAxis === 'week') {
      const weeks = Math.min(Math.ceil(days / 7), 8);
      for (let i = weeks - 1; i >= 0; i--) {
        const start = subDays(new Date(), (i + 1) * 7);
        const end   = subDays(new Date(), i * 7);
        rows.push({ label: `W${format(start, 'MMM d')}`, value: getValue(events.filter(e => { const d = new Date(e.created_at); return d >= start && d <= end; })) });
      }
    }

    return rows;
  }, [events, xAxis, yAxis, period]);

  // ── EA generation ──
  const generateEA = async () => {
    setEaLoading(true);
    const periodLabel = period === 'custom' ? `${customStart} to ${customEnd}` : `Last ${PERIODS.find(p => p.value === period)?.days} days`;

    const prompt = `You are Pulse EA — a top-tier personal executive assistant and intelligence engine. Your job is to analyse the user's task data and generate 6-8 sharp, honest, actionable insights.

Period: ${periodLabel}
Tasks created: ${stats.created}
Tasks completed: ${stats.completed}
Currently overdue: ${stats.overdue}
Deleted: ${stats.deleted}
On-time completions: ${stats.onTime} (${stats.onTimeRate}%)
Delayed completions: ${stats.delayed} (${stats.delayedRate}%)
Completion rate: ${stats.rate}%
Avg completion time: ${stats.avgHours}h
Avg task age (open tasks): ${stats.avgAgeDays} days
Total open tasks: ${stats.openTaskCount}
Missed follow-ups: ${stats.followUpMissed}
Week-over-week rate change: ${stats.weekTrend > 0 ? '+' : ''}${stats.weekTrend}% (this week: ${stats.thisWeekRate}%, last week: ${stats.lastWeekRate}%)
Most missed day: ${stats.worstDay || 'not enough data'}
Busiest day: ${stats.busiestDay}
Bottleneck type: ${stats.bottleneckType ? `${stats.bottleneckType.type} (${stats.bottleneckType.delayRate}% delayed)` : 'none identified'}
Longest open task: ${stats.longestOpen ? `"${stats.longestOpen.title}" — open for ${differenceInDays(new Date(), new Date(stats.longestOpen.created_at))} days` : 'none'}
By task type: ${JSON.stringify(stats.byType)}
By priority: ${JSON.stringify(stats.byPriority)}

Return ONLY a JSON array. No markdown, no preamble, just raw JSON. Each object has:
- kind: "inference" | "miss" | "forecast" | "recommendation"
- title: punchy, max 8 words, no fluff
- body: 2-3 sentences. Direct. Speak as "you". Name specific tasks, numbers, days where relevant. Don't soften bad news.
- evidence: one line of raw numbers proving the point
- action: (only for recommendations) a short imperative action label
- severity: "positive" | "warning" | "danger" | "neutral"

Intelligence rules:
- INFERENCE: Explain a pattern you see in the data. What does it mean about how this person works?
- MISS: Call out a specific failure. Name it clearly. Don't soften.
- FORECAST: Predict what will happen next if nothing changes. Be specific. Use probability language.
- RECOMMENDATION: One specific action. Not vague. What exactly should they do today?
- If completion rate dropped week over week, that is a DANGER miss, not a neutral inference.
- If follow-ups are being missed, name it as a relationship risk.
- If a task has been open too long, name the task directly.
- Always include at least one forecast and one recommendation.
- If data is sparse, say so honestly but still extract what you can.
- Never generate fluff. Every card must earn its place.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || '[]';
      const clean = text.replace(/```json|```/g, '').trim();
      setEaCards(JSON.parse(clean));
    } catch {
      setEaCards(generateFallbackCards());
    }
    setEaLoading(false);
  };

  const generateFallbackCards = (): EACard[] => {
    const cards: EACard[] = [];

    if (stats.weekTrend < -15) cards.push({ kind: 'miss', title: 'Completion rate falling sharply', body: `Your completion rate dropped ${Math.abs(stats.weekTrend)}% this week vs last week. This is not a blip — it is a trend that will compound if unchecked.`, evidence: `This week: ${stats.thisWeekRate}%, Last week: ${stats.lastWeekRate}%`, severity: 'danger' });
    if (stats.rate >= 70) cards.push({ kind: 'inference', title: 'Strong execution this period', body: `${stats.rate}% completion rate. You are following through on what you create. Maintain this pace.`, evidence: `${stats.completed} completed of ${stats.created} created`, severity: 'positive' });
    else if (stats.rate < 40) cards.push({ kind: 'miss', title: 'Backlog growing faster than you close it', body: `Only ${stats.rate}% completion. You are creating tasks faster than finishing them. Stop adding until you clear the backlog.`, evidence: `${stats.created} created, ${stats.completed} completed, ${stats.openTaskCount} still open`, severity: 'danger' });

    if (stats.delayedRate > 30) cards.push({ kind: 'miss', title: `${stats.delayedRate}% of completions were late`, body: `You finished ${stats.delayed} tasks after their due date. Your due date estimates are consistently optimistic.`, evidence: `${stats.onTime} on-time, ${stats.delayed} delayed out of ${stats.completed} completed`, severity: 'warning' });
    if (stats.followUpMissed > 0) cards.push({ kind: 'miss', title: `${stats.followUpMissed} follow-ups missed`, body: `You have ${stats.followUpMissed} overdue follow-ups. These are relationship risks — each one is a person waiting to hear from you.`, evidence: `${stats.followUpMissed} follow_up tasks past due date`, severity: 'danger' });
    if (stats.overdue > 0) cards.push({ kind: 'forecast', title: 'Overdue count will grow if unchecked', body: `You currently have ${stats.overdue} overdue tasks. Without action today, these will age further and become harder to close.`, evidence: `${stats.overdue} tasks past due date right now`, severity: 'warning' });
    if (stats.longestOpen) cards.push({ kind: 'recommendation', title: `Close or delete "${stats.longestOpen.title}"`, body: `This task has been open for ${differenceInDays(new Date(), new Date(stats.longestOpen.created_at))} days. Either close it or delete it — an old open task is noise, not signal.`, evidence: `Created ${format(new Date(stats.longestOpen.created_at), 'MMM d')} — ${differenceInDays(new Date(), new Date(stats.longestOpen.created_at))} days ago`, action: 'Review oldest task', severity: 'warning' });

    return cards;
  };

  useEffect(() => {
    if (!loading && tab === 'ea') {
      if (stats.hasEnoughData) generateEA();
      else setEaCards(generateFallbackCards());
    }
  }, [loading, tab, period, customStart, customEnd]);

  const exportData = (fmt: 'csv' | 'json' | 'pdf') => {
    const filename = `pulse-intelligence-${period}-${format(new Date(), 'yyyy-MM-dd')}`;
    if (fmt === 'json') {
      const payload = { period, stats, events, generatedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.json'; a.click();
    } else {
      const headers = ['date', 'event_type', 'task_title', 'source', 'old_value', 'new_value'];
      const rows = events.map(e => [
        format(new Date(e.created_at), 'yyyy-MM-dd HH:mm'),
        e.event_type,
        e.new_value?.title || e.old_value?.title || '',
        e.source,
        JSON.stringify(e.old_value || ''),
        JSON.stringify(e.new_value || ''),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.csv'; a.click();
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-3" style={{ background: 'var(--accent)' }}>P</div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const maxPivot = Math.max(...pivotData.map(r => r.value), 1);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-sm" style={{ color: 'var(--accent)' }}>← Back</button>
            <div>
              <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>EA Intelligence</h1>
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Risk · Patterns · Forecasts · Recommendations</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => exportData('csv')} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>↓ CSV</button>
            <button onClick={() => exportData('json')} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>↓ JSON</button>
          </div>
        </div>

        {/* Period selector */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-1.5 overflow-x-auto">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className="text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap"
              style={{ background: period === p.value ? 'var(--accent)' : 'var(--bg-secondary)', color: period === p.value ? '#fff' : 'var(--text-secondary)', border: period === p.value ? 'none' : '1px solid var(--border)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg outline-none"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
            <span className="text-xs self-center" style={{ color: 'var(--text-tertiary)' }}>to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg outline-none"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
          </div>
        )}

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex" style={{ borderTop: '1px solid var(--border)' }}>
          {([
            { value: 'briefing', label: '📋 Daily Brief' },
            { value: 'ea',       label: '🧠 EA Inferences' },
            { value: 'pivot',    label: '⊞ Pivot' },
            { value: 'log',      label: '📜 Log' },
          ] as { value: Tab; label: string }[]).map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className="px-3 py-2.5 text-xs font-medium whitespace-nowrap"
              style={{ color: tab === t.value ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: tab === t.value ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>
        ) : (
          <>

            {/* ══════════════════════════════════════════════
                DAILY BRIEFING TAB
            ══════════════════════════════════════════════ */}
            {tab === 'briefing' && (
              <div className="space-y-4">

                {/* Execution snapshot */}
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>Execution snapshot</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Created',        value: stats.created,        color: 'var(--accent)'   },
                      { label: 'Completed',       value: stats.completed,      color: 'var(--success)'  },
                      { label: 'Currently overdue', value: stats.overdue,       color: 'var(--danger)'   },
                      { label: 'Open tasks',      value: stats.openTaskCount,  color: 'var(--warning)'  },
                      { label: 'On time',         value: `${stats.onTimeRate}%`,  color: 'var(--success)' },
                      { label: 'Delayed',         value: `${stats.delayedRate}%`, color: stats.delayedRate > 30 ? 'var(--danger)' : 'var(--warning)' },
                      { label: 'Missed follow-ups', value: stats.followUpMissed, color: stats.followUpMissed > 0 ? 'var(--danger)' : 'var(--success)' },
                      { label: 'Avg task age',    value: `${stats.avgAgeDays}d`, color: stats.avgAgeDays > 7 ? 'var(--warning)' : 'var(--text-primary)' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Completion rate bar */}
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Completion rate</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold" style={{ color: stats.rate >= 70 ? 'var(--success)' : stats.rate >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{stats.rate}%</p>
                      {stats.weekTrend !== 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: stats.weekTrend > 0 ? '#EEFBF2' : '#FFF0EF', color: stats.weekTrend > 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {stats.weekTrend > 0 ? '↑' : '↓'} {Math.abs(stats.weekTrend)}% vs last week
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full" style={{ width: `${stats.rate}%`, background: stats.rate >= 70 ? 'var(--success)' : stats.rate >= 40 ? 'var(--warning)' : 'var(--danger)', transition: 'width 0.5s ease' }} />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{stats.onTime} on-time · {stats.delayed} delayed</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Avg {stats.avgHours < 24 ? `${stats.avgHours}h` : `${Math.round(stats.avgHours / 24)}d`} to complete</span>
                  </div>
                </div>

                {/* Bottleneck */}
                {stats.bottleneckType && stats.bottleneckType.delayRate > 20 && (
                  <div className="rounded-xl p-4" style={{ background: '#FFF7ED', border: '1px solid rgba(255,149,0,0.2)' }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#FF9500' }}>Bottleneck detected</p>
                    <p className="text-sm font-semibold" style={{ color: '#7A4A00' }}>
                      {stats.bottleneckType.type.replace('_', ' ')} tasks — {stats.bottleneckType.delayRate}% delayed
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#7A4A00' }}>
                      This task type is your biggest execution gap. Focus here first.
                    </p>
                  </div>
                )}

                {/* Missed follow-ups */}
                {stats.followUpMissedTasks.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: '#FFF0EF', border: '1px solid rgba(255,59,48,0.15)' }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--danger)' }}>⚠ Overdue follow-ups — relationship risk</p>
                    {stats.followUpMissedTasks.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,59,48,0.1)' }}>
                        <p className="text-xs font-medium" style={{ color: '#7A2020' }}>{t.title}</p>
                        <span className="text-[10px]" style={{ color: 'var(--danger)' }}>
                          {differenceInDays(new Date(), new Date(t.due_date))}d overdue
                        </span>
                      </div>
                    ))}
                    {stats.followUpMissed > 3 && (
                      <p className="text-[11px] mt-2" style={{ color: 'var(--danger)' }}>+{stats.followUpMissed - 3} more overdue follow-ups</p>
                    )}
                  </div>
                )}

                {/* Longest open task */}
                {stats.longestOpen && (
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Longest open task</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>"{stats.longestOpen.title}"</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--warning)' }}>
                      Open for {differenceInDays(new Date(), new Date(stats.longestOpen.created_at))} days — created {format(new Date(stats.longestOpen.created_at), 'MMM d')}
                    </p>
                  </div>
                )}

                {/* Day of week patterns */}
                {(stats.worstDay || stats.busiestDay !== '—') && (
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>Behavioural patterns</p>
                    {stats.busiestDay !== '—' && (
                      <div className="flex justify-between py-1">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Most active day</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{stats.busiestDay}</span>
                      </div>
                    )}
                    {stats.worstDay && (
                      <div className="flex justify-between py-1">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Most misses on</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{stats.worstDay}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Avg completion time</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{stats.avgHours < 24 ? `${stats.avgHours}h` : `${Math.round(stats.avgHours / 24)}d`}</span>
                    </div>
                  </div>
                )}

                {/* By type breakdown */}
                {Object.keys(stats.byType).length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-2.5" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>By task type</p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Type', 'Created', 'Done', 'On-time', 'Delayed'].map(h => (
                            <th key={h} className="px-3 py-2 text-right first:text-left font-semibold" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.byType).map(([type, v], i, arr) => (
                          <tr key={type} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td className="px-3 py-2.5 capitalize font-medium" style={{ color: 'var(--text-primary)' }}>{type.replace('_', ' ')}</td>
                            <td className="px-3 py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{v.created}</td>
                            <td className="px-3 py-2.5 text-right" style={{ color: 'var(--success)' }}>{v.completed}</td>
                            <td className="px-3 py-2.5 text-right" style={{ color: 'var(--success)' }}>{v.ontime}</td>
                            <td className="px-3 py-2.5 text-right" style={{ color: v.delayed > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{v.delayed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════
                EA INFERENCES TAB
            ══════════════════════════════════════════════ */}
            {tab === 'ea' && (
              <div className="space-y-3">
                {/* Quick stats row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Created',   value: stats.created,          color: 'var(--accent)'  },
                    { label: 'Completed', value: stats.completed,         color: 'var(--success)' },
                    { label: 'Overdue',   value: stats.overdue,           color: 'var(--danger)'  },
                    { label: 'Rate',      value: `${stats.rate}%`,        color: stats.rate >= 70 ? 'var(--success)' : stats.rate >= 40 ? 'var(--warning)' : 'var(--danger)' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {eaLoading ? (
                  <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>EA is analysing your patterns...</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Reading {events.length} events across {PERIODS.find(p => p.value === period)?.label || period}</p>
                  </div>
                ) : eaCards.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <p className="text-3xl mb-3">🧠</p>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>EA is watching</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Keep using Pulse. Your EA will generate inferences, call out misses, and forecast what's coming.</p>
                  </div>
                ) : eaCards.map((card, i) => {
                  const style = severityStyle[card.severity];
                  const isExpanded = expandedEvidence === i;
                  return (
                    <div key={i} className="rounded-xl overflow-hidden" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.06)', color: style.title }}>
                            {kindLabel[card.kind]}
                          </span>
                        </div>
                        <p className="text-sm font-semibold mb-1.5" style={{ color: style.title }}>{style.icon} {card.title}</p>
                        <p className="text-sm leading-relaxed" style={{ color: style.body }}>{card.body}</p>
                        {card.action && (
                          <button className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: style.title, color: '#fff' }}>
                            {card.action}
                          </button>
                        )}
                        {card.evidence && (
                          <button onClick={() => setExpandedEvidence(isExpanded ? null : i)}
                            className="mt-2 text-[11px] font-medium flex items-center gap-1"
                            style={{ color: style.title, opacity: 0.7 }}>
                            {isExpanded ? '▾' : '▸'} See evidence
                          </button>
                        )}
                      </div>
                      {isExpanded && card.evidence && (
                        <div className="px-4 py-3 mx-4 mb-4 rounded-lg text-xs font-mono" style={{ background: 'rgba(0,0,0,0.05)', color: style.body }}>
                          {card.evidence}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!eaLoading && eaCards.length > 0 && (
                  <button onClick={generateEA} className="w-full py-2.5 rounded-xl text-xs font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    ↻ Refresh EA analysis
                  </button>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════
                PIVOT TAB
            ══════════════════════════════════════════════ */}
            {tab === 'pivot' && (
              <div className="space-y-4">
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div>
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>X Axis — slice by</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {X_OPTIONS.map(o => (
                        <button key={o.value} onClick={() => setXAxis(o.value)}
                          className="text-xs px-3 py-1.5 rounded-full font-medium"
                          style={{ background: xAxis === o.value ? 'var(--text-primary)' : 'var(--bg)', color: xAxis === o.value ? 'var(--bg)' : 'var(--text-secondary)', border: `1px solid ${xAxis === o.value ? 'transparent' : 'var(--border)'}` }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Y Axis — measure</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {Y_OPTIONS.map(o => (
                        <button key={o.value} onClick={() => setYAxis(o.value)}
                          className="text-xs px-3 py-1.5 rounded-full font-medium"
                          style={{ background: yAxis === o.value ? 'var(--accent)' : 'var(--bg)', color: yAxis === o.value ? '#fff' : 'var(--text-secondary)', border: `1px solid ${yAxis === o.value ? 'transparent' : 'var(--border)'}` }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                    {Y_OPTIONS.find(o => o.value === yAxis)?.label} by {X_OPTIONS.find(o => o.value === xAxis)?.label}
                  </p>
                  <div className="flex items-end gap-1.5 h-28 overflow-x-auto pb-1">
                    {pivotData.map((row, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 min-w-[32px]">
                        <p className="text-[9px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{row.value}</p>
                        <div className="w-full rounded-sm" style={{ height: `${Math.round((row.value / maxPivot) * 80)}px`, background: 'var(--accent)', opacity: 0.8, minHeight: row.value > 0 ? '4px' : '0' }} />
                        <p className="text-[9px]" style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{row.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>{X_OPTIONS.find(o => o.value === xAxis)?.label}</th>
                        <th className="text-right px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>{Y_OPTIONS.find(o => o.value === yAxis)?.label}</th>
                        <th className="text-right px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pivotData.map((row, i) => {
                        const total = pivotData.reduce((s, r) => s + r.value, 0);
                        const pct = total ? Math.round((row.value / total) * 100) : 0;
                        return (
                          <tr key={i} style={{ borderBottom: i < pivotData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td className="px-4 py-2.5 capitalize" style={{ color: 'var(--text-primary)' }}>{row.label}</td>
                            <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--accent)' }}>{row.value}</td>
                            <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-tertiary)' }}>{pct}%</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: 'var(--bg-secondary)' }}>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>Total</td>
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--text-primary)' }}>{pivotData.reduce((s, r) => s + r.value, 0)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--text-secondary)' }}>100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                ACTIVITY LOG TAB
            ══════════════════════════════════════════════ */}
            {tab === 'log' && (
              <div>
                {events.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-3xl mb-3">📋</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No activity yet.</p>
                  </div>
                ) : events.map(event => {
                  const icons: Record<string, string> = { created: '✦', completed: '✓', reopened: '↩', updated: '✎', deleted: '✕', snoozed: '⏸', overdue_flagged: '⚠', commented: '💬' };
                  const cols: Record<string, string> = { created: 'var(--accent)', completed: 'var(--success)', reopened: 'var(--warning)', updated: 'var(--text-secondary)', deleted: 'var(--danger)', snoozed: 'var(--warning)', overdue_flagged: 'var(--danger)', commented: 'var(--text-secondary)' };
                  const c = cols[event.event_type] || 'var(--text-secondary)';
                  return (
                    <div key={event.id} className="flex gap-3 px-1 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5" style={{ background: `${c}18`, color: c }}>
                        {icons[event.event_type] || '•'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          <span className="font-medium capitalize">{event.event_type.replace('_', ' ')}</span>
                          {(event.new_value?.title || event.old_value?.title) && (
                            <span style={{ color: 'var(--text-secondary)' }}> — {event.new_value?.title || event.old_value?.title}</span>
                          )}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {format(new Date(event.created_at), 'MMM d, yyyy · h:mm a')} · {event.source}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </>
        )}
      </main>
    </div>
  );
}
