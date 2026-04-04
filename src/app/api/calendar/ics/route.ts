import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

// Same key derivation as webhook — no extra DB needed
function userIdFromKey(key: string): string | null {
  try {
    const parts = key.split('_');
    if (parts.length < 3 || parts[0] !== 'pk') return null;
    const userId = Buffer.from(parts[1], 'base64url').toString('utf8');
    const secret = process.env.CRON_SECRET || 'pulse-cron-2026';
    const sig = createHmac('sha256', secret).update(userId).digest('hex').slice(0, 24);
    const encoded = Buffer.from(userId).toString('base64url');
    const expected = `pk_${encoded}_${sig}`;
    if (expected !== key) return null;
    return userId;
  } catch { return null; }
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toICSDate(dateStr: string, timeStr?: string): string {
  const d = new Date(dateStr);
  if (timeStr) {
    const [h, m] = timeStr.split(':');
    d.setHours(parseInt(h), parseInt(m), 0);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  // All-day event
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) return new NextResponse('Missing key', { status: 401 });

  const userId = userIdFromKey(key);
  if (!userId) return new NextResponse('Invalid key', { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, contact:contacts(name)')
    .eq('user_id', userId)
    .neq('status', 'completed')
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });

  if (!tasks || tasks.length === 0) {
    const empty = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Pulse//Personal Execution Assistant//EN',
      'CALNAME:Pulse Tasks',
      'END:VCALENDAR',
    ].join('\r\n');
    return new NextResponse(empty, {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    });
  }

  const priorityMap: Record<string, number> = { urgent: 1, high: 3, medium: 5, low: 9 };
  const typeEmoji: Record<string, string> = {
    task: '📋', follow_up: '🔄', reminder: '⏰', habit: '🔁',
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Personal Execution Assistant//EN',
    'CALNAME:Pulse Tasks',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Pulse Tasks',
    'X-WR-TIMEZONE:Asia/Kolkata',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  for (const task of tasks) {
    const emoji = typeEmoji[task.type] || '📋';
    const contact = task.contact?.name ? ` · ${task.contact.name}` : '';
    const title = `${emoji} ${task.title}${contact}`;
    const hasTime = !!task.due_time;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:pulse-${task.id}@pulse-app`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
    lines.push(`SUMMARY:${escapeICS(title)}`);

    if (hasTime) {
      lines.push(`DTSTART;TZID=Asia/Kolkata:${toICSDate(task.due_date, task.due_time)}`);
      // 30-min block
      const end = new Date(task.due_date);
      const [h, m] = task.due_time.split(':');
      end.setHours(parseInt(h), parseInt(m) + 30, 0);
      lines.push(`DTEND;TZID=Asia/Kolkata:${end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${toICSDate(task.due_date)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDate(task.due_date)}`);
    }

    if (task.description) lines.push(`DESCRIPTION:${escapeICS(task.description)}`);
    lines.push(`PRIORITY:${priorityMap[task.priority] || 5}`);
    lines.push(`CATEGORIES:${task.type.toUpperCase()}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="pulse-tasks.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  });
}
