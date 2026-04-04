'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, subDays, parseISO, differenceInHours, getDay, getHours } from 'date-fns';

interface Task {
  id: string; title: string; type: string; priority: string;
  status: string; due_date: string | null; created_at: string; completed_at?: string | null;
}

type Period = '7d' | '30d' | '90d' | 'all';
type XAxisKey = 'day' | 'dow' | 'hour' | 'type' | 'priority';
type YMetric = 'created' | 'completed' | 'overdue' | 'completion_rate' | 'avg_time';
type ChartType = 'bar' | 'line' | 'pie';
type ReportTab = 'overview' | 'log';

const PERIODS = [
  { label: '7 days', value: '7d', days: 7 },
  { label: '30 days', value: '30d', days: 30 },
  { label: '90 days', value: '90d', days: 90 },
  { label: 'All time', value: 'all', days: 0 },
];
const X_OPTIONS = [
  { label: 'By Day', value: 'day' },
  { label: 'Day of Week', value: 'dow' },
  { label: 'Hour of Day', value: 'hour' },
  { label: 'Task Type', value: 'type' },
  { label: 'Priority', value: 'priority' },
];
const Y_OPTIONS = [
  { label: 'Tasks Created', value: 'created' },
  { label: 'Completed', value: 'completed' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Completion Rate %', value: 'completion_rate' },
  { label: 'Avg Hours to Complete', value: 'avg_time' },
];
const CHART_TYPES = [
  { label: '▬ Bar', value: 'bar' },
  { label: '↗ Line', value: 'line' },
  { label: '◉ Pie', value: 'pie' },
];
const COLORS = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#5AC8FA'];
const PRIORITY_COLOR: Record<string,string> = { urgent:'#FF3B30', high:'#FF9500', medium:'#007AFF', low:'#34C759' };
const TYPE_COLOR: Record<string,string> = { task:'#007AFF', follow_up:'#FF9500', reminder:'#AF52DE', habit:'#34C759' };
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function calcTime(t: Task) {
  if (!t.completed_at) return null;
  return differenceInHours(new Date(t.completed_at), new Date(t.created_at));
}

function buildChart(tasks: Task[], x: XAxisKey, y: YMetric, days: number) {
  const metric = (group: Task[]) => {
    const done = group.filter(t => t.status === 'completed');
    const od = group.filter(t => t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date());
    const times = done.map(calcTime).filter((v): v is number => v !== null);
    if (y === 'created') return group.length;
    if (y === 'completed') return done.length;
    if (y === 'overdue') return od.length;
    if (y === 'completion_rate') return group.length > 0 ? Math.round((done.length / group.length) * 100) : 0;
    if (y === 'avg_time') return times.length > 0 ? Math.round(times.reduce((a,b) => a+b,0) / times.length) : 0;
    return 0;
  };

  if (x === 'type') {
    return ['task','follow_up','reminder','habit'].map(type => ({
      name: type === 'follow_up' ? 'Follow-up' : type[0].toUpperCase() + type.slice(1),
      value: metric(tasks.filter(t => t.type === type)),
      fill: TYPE_COLOR[type],
    })).filter(d => d.value > 0);
  }
  if (x === 'priority') {
    return ['urgent','high','medium','low'].map(p => ({
      name: p[0].toUpperCase() + p.slice(1),
      value: metric(tasks.filter(t => t.priority === p)),
      fill: PRIORITY_COLOR[p],
    })).filter(d => d.value > 0);
  }
  if (x === 'dow') {
    const buckets = DOW.map(d => ({ name: d, items: [] as Task[] }));
    tasks.forEach(t => buckets[getDay(parseISO(t.created_at))].items.push(t));
    return buckets.map(b => ({ name: b.name, value: metric(b.items) }));
  }
  if (x === 'hour') {
    const buckets = Array.from({length:24},(_,i) => ({
      name: i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i-12}pm`,
      items: [] as Task[],
    }));
    tasks.forEach(t => buckets[getHours(parseISO(t.created_at))].items.push(t));
    return buckets.filter(b => b.items.length > 0).map(b => ({ name: b.name, value: metric(b.items) }));
  }
  // day
  const d = days || 90;
  const buckets: Record<string, Task[]> = {};
  for (let i = d - 1; i >= 0; i--) buckets[format(subDays(new Date(), i), 'MMM d')] = [];
  tasks.forEach(t => {
    const k = format(parseISO(t.created_at), 'MMM d');
    if (buckets[k]) buckets[k].push(t);
  });
  return Object.entries(buckets).map(([name, items]) => ({ name, value: metric(items) }));
}

function generateInsights(tasks: Task[]): string[] {
  if (tasks.length === 0) return ['Add your first task to see behavioural insights.'];
  const ins: string[] = [];
  const done = tasks.filter(t => t.status === 'completed');
  const rate = Math.round((done.length / tasks.length) * 100);
  const od = tasks.filter(t => t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date());

  if (rate >= 80) ins.push(`🏆 ${rate}% completion rate — top-tier executive execution. Keep this standard.`);
  else if (rate >= 60) ins.push(`✅ ${rate}% completion rate. Strong, but there is room to push to 80%+.`);
  else if (rate >= 40) ins.push(`⚠️ ${rate}% completion rate. You may be over-committing. Try cutting your list by 30%.`);
  else ins.push(`🚨 Only ${rate}% completed. Focus on fewer, bigger items — quality over quantity.`);

  if (od.length > 0) ins.push(`📅 ${od.length} overdue task${od.length > 1 ? 's' : ''} pending. Your EA says: clear these before adding new ones.`);

  const typeCounts: Record<string,number> = {};
  tasks.forEach(t => { typeCounts[t.type] = (typeCounts[t.type]||0)+1; });
  const top = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0];
  if (top) {
    const map: Record<string,string> = { task:'tasks — execution focused', follow_up:'follow-ups — relationship driven', reminder:'reminders — prompt-dependent', habit:'habits — systems builder' };
    ins.push(`🔍 Most of your work is ${map[top[0]] || top[0]}. This shapes your leadership style.`);
  }

  const urgent = tasks.filter(t => t.priority === 'urgent').length;
  if (urgent > 5) ins.push(`🔥 ${urgent} items marked urgent. When everything is urgent, nothing is. Reprioritise.`);
  else if (urgent === 0 && tasks.filter(t=>t.priority==='high').length === 0) ins.push(`💤 No high or urgent tasks. Are you coasting, or is everything genuinely under control?`);

  const dowCounts = Array(7).fill(0);
  tasks.forEach(t => dowCounts[getDay(parseISO(t.created_at))]++);
  const peakDow = dowCounts.indexOf(Math.max(...dowCounts));
  ins.push(`📆 You plan most on ${DOW[peakDow]}. Block this time in your calendar — it's your peak thinking window.`);

  const hourCounts = Array(24).fill(0);
  tasks.forEach(t => hourCounts[getHours(parseISO(t.created_at))]++);
  const peakHr = hourCounts.indexOf(Math.max(...hourCounts));
  const hrLabel = peakHr === 0 ? '12am' : peakHr < 12 ? `${peakHr}am` : peakHr === 12 ? '12pm' : `${peakHr-12}pm`;
  ins.push(`⏰ Most active at ${hrLabel}. Schedule your most important work just before this window.`);

  const times = done.map(calcTime).filter((v): v is number => v !== null);
  if (times.length > 0) {
    const avg = Math.round(times.reduce((a,b)=>a+b,0)/times.length);
    if (avg < 4) ins.push(`⚡ Avg completion: ${avg}h — you move fast. Watch quality under speed.`);
    else if (avg < 48) ins.push(`⏱ Avg completion: ${avg}h — healthy execution pace.`);
    else ins.push(`🐢 Avg completion: ${Math.round(avg/24)} days. Break big tasks into daily sub-actions.`);
  }

  const habits = tasks.filter(t => t.type === 'habit');
  if (habits.length > 0) {
    const hr = Math.round((habits.filter(t=>t.status==='completed').length / habits.length)*100);
    ins.push(hr >= 70 ? `💪 ${hr}% habit completion — building real systems. Keep the streak.` : `🎯 ${hr}% habit rate. Consistency over intensity — show up daily even if briefly.`);
  }

  return ins.slice(0, 7);
}

function exportCSV(tasks: Task[]) {
  const headers = ['Title','Type','Priority','Status','Due Date','Created','Completed At'];
  const rows = tasks.map(t => [
    `"${t.title.replace(/"/g,'""')}"`,
    t.type,
    t.priority,
    t.status,
    t.due_date ? format(parseISO(t.due_date), 'yyyy-MM-dd') : '',
    format(parseISO(t.created_at), 'yyyy-MM-dd HH:mm'),
    t.completed_at ? format(parseISO(t.completed_at), 'yyyy-MM-dd HH:mm') : '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse-tasks-${format(new Date(),'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({label, value, sub, color}: {label:string; value:string|number; sub?:string; color?:string}) {
  return (
    <div className="rounded-2xl p-4" style={{background:'var(--bg-secondary)', border:'1px solid var(--border)'}}>
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{color:'var(--text-tertiary)'}}>{label}</p>
      <p className="text-2xl font-bold" style={{color: color||'var(--text-primary)'}}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{color:'var(--text-secondary)'}}>{sub}</p>}
    </div>
  );
}

const TYPE_LABEL: Record<string,string> = { task:'Task', follow_up:'Follow-up', reminder:'Reminder', habit:'Habit' };
const STATUS_COLOR: Record<string,string> = { completed:'#34C759', pending:'#007AFF', in_progress:'#FF9500' };

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [xAxis, setXAxis] = useState<XAxisKey>('day');
  const [yMetric, setYMetric] = useState<YMetric>('completed');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [reportTab, setReportTab] = useState<ReportTab>('overview');
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'all'|'completed'|'pending'|'overdue'>('all');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { if (!authLoading && !user) router.replace('/login'); }, [user,authLoading,router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Load ALL tasks for activity log
    const { data: all } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', {ascending:false});
    setAllTasks(all || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Filter tasks for charts/KPIs based on period
  const tasks = useMemo(() => {
    const p = PERIODS.find(p => p.value === period);
    if (!p || p.days === 0) return allTasks;
    const cutoff = subDays(new Date(), p.days);
    return allTasks.filter(t => parseISO(t.created_at) >= cutoff);
  }, [allTasks, period]);

  const done = useMemo(() => tasks.filter(t => t.status === 'completed'), [tasks]);
  const od = useMemo(() => tasks.filter(t => t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date()), [tasks]);
  const rate = tasks.length > 0 ? Math.round((done.length/tasks.length)*100) : 0;
  const avgTime = useMemo(() => {
    const times = done.map(calcTime).filter((v): v is number => v !== null);
    return times.length > 0 ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : 0;
  }, [done]);

  const chartData = useMemo(() => buildChart(tasks, xAxis, yMetric, PERIODS.find(p=>p.value===period)?.days||90), [tasks,xAxis,yMetric,period]);
  const insights = useMemo(() => generateInsights(tasks), [tasks]);
  const yLabel = Y_OPTIONS.find(y=>y.value===yMetric)?.label||'';

  // Activity log filtering
  const logTasks = useMemo(() => {
    let base = allTasks;
    if (logFilter === 'completed') base = base.filter(t => t.status === 'completed');
    else if (logFilter === 'pending') base = base.filter(t => t.status !== 'completed');
    else if (logFilter === 'overdue') base = base.filter(t => t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date());
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      base = base.filter(t => t.title.toLowerCase().includes(q) || t.type.includes(q) || t.priority.includes(q));
    }
    return base;
  }, [allTasks, logFilter, logSearch]);

  const fetchAiInsight = async () => {
    if (!user || aiLoading) return;
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const summary = {
        total: tasks.length,
        completed: done.length,
        overdue: od.length,
        rate,
        avgTime,
        types: ['task','follow_up','reminder','habit'].map(t => ({ type: t, count: tasks.filter(x=>x.type===t).length })),
        priorities: ['urgent','high','medium','low'].map(p => ({ priority: p, count: tasks.filter(x=>x.priority===p).length })),
        period,
      };
      const res = await fetch('/api/reports/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ summary }),
      });
      if (res.ok) {
        const json = await res.json();
        setAiInsight(json.insight);
      } else {
        setAiInsight('AI insight unavailable — add your Anthropic API key in settings to enable this feature.');
      }
    } catch {
      setAiInsight('Could not fetch AI insight right now. Try again later.');
    } finally {
      setAiLoading(false);
    }
  };

  if (authLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg)'}}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{borderColor:'var(--accent)',borderTopColor:'transparent'}} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{background:'var(--bg)'}}>
      <header className="sticky top-0 z-30" style={{background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{background:'var(--bg-secondary)',color:'var(--text-primary)'}}>‹</button>
          <div className="flex-1">
            <h1 className="text-base font-bold" style={{color:'var(--text-primary)'}}>EA Reports</h1>
            <p className="text-xs" style={{color:'var(--text-tertiary)'}}>Behavioural patterns & execution insights</p>
          </div>
          {/* Export CSV */}
          <button
            onClick={() => exportCSV(reportTab === 'log' ? logTasks : tasks)}
            title="Export to CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{background:'var(--bg-secondary)', color:'var(--text-secondary)', border:'1px solid var(--border)'}}>
            ↓ CSV
          </button>
        </div>

        {/* Report tabs */}
        <div className="max-w-2xl mx-auto px-4 flex border-t" style={{borderColor:'var(--border)'}}>
          {([{key:'overview',label:'📊 Overview'},{key:'log',label:'📋 Activity Log'}] as {key:ReportTab,label:string}[]).map(({key,label}) => (
            <button key={key} onClick={() => setReportTab(key)}
              className="flex-1 py-2.5 text-xs font-semibold text-center"
              style={{
                color: reportTab===key ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: reportTab===key ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Period filter (overview only) */}
        {reportTab === 'overview' && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value as Period)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                style={{background: period===p.value ? 'var(--accent)' : 'var(--bg-secondary)', color: period===p.value ? 'white' : 'var(--text-secondary)', border: period===p.value ? 'none' : '1px solid var(--border)'}}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-24 space-y-5 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{borderColor:'var(--accent)',borderTopColor:'transparent'}} />
            <p className="text-sm" style={{color:'var(--text-tertiary)'}}>Analysing your patterns...</p>
          </div>
        ) : reportTab === 'overview' ? (<>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Created" value={tasks.length} sub={`in selected period`} />
            <StatCard label="Completed" value={`${done.length} (${rate}%)`} color={rate>=70?'#34C759':rate>=40?'#FF9500':'#FF3B30'} />
            <StatCard label="Overdue" value={od.length} sub="need attention" color={od.length>0?'#FF3B30':'#34C759'} />
            <StatCard label="Avg. Time" value={avgTime>0?`${avgTime}h`:'—'} sub="create → complete" />
          </div>

          {/* EA Insights */}
          <div className="rounded-2xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
            <div className="px-4 py-3 flex items-center justify-between" style={{background:'var(--accent)'}}>
              <p className="text-xs font-bold text-white uppercase tracking-wide">🤖 EA Behavioural Insights</p>
              <button
                onClick={fetchAiInsight}
                disabled={aiLoading}
                className="text-xs text-white opacity-80 hover:opacity-100 px-2 py-1 rounded-lg border border-white/30 disabled:opacity-50">
                {aiLoading ? 'Thinking…' : '✨ AI Deep Read'}
              </button>
            </div>
            {aiInsight && (
              <div className="px-4 py-3" style={{background:'rgba(0,122,255,0.05)', borderBottom:'1px solid var(--border)'}}>
                <p className="text-xs font-semibold mb-1" style={{color:'var(--accent)'}}>✨ Claude's personalised analysis</p>
                <p className="text-sm leading-relaxed" style={{color:'var(--text-primary)'}}>{aiInsight}</p>
              </div>
            )}
            {insights.map((ins,i) => (
              <div key={i} className="px-4 py-3" style={{borderTop: i>0 || aiInsight ? '1px solid var(--border)' : 'none', background:'var(--bg)'}}>
                <p className="text-sm leading-relaxed" style={{color:'var(--text-primary)'}}>{ins}</p>
              </div>
            ))}
          </div>

          {/* Custom Chart */}
          <div className="rounded-2xl p-4 space-y-4" style={{background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
            <div>
              <p className="text-sm font-bold" style={{color:'var(--text-primary)'}}>Custom Chart</p>
              <p className="text-xs mt-0.5" style={{color:'var(--text-tertiary)'}}>Choose your axes and chart type</p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:'var(--text-tertiary)'}}>X Axis — Group by</p>
                <div className="flex flex-wrap gap-2">
                  {X_OPTIONS.map(x => (
                    <button key={x.value} onClick={() => setXAxis(x.value as XAxisKey)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{background: xAxis===x.value?'var(--accent)':'var(--bg)', color: xAxis===x.value?'white':'var(--text-secondary)', border: xAxis===x.value?'none':'1px solid var(--border)'}}>
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:'var(--text-tertiary)'}}>Y Axis — Measure</p>
                <div className="flex flex-wrap gap-2">
                  {Y_OPTIONS.map(y => (
                    <button key={y.value} onClick={() => setYMetric(y.value as YMetric)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{background: yMetric===y.value?'var(--accent)':'var(--bg)', color: yMetric===y.value?'white':'var(--text-secondary)', border: yMetric===y.value?'none':'1px solid var(--border)'}}>
                      {y.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:'var(--text-tertiary)'}}>Chart Type</p>
                <div className="flex gap-2">
                  {CHART_TYPES.map(c => (
                    <button key={c.value} onClick={() => setChartType(c.value as ChartType)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{background: chartType===c.value?'var(--accent)':'var(--bg)', color: chartType===c.value?'white':'var(--text-secondary)', border: chartType===c.value?'none':'1px solid var(--border)'}}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{height:260}}>
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm" style={{color:'var(--text-tertiary)'}}>No data for this selection</p>
                </div>
              ) : chartType === 'pie' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,value}) => `${name}: ${value}`}>
                      {chartData.map((_,i) => <Cell key={i} fill={(chartData[i] as any).fill || COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : chartType === 'line' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{top:4,right:8,bottom:4,left:-20}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{fontSize:10,fill:'var(--text-tertiary)'}} />
                    <YAxis tick={{fontSize:10,fill:'var(--text-tertiary)'}} />
                    <Tooltip contentStyle={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}} />
                    <Line type="monotone" dataKey="value" name={yLabel} stroke="#007AFF" strokeWidth={2} dot={{r:3}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{top:4,right:8,bottom:4,left:-20}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{fontSize:10,fill:'var(--text-tertiary)'}} />
                    <YAxis tick={{fontSize:10,fill:'var(--text-tertiary)'}} />
                    <Tooltip contentStyle={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,fontSize:12}} />
                    <Bar dataKey="value" name={yLabel} radius={[4,4,0,0]}>
                      {chartData.map((e,i) => <Cell key={i} fill={(e as any).fill || COLORS[i%COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Type breakdown */}
          <div className="rounded-2xl p-4 space-y-3" style={{background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
            <p className="text-sm font-bold" style={{color:'var(--text-primary)'}}>Task Type Breakdown</p>
            {['task','follow_up','reminder','habit'].map(type => {
              const g = tasks.filter(t=>t.type===type);
              const d = g.filter(t=>t.status==='completed');
              const pct = g.length>0 ? Math.round((d.length/g.length)*100) : 0;
              const lbl = type==='follow_up'?'Follow-ups': type[0].toUpperCase()+type.slice(1)+'s';
              return (
                <div key={type}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium" style={{color:'var(--text-primary)'}}>{lbl}</span>
                    <span className="text-xs" style={{color:'var(--text-secondary)'}}>{d.length}/{g.length} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{background:'var(--border)'}}>
                    <div className="h-full rounded-full" style={{width:`${pct}%`,background:TYPE_COLOR[type]}} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority breakdown */}
          <div className="rounded-2xl p-4 space-y-3" style={{background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
            <p className="text-sm font-bold" style={{color:'var(--text-primary)'}}>Priority Distribution</p>
            {['urgent','high','medium','low'].map(p => {
              const count = tasks.filter(t=>t.priority===p).length;
              const pct = tasks.length>0 ? Math.round((count/tasks.length)*100) : 0;
              return (
                <div key={p}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium capitalize" style={{color:'var(--text-primary)'}}>{p}</span>
                    <span className="text-xs" style={{color:'var(--text-secondary)'}}>{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{background:'var(--border)'}}>
                    <div className="h-full rounded-full" style={{width:`${pct}%`,background:PRIORITY_COLOR[p]}} />
                  </div>
                </div>
              );
            })}
          </div>

        </>) : (
          /* ── Activity Log Tab ── */
          <>
            {/* Search + filter */}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Search activity…"
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{background:'var(--bg-secondary)', color:'var(--text-primary)', border:'1px solid var(--border)'}}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {([
                {key:'all',label:`All (${allTasks.length})`},
                {key:'completed',label:`Done (${allTasks.filter(t=>t.status==='completed').length})`},
                {key:'pending',label:`Pending (${allTasks.filter(t=>t.status!=='completed').length})`},
                {key:'overdue',label:`Overdue (${allTasks.filter(t=>t.due_date&&t.status!=='completed'&&new Date(t.due_date)<new Date()).length})`},
              ] as {key:typeof logFilter,label:string}[]).map(f => (
                <button key={f.key} onClick={() => setLogFilter(f.key)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                  style={{background:logFilter===f.key?'var(--accent)':'var(--bg-secondary)', color:logFilter===f.key?'white':'var(--text-secondary)', border:logFilter===f.key?'none':'1px solid var(--border)'}}>
                  {f.label}
                </button>
              ))}
            </div>

            {logTasks.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm" style={{color:'var(--text-tertiary)'}}>No tasks match your filter</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
                {logTasks.map((task, i) => {
                  const isOverdue = task.due_date && task.status !== 'completed' && new Date(task.due_date) < new Date();
                  const statusColor = task.status === 'completed' ? '#34C759' : isOverdue ? '#FF3B30' : '#007AFF';
                  const statusLabel = task.status === 'completed' ? 'Done' : isOverdue ? 'Overdue' : 'Pending';
                  return (
                    <div key={task.id} className="px-4 py-3" style={{borderTop: i > 0 ? '1px solid var(--border)' : 'none', background:'var(--bg)'}}>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{background: statusColor}} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug" style={{color:'var(--text-primary)', textDecoration: task.status==='completed'?'line-through':'none', opacity: task.status==='completed'?0.7:1}}>
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{background: TYPE_COLOR[task.type]+'18', color: TYPE_COLOR[task.type]}}>
                              {TYPE_LABEL[task.type] || task.type}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                              style={{background: PRIORITY_COLOR[task.priority]+'18', color: PRIORITY_COLOR[task.priority]}}>
                              {task.priority}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{background: statusColor+'18', color: statusColor}}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1">
                            <span className="text-[11px]" style={{color:'var(--text-tertiary)'}}>
                              Created {format(parseISO(task.created_at), 'MMM d, yyyy')}
                            </span>
                            {task.due_date && (
                              <span className="text-[11px]" style={{color: isOverdue ? '#FF3B30' : 'var(--text-tertiary)'}}>
                                Due {format(parseISO(task.due_date), 'MMM d')}
                              </span>
                            )}
                            {task.completed_at && (
                              <span className="text-[11px]" style={{color:'#34C759'}}>
                                ✓ {format(parseISO(task.completed_at), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-center pb-4" style={{color:'var(--text-tertiary)'}}>
              Showing {logTasks.length} of {allTasks.length} total tasks
            </p>
          </>
        )}
      </main>
    </div>
  );
}
