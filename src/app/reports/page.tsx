'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, subDays, differenceInHours, differenceInDays } from 'date-fns';

type Period = '7d' | '30d' | '90d' | '180d';
type Tab = 'ea' | 'pivot' | 'log';
type XAxis = 'day' | 'week' | 'type' | 'priority' | 'dow';
type YAxis = 'created' | 'completed' | 'overdue' | 'rate' | 'avg_time';

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
  { label: '7 days', value: '7d', days: 7 },
  { label: '30 days', value: '30d', days: 30 },
  { label: '3 months', value: '90d', days: 90 },
  { label: '6 months', value: '180d', days: 180 },
];

const X_OPTIONS: { label: string; value: XAxis }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Task type', value: 'type' },
  { label: 'Priority', value: 'priority' },
  { label: 'Day of week', value: 'dow' },
];

const Y_OPTIONS: { label: string; value: YAxis }[] = [
  { label: 'Created', value: 'created' },
  { label: 'Completed', value: 'completed' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Completion %', value: 'rate' },
  { label: 'Avg time (h)', value: 'avg_time' },
];

const severityStyle = {
  positive: { bg: '#EEFBF2', border: 'rgba(52,199,89,0.2)', title: 'var(--success)', body: '#1A5C2A', icon: '✓' },
  warning:  { bg: '#FFF7ED', border: 'rgba(255,149,0,0.2)',  title: '#FF9500',        body: '#7A4A00', icon: '→' },
  danger:   { bg: '#FFF0EF', border: 'rgba(255,59,48,0.15)', title: 'var(--danger)',  body: '#7A2020', icon: '⚠' },
  neutral:  { bg: 'var(--bg-secondary)', border: 'var(--border)', title: 'var(--text-primary)', body: 'var(--text-secondary)', icon: '•' },
};

const kindLabel: Record<EACard['kind'], string> = {
  inference: 'Inference',
  miss: 'Miss',
  forecast: 'Forecast',
  recommendation: 'Recommendation',
};

export default function EAIntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('30d');
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('ea');
  const [xAxis, setXAxis] = useState<XAxis>('day');
  const [yAxis, setYAxis] = useState<YAxis>('created');
  const [eaCards, setEaCards] = useState<EACard[]>([]);
  const [eaLoading, setEaLoading] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<number | null>(null);

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

  // ── Core stats ──
  const stats = useMemo(() => {
    const created   = events.filter(e => e.event_type === 'created');
    const completed = events.filter(e => e.event_type === 'completed');
    const deleted   = events.filter(e => e.event_type === 'deleted');
    const overdue   = events.filter(e =>
      e.event_type === 'overdue_flagged' ||
      (e.event_type === 'completed' && e.old_value?.due_date &&
        new Date(e.created_at) > new Date(e.old_value.due_date))
    );

    const completionTimes = completed.map(c => {
      const ce = events.find(e => e.task_id === c.task_id && e.event_type === 'created');
      if (!ce) return null;
      const h = differenceInHours(new Date(c.created_at), new Date(ce.created_at));
      return h >= 0 ? h : null;
    }).filter((h): h is number => h !== null);

    const avgHours = completionTimes.length
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      : 0;

    const byType: Record<string, { created: number; completed: number; overdue: number }> = {};
    created.forEach(e => {
      const t = e.new_value?.type || 'task';
      if (!byType[t]) byType[t] = { created: 0, completed: 0, overdue: 0 };
      byType[t].created++;
    });
    completed.forEach(e => {
      const t = e.new_value?.type || e.old_value?.type || 'task';
      if (!byType[t]) byType[t] = { created: 0, completed: 0, overdue: 0 };
      byType[t].completed++;
    });

    const byPriority: Record<string, { created: number; completed: number }> = {};
    created.forEach(e => {
      const p = e.new_value?.priority || 'medium';
      if (!byPriority[p]) byPriority[p] = { created: 0, completed: 0 };
      byPriority[p].created++;
    });
    completed.forEach(e => {
      const p = e.new_value?.priority || e.old_value?.priority || 'medium';
      if (!byPriority[p]) byPriority[p] = { created: 0, completed: 0 };
      byPriority[p].completed++;
    });

    const dayCount: Record<string, number> = {};
    events.forEach(e => {
      const d = format(new Date(e.created_at), 'EEEE');
      dayCount[d] = (dayCount[d] || 0) + 1;
    });
    const busiestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const rate = created.length ? Math.round((completed.length / created.length) * 100) : 0;

    return {
      created: created.length,
      completed: completed.length,
      overdue: overdue.length,
      deleted: deleted.length,
      rate,
      avgHours,
      busiestDay,
      byType,
      byPriority,
      hasEnoughData: events.length >= 5,
    };
  }, [events]);

  // ── Pivot table data ──
  const pivotData = useMemo(() => {
    const rows: { label: string; value: number }[] = [];
    const days = PERIODS.find(p => p.value === period)?.days || 30;

    const getValue = (subset: TaskEvent[], label: string): number => {
      const created   = subset.filter(e => e.event_type === 'created');
      const completed = subset.filter(e => e.event_type === 'completed');
      const overdue   = subset.filter(e => e.event_type === 'overdue_flagged');
      switch (yAxis) {
        case 'created':   return created.length;
        case 'completed': return completed.length;
        case 'overdue':   return overdue.length;
        case 'rate':      return created.length ? Math.round((completed.length / created.length) * 100) : 0;
        case 'avg_time': {
          const times = completed.map(c => {
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
        const subset = events.filter(e => (e.new_value?.type || e.old_value?.type) === type);
        rows.push({ label: type.replace('_', ' '), value: getValue(subset, type) });
      });
    } else if (xAxis === 'priority') {
      ['urgent', 'high', 'medium', 'low'].forEach(p => {
        const subset = events.filter(e => (e.new_value?.priority || e.old_value?.priority) === p);
        rows.push({ label: p, value: getValue(subset, p) });
      });
    } else if (xAxis === 'dow') {
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(d => {
        const subset = events.filter(e => format(new Date(e.created_at), 'EEEE') === d);
        rows.push({ label: d.slice(0, 3), value: getValue(subset, d) });
      });
    } else if (xAxis === 'day') {
      for (let i = Math.min(days, 14) - 1; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const label = format(d, 'MMM d');
        const subset = events.filter(e => format(new Date(e.created_at), 'MMM d') === label);
        rows.push({ label, value: getValue(subset, label) });
      }
    } else if (xAxis === 'week') {
      const weeks = Math.ceil(days / 7);
      for (let i = weeks - 1; i >= 0; i--) {
        const start = subDays(new Date(), (i + 1) * 7);
        const end   = subDays(new Date(), i * 7);
        const label = `W${format(start, 'MMM d')}`;
        const subset = events.filter(e => {
          const d = new Date(e.created_at);
          return d >= start && d <= end;
        });
        rows.push({ label, value: getValue(subset, label) });
      }
    }

    return rows;
  }, [events, xAxis, yAxis, period]);

  // ── Generate EA cards via Claude API ──
  const generateEA = async () => {
    if (!stats.hasEnoughData) return;
    setEaLoading(true);

    const prompt = `You are Pulse EA, a personal executive assistant. Analyse this user's task data and generate 4-6 insights.

Period: Last ${PERIODS.find(p => p.value === period)?.days} days
Tasks created: ${stats.created}
Tasks completed: ${stats.completed}
Tasks overdue: ${stats.overdue}
Tasks deleted: ${stats.deleted}
Completion rate: ${stats.rate}%
Avg completion time: ${stats.avgHours}h
Most active day: ${stats.busiestDay}
By type: ${JSON.stringify(stats.byType)}
By priority: ${JSON.stringify(stats.byPriority)}

Return ONLY a JSON array. No markdown, no explanation, just the array. Each item has:
- kind: "inference" | "miss" | "forecast" | "recommendation"
- title: short punchy title (max 8 words)
- body: plain English explanation (2-3 sentences, speak directly to user as "you")
- evidence: one line of raw numbers that proves this (e.g. "12 created, 4 completed = 33% rate")
- action: optional short action label if recommendation (e.g. "Create follow-ups for stale contacts")
- severity: "positive" | "warning" | "danger" | "neutral"

Rules:
- Be honest and direct. Don't sugarcoat.
- If data is sparse, say so in the inference.
- Inferences explain patterns. Misses call out specific failures. Forecasts predict what will happen. Recommendations suggest one specific action.
- Never invent data that isn't there.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || '[]';
      const clean = text.replace(/```json|```/g, '').trim();
      const cards = JSON.parse(clean);
      setEaCards(cards);
    } catch (e) {
      setEaCards(generateFallbackCards());
    }
    setEaLoading(false);
  };

  const generateFallbackCards = (): EACard[] => {
    const cards: EACard[] = [];
    if (stats.rate >= 70) {
      cards.push({ kind: 'inference', title: 'Strong execution this period', body: `You completed ${stats.rate}% of what you created. That's above average — you're following through.`, evidence: `${stats.completed} completed of ${stats.created} created`, severity: 'positive' });
    } else if (stats.rate < 40) {
      cards.push({ kind: 'miss', title: 'Backlog is growing faster than you close it', body: `Only ${stats.rate}% completion rate. You're creating tasks faster than you finish them. Either reduce input or increase execution pace.`, evidence: `${stats.created} created, ${stats.completed} completed, ${stats.created - stats.completed} still open`, severity: 'danger' });
    }
    if (stats.overdue > 0) {
      cards.push({ kind: 'miss', title: `${stats.overdue} tasks went overdue`, body: 'Tasks are slipping past their due dates. This is either a planning problem or a prioritisation problem.', evidence: `${stats.overdue} overdue events logged`, severity: 'warning' });
    }
    if (stats.busiestDay !== '—') {
      cards.push({ kind: 'inference', title: `${stats.busiestDay} is your most active day`, body: `Most of your task activity happens on ${stats.busiestDay}s. Consider front-loading critical follow-ups to earlier in the week.`, evidence: `Activity log grouped by day of week`, severity: 'neutral' });
    }
    cards.push({ kind: 'forecast', title: 'EA needs more data to forecast accurately', body: 'Keep using Pulse for 7+ days and your EA will start predicting which tasks are likely to go overdue before they do.', evidence: `${events.length} events logged so far`, severity: 'neutral' });
    return cards;
  };

  useEffect(() => {
    if (!loading && stats.hasEnoughData && tab === 'ea') generateEA();
    if (!loading && !stats.hasEnoughData && tab === 'ea') setEaCards(generateFallbackCards());
  }, [loading, tab, period]);

  const exportData = (fmt: 'csv' | 'json') => {
    const filename = `pulse-${period}-${format(new Date(), 'yyyy-MM-dd')}`;
    if (fmt === 'json') {
      const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.json'; a.click();
    } else {
      const headers = ['id', 'task_id', 'event_type', 'source', 'created_at', 'note'];
      const rows = events.map(e => headers.map(h => JSON.stringify((e as any)[h] ?? '')).join(','));
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
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Inferences · Misses · Forecasts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportData('csv')} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>↓ CSV</button>
            <button onClick={() => exportData('json')} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>↓ JSON</button>
          </div>
        </div>

        {/* Period */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className="text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap"
              style={{ background: period === p.value ? 'var(--accent)' : 'var(--bg-secondary)', color: period === p.value ? '#fff' : 'var(--text-secondary)', border: period === p.value ? 'none' : '1px solid var(--border)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex" style={{ borderTop: '1px solid var(--border)' }}>
          {([
            { value: 'ea', label: 'EA Inferences' },
            { value: 'pivot', label: 'Pivot' },
            { value: 'log', label: 'Activity Log' },
          ] as { value: Tab; label: string }[]).map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className="px-4 py-2.5 text-xs font-medium whitespace-nowrap"
              style={{ color: tab === t.value ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: tab === t.value ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
          </div>
        ) : (
          <>

            {/* ── EA INFERENCES TAB ── */}
            {tab === 'ea' && (
              <div className="space-y-3">

                {/* Snapshot bar */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Created', value: stats.created, color: 'var(--accent)' },
                    { label: 'Completed', value: stats.completed, color: 'var(--success)' },
                    { label: 'Overdue', value: stats.overdue, color: 'var(--danger)' },
                    { label: `${stats.rate}%`, value: null, color: stats.rate >= 70 ? 'var(--success)' : stats.rate >= 40 ? 'var(--warning)' : 'var(--danger)', label2: 'Rate' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl p-3 text-center"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <p className="text-lg font-bold" style={{ color: s.color }}>
                        {s.value !== null ? s.value : s.label}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {s.value !== null ? s.label : (s as any).label2}
                      </p>
                    </div>
                  ))}
                </div>

                {eaLoading ? (
                  <div className="space-y-3">
                    <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your EA is analysing your patterns...</p>
                    </div>
                  </div>
                ) : eaCards.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <p className="text-3xl mb-3">🧠</p>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>EA is watching</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Create and complete tasks for a few days. Your EA will start generating inferences, calling out misses, and forecasting what's coming.
                    </p>
                  </div>
                ) : (
                  eaCards.map((card, i) => {
                    const style = severityStyle[card.severity];
                    const isExpanded = expandedEvidence === i;
                    return (
                      <div key={i} className="rounded-xl overflow-hidden"
                        style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                        <div className="p-4">
                          {/* Kind label */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.06)', color: style.title }}>
                              {kindLabel[card.kind]}
                            </span>
                          </div>
                          {/* Title */}
                          <p className="text-sm font-semibold mb-1.5" style={{ color: style.title }}>
                            {style.icon} {card.title}
                          </p>
                          {/* Body */}
                          <p className="text-sm leading-relaxed" style={{ color: style.body }}>
                            {card.body}
                          </p>
                          {/* Action button */}
                          {card.action && (
                            <button className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg"
                              style={{ background: style.title, color: '#fff' }}>
                              {card.action}
                            </button>
                          )}
                          {/* Evidence toggle */}
                          {card.evidence && (
                            <button
                              onClick={() => setExpandedEvidence(isExpanded ? null : i)}
                              className="mt-2 text-[11px] font-medium flex items-center gap-1"
                              style={{ color: style.title, opacity: 0.7 }}>
                              {isExpanded ? '▾' : '▸'} See evidence
                            </button>
                          )}
                        </div>
                        {/* Evidence panel */}
                        {isExpanded && card.evidence && (
                          <div className="px-4 py-3 mx-4 mb-4 rounded-lg text-xs font-mono"
                            style={{ background: 'rgba(0,0,0,0.05)', color: style.body }}>
                            {card.evidence}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Refresh */}
                {!eaLoading && eaCards.length > 0 && (
                  <button onClick={generateEA}
                    className="w-full py-2.5 rounded-xl text-xs font-medium mt-2"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    ↻ Refresh EA analysis
                  </button>
                )}
              </div>
            )}

            {/* ── PIVOT TAB ── */}
            {tab === 'pivot' && (
              <div className="space-y-4">

                {/* Axis pickers */}
                <div className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
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

                {/* Bar chart */}
                <div className="rounded-xl p-4"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                    {Y_OPTIONS.find(o => o.value === yAxis)?.label} by {X_OPTIONS.find(o => o.value === xAxis)?.label}
                  </p>
                  <div className="flex items-end gap-1.5 h-28 overflow-x-auto pb-1">
                    {pivotData.map((row, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 min-w-[32px]">
                        <p className="text-[9px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{row.value}</p>
                        <div className="w-full rounded-sm"
                          style={{
                            height: `${Math.round((row.value / maxPivot) * 80)}px`,
                            background: 'var(--accent)',
                            opacity: 0.8,
                            minHeight: row.value > 0 ? '4px' : '0',
                          }} />
                        <p className="text-[9px]" style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{row.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pivot table */}
                <div className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--border)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {X_OPTIONS.find(o => o.value === xAxis)?.label}
                        </th>
                        <th className="text-right px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {Y_OPTIONS.find(o => o.value === yAxis)?.label}
                        </th>
                        <th className="text-right px-4 py-2.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          Share
                        </th>
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
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: 'var(--text-primary)' }}>
                          {pivotData.reduce((s, r) => s + r.value, 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--text-secondary)' }}>100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── ACTIVITY LOG TAB ── */}
            {tab === 'log' && (
              <div className="space-y-0">
                {events.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-3xl mb-3">📋</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No activity yet.</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Create and complete tasks to see the log.</p>
                  </div>
                ) : events.map(event => {
                  const icons: Record<string, string> = { created: '✦', completed: '✓', reopened: '↩', updated: '✎', deleted: '✕', snoozed: '⏸', overdue_flagged: '⚠', commented: '💬' };
                  const cols: Record<string, string> = { created: 'var(--accent)', completed: 'var(--success)', reopened: 'var(--warning)', updated: 'var(--text-secondary)', deleted: 'var(--danger)', snoozed: 'var(--warning)', overdue_flagged: 'var(--danger)', commented: 'var(--text-secondary)' };
                  const c = cols[event.event_type] || 'var(--text-secondary)';
                  return (
                    <div key={event.id} className="flex gap-3 px-1 py-2.5"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ background: `${c}18`, color: c }}>
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
