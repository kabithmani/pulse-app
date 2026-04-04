import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const now = new Date();
  const hour = now.getUTCHours();
  const isMorning = hour === 2;
  const isEvening = hour === 12;

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription');

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const { user_id, subscription } of subscriptions) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user_id)
      .neq('status', 'completed');

    if (!tasks) continue;

    const overdue = tasks.filter(t =>
      t.due_date && new Date(t.due_date) < now
    );
    const dueToday = tasks.filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date).toDateString() === now.toDateString();
    });

    let title = '';
    let body = '';

    if (isMorning) {
      title = '☀️ Good morning — Pulse briefing';
      body = dueToday.length > 0
        ? `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today${overdue.length > 0 ? `, ${overdue.length} overdue` : ''}.`
        : overdue.length > 0
          ? `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} need attention.`
          : 'All clear — no tasks due today.';
    } else if (isEvening) {
      title = '🌙 Evening check-in — Pulse';
      body = tasks.length > 0
        ? `${tasks.length} open task${tasks.length > 1 ? 's' : ''}. ${overdue.length > 0 ? `${overdue.length} overdue.` : 'None overdue.'}`
        : 'All tasks done. Well done.';
    }

    if (!title) continue;

    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
      sent++;
    } catch (e) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user_id);
    }
  }

  return NextResponse.json({ sent });
}
