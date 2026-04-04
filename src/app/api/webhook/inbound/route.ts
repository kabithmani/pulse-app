import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

// Derives a deterministic webhook key from user_id + secret — no DB storage needed
function deriveKey(userId: string): string {
  const secret = process.env.CRON_SECRET || 'pulse-cron-2026';
  const sig = createHmac('sha256', secret).update(userId).digest('hex').slice(0, 24);
  const encoded = Buffer.from(userId).toString('base64url');
  return `pk_${encoded}_${sig}`;
}

function userIdFromKey(key: string): string | null {
  try {
    const parts = key.split('_');
    if (parts.length < 3 || parts[0] !== 'pk') return null;
    const userId = Buffer.from(parts[1], 'base64url').toString('utf8');
    const expected = deriveKey(userId);
    if (expected !== key) return null;
    return userId;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Accept key via Authorization header or ?key= query param
  const authHeader = req.headers.get('authorization') || '';
  const keyFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const keyFromQuery = req.nextUrl.searchParams.get('key');
  const key = keyFromHeader || keyFromQuery;

  if (!key) {
    return NextResponse.json(
      { error: 'Missing API key. Pass Authorization: Bearer <key> or ?key=<key>' },
      { status: 401 }
    );
  }

  const userId = userIdFromKey(key);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Parse payload — flexible, works with Zapier/Make/Pabbly
  const title = body.title || body.task || body.name || body.subject;
  if (!title) {
    return NextResponse.json(
      { error: 'Missing required field: title (also accepted: task, name, subject)' },
      { status: 400 }
    );
  }

  // Map type field
  const typeMap: Record<string, string> = {
    task: 'task', follow_up: 'follow_up', followup: 'follow_up',
    'follow-up': 'follow_up', reminder: 'reminder', habit: 'habit',
  };
  const type = typeMap[body.type?.toLowerCase()] || 'task';

  // Map priority
  const priorityMap: Record<string, string> = {
    low: 'low', medium: 'medium', high: 'high', urgent: 'urgent',
  };
  const priority = priorityMap[body.priority?.toLowerCase()] || 'medium';

  // Parse due_date — accepts ISO strings or natural strings
  let due_date: string | undefined;
  if (body.due_date || body.due || body.date) {
    const raw = body.due_date || body.due || body.date;
    try {
      due_date = new Date(raw).toISOString();
    } catch {
      due_date = undefined;
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Optionally resolve contact by name
  let contact_id: string | undefined;
  if (body.contact || body.person) {
    const contactName = body.contact || body.person;
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', `%${contactName}%`)
      .single();
    if (contact) contact_id = contact.id;
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title,
      description: body.description || body.notes || body.body || undefined,
      type,
      priority,
      status: 'pending',
      due_date,
      due_time: body.due_time || body.time || undefined,
      contact_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create task', detail: error.message }, { status: 500 });
  }

  // Log to task_events
  await supabase.from('task_events').insert({
    task_id: task.id,
    user_id: userId,
    event_type: 'created',
    new_value: { title: task.title, type: task.type, due_date: task.due_date },
    source: 'webhook',
  });

  return NextResponse.json({
    success: true,
    task: { id: task.id, title: task.title, type: task.type, priority: task.priority, due_date: task.due_date },
  }, { status: 201 });
}

// GET — health check / info endpoint
export async function GET(req: NextRequest) {
  const keyFromQuery = req.nextUrl.searchParams.get('key');
  if (keyFromQuery) {
    const userId = userIdFromKey(keyFromQuery);
    return NextResponse.json({ valid: !!userId });
  }
  return NextResponse.json({
    name: 'Pulse Webhook API',
    version: '1.0',
    method: 'POST',
    auth: 'Authorization: Bearer <your_api_key>',
    fields: {
      required: ['title'],
      optional: ['type', 'priority', 'due_date', 'due_time', 'description', 'contact'],
      type_values: ['task', 'follow_up', 'reminder', 'habit'],
      priority_values: ['low', 'medium', 'high', 'urgent'],
    },
    example: {
      title: 'Call Amit about contract',
      type: 'follow_up',
      priority: 'high',
      due_date: '2026-04-10',
      contact: 'Amit',
    },
  });
}
