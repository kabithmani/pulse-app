'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Phone, CheckSquare, AlertTriangle,
  Download, TrendingUp, TrendingDown, ArrowLeft
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface KPI {
  label: string;
  value: number;
  delta: number;
  icon: React.ReactNode;
  color: string;
}

interface ChartDataPoint {
  date: string;
  calls_missed: number;
  tasks_completed: number;
  followups_done: number;
}

type YAxisKey = 'calls_missed' | 'tasks_completed' | 'followups_done';
type TimeRange = '7' | '30' | '90';

export default function ReportsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [overdueByType, setOverdueByType] = useState<{ type: string; count: number }[]>([]);
  const [topContacts, setTopContacts] = useState<{ name: string; interactions: number; staleness: string }[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [yAxis, setYAxis] = useState<YAxisKey>('tasks_completed');

  useEffect(() => { fetchData(); }, [timeRange]);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
    const rangeStart = daysAgo(parseInt(timeRange));
    const prevStart = daysAgo(parseInt(timeRange) * 2);

    const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', user.id);
    if (!tasks) { setLoading(false); return; }

    const current = tasks.filter(t => t.created_at >= rangeStart);
    const prev = tasks.filter(t => t.created_at >= prevStart && t.created_at < rangeStart);

    const callsMissed = current.filter(t => t.type === 'call' && t.status === 'overdue').length;
    const prevCallsMissed = prev.filter(t => t.type === 'call' && t.status === 'overdue').length;
    const tasksCompleted = current.filter(t => t.status === 'done').length;
    const prevTasksCompleted = prev.filter(t => t.status === 'done').length;
    const followupsDone = current.filter(t => t.type === 'follow_up' && t.status === 'done').length;
    const prevFollowupsDone = prev.filter(t => t.type === 'follow_up' && t.status === 'done').length;

    const { data: contacts } = await supabase.from('contacts').select('*').eq('user_id', user.id);
    const atRisk = contacts?.filter(c => c.staleness_status === 'red').length ?? 0;

    const delta = (curr: number, pr: number) =>
      pr === 0 ? 0 : Math.round(((curr - pr) / pr) * 100);

    setKpis([
      { label: 'Calls Missed', value: callsMissed, delta: delta(callsMissed, prevCallsMissed), icon: <Phone size={18} />, color: '#EF4444' },
      { label: 'Tasks Completed', value: tasksCompleted, delta: delta(tasksCompleted, prevTasksCompleted), icon: <CheckSquare size={18} />, color: '#10B981' },
      { label: 'Follow-ups Done', value: followupsDone, delta: delta(followupsDone, prevFollowupsDone), icon: <TrendingUp size={18} />, color: '#6366F1' },
      { label: 'Contacts at Risk', value: atRisk, delta: 0, icon: <AlertTriangle size={18} />, color: '#F59E0B' },
    ]);

    const days = parseInt(timeRange);
    const grouped: Record<string, ChartDataPoint> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      grouped[key] = { date: key, calls_missed: 0, tasks_completed: 0, followups_done: 0 };
    }
    current.forEach(t => {
      const key = t.created_at?.split('T')[0];
      if (!grouped[key]) return;
      if (t.status === 'done') grouped[key].tasks_completed++;
      if (t.type === 'call' && t.status === 'overdue') grouped[key].calls_missed++;
      if (t.type === 'follow_up' && t.status === 'done') grouped[key].followups_done++;
    });
    setChartData(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)));

    const types = ['call', 'follow_up', 'meeting', 'todo'];
    setOverdueByType(types.map(type => ({
      type: type.replace('_', ' '),
      count: current.filter(t => t.type === type && t.status === 'overdue').length
    })));

    const { data: logs } = await supabase
      .from('interaction_logs')
      .select('contact_id, contacts(name, staleness_status)')
      .gte('logged_at', rangeStart);

    const contactMap: Record<string, { name: string; interactions: number; staleness: string }> = {};
    logs?.forEach((l: any) => {
      const id = l.contact_id;
      if (!contactMap[id]) contactMap[id] = {
        name: l.contacts?.name ?? 'Unknown',
        interactions: 0,
        staleness: l.contacts?.staleness_status ?? 'green'
      };
      contactMap[id].interactions++;
    });
    setTopContacts(Object.values(contactMap).sort((a, b) => b.interactions - a.interactions).slice(0, 5));
    setLoading(false);
  }

  function exportCSV() {
    const rows = [
      ['Date', 'Tasks Completed', 'Calls Missed', 'Follow-ups Done'],
      ...chartData.map(d => [d.date, d.tasks_completed, d.calls_missed, d.followups_done])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const stalenessColor = (s: string) =>
    s === 'red' ? '#EF4444' : s === 'amber' ? '#F59E0B' : '#10B981';

  const yAxisOptions: { key: YAxisKey; label: string }[] = [
    { key: 'tasks_completed', label: 'Tasks Completed' },
    { key: 'calls_missed', label: 'Calls Missed' },
    { key: 'followups_done', label: 'Follow-ups Done' },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F5F5F5]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0F0F0F] border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#71717A] hover:text-[#F5F5F5] transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-base font-medium">Reports</h1>
            <p className="text-[#71717A] text-xs">Your BD activity at a glance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1A1A1A] border border-[#2A2A2A] rounded-md overflow-hidden text-sm">
            {(['7', '30', '90'] as TimeRange[]).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 transition-colors ${timeRange === r ? 'bg-[#6366F1] text-white' : 'text-[#71717A] hover:text-[#F5F5F5]'}`}>
                {r}d
              </button>
            ))}
          </div>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md text-sm text-[#71717A] hover:text-[#F5F5F5] transition-colors">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-16 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#71717A]">
            <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading your data...</span>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {kpis.map(kpi => (
                <div key={kpi.label} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#71717A] text-xs uppercase tracking-wider leading-tight">{kpi.label}</span>
                    <span style={{ color: kpi.color }}>{kpi.icon}</span>
                  </div>
                  <div className="text-2xl font-medium">{kpi.value}</div>
                  <div className={`flex items-center gap-1 text-xs mt-1 ${kpi.delta >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {kpi.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(kpi.delta)}% vs prev period
                  </div>
                </div>
              ))}
            </div>

            {/* Main Chart */}
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-5 mb-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-medium">Activity Over Time</h2>
                <select value={yAxis} onChange={e => setYAxis(e.target.value as YAxisKey)}
                  className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-2 py-1 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#6366F1]">
                  {yAxisOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="date" tick={{ fill: '#71717A', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#71717A', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#71717A' }} />
                  <Line type="monotone" dataKey={yAxis} stroke="#6366F1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-5">
                <h2 className="text-sm font-medium mb-4">Overdue by Type</h2>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={overdueByType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#71717A', fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="type" tick={{ fill: '#71717A', fontSize: 10 }} width={72} />
                    <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-5">
                <h2 className="text-sm font-medium mb-4">Top Contacts by Activity</h2>
                {topContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-[#71717A] text-sm">
                    No interactions logged yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topContacts.map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[#71717A] text-xs w-4">{i + 1}</span>
                          <span className="text-sm">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#71717A] text-xs">{c.interactions}</span>
                          <span className="w-2 h-2 rounded-full" style={{ background: stalenessColor(c.staleness) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
