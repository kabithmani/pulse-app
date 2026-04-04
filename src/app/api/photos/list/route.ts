import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const entityType = req.nextUrl.searchParams.get('entity_type');
  const entityId = req.nextUrl.searchParams.get('entity_id');
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 });
  }

  const prefix = `${user.id}/${entityType}s/${entityId}/`;
  const { data: files, error } = await supabase.storage.from('pulse-photos').list(prefix);

  if (error) return NextResponse.json({ photos: [] });

  // Generate signed URLs for all files
  const photos = await Promise.all(
    (files || []).filter(f => f.name !== '.emptyFolderPlaceholder').map(async (f) => {
      const path = `${prefix}${f.name}`;
      const { data } = await supabase.storage.from('pulse-photos').createSignedUrl(path, 60 * 60 * 24 * 7);
      return { path, name: f.name, url: data?.signedUrl, created_at: f.created_at };
    })
  );

  return NextResponse.json({ photos: photos.filter(p => p.url) });
}
