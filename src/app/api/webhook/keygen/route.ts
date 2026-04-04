import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

function deriveKey(userId: string): string {
  const secret = process.env.CRON_SECRET || 'pulse-cron-2026';
  const sig = createHmac('sha256', secret).update(userId).digest('hex').slice(0, 24);
  const encoded = Buffer.from(userId).toString('base64url');
  return `pk_${encoded}_${sig}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const key = deriveKey(user.id);
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pulse-app-weld.vercel.app'}/api/webhook/inbound`;

  return NextResponse.json({
    key,
    webhook_url: webhookUrl,
    usage: `POST ${webhookUrl} with Authorization: Bearer ${key}`,
    zapier_url: `${webhookUrl}?key=${key}`,
  });
}
