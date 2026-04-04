import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const entityType = formData.get('entity_type') as string; // 'task' | 'contact'
  const entityId = formData.get('entity_id') as string;

  if (!file || !entityType || !entityId) {
    return NextResponse.json({ error: 'Missing file, entity_type, or entity_id' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${Date.now()}.${ext}`;
  const path = `${user.id}/${entityType}s/${entityId}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === 'pulse-photos')) {
    await supabase.storage.createBucket('pulse-photos', {
      public: false,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
  }

  const { error: uploadError } = await supabase.storage
    .from('pulse-photos')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Generate a signed URL valid for 1 year
  const { data: signedData } = await supabase.storage
    .from('pulse-photos')
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  return NextResponse.json({
    ok: true,
    path,
    url: signedData?.signedUrl,
  }, { status: 201 });
}
