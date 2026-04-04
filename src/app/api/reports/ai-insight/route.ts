import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify auth
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error: authError } = await supabase.auth.getUser(auth);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { summary } = await req.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      insight: 'Add your Anthropic API key (ANTHROPIC_API_KEY) to Vercel environment variables to unlock personalised AI deep-reads.'
    });
  }

  const prompt = `You are an executive assistant AI analysing a professional's task management patterns. Give a sharp, personalised, 2-3 sentence insight based on this data — be direct, specific, and like a high-end EA speaking to a busy executive. No fluff.

Task summary (${summary.period} period):
- Total tasks created: ${summary.total}
- Completed: ${summary.completed} (${summary.rate}%)
- Overdue: ${summary.overdue}
- Avg time to complete: ${summary.avgTime}h
- By type: ${summary.types.map((t: any) => `${t.type}: ${t.count}`).join(', ')}
- By priority: ${summary.priorities.map((p: any) => `${p.priority}: ${p.count}`).join(', ')}

Give 1 sharp behavioural pattern observation, 1 concrete recommendation the executive should act on this week.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude API error:', err);
      return NextResponse.json({ insight: 'AI analysis temporarily unavailable. Your rule-based insights above are still accurate.' });
    }

    const data = await res.json();
    const insight = data.content?.[0]?.text || 'No insight generated.';
    return NextResponse.json({ insight });
  } catch (e) {
    console.error('AI insight error:', e);
    return NextResponse.json({ insight: 'AI analysis temporarily unavailable.' });
  }
}
