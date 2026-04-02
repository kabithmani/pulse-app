'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type EventType =
  | 'created'
  | 'updated'
  | 'completed'
  | 'reopened'
  | 'deleted'
  | 'snoozed'
  | 'overdue_flagged'
  | 'commented';

type Source = 'manual' | 'voice' | 'webhook' | 'system';

interface LogEventParams {
  taskId?: string;
  userId: string;
  eventType: EventType;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  note?: string;
  source?: Source;
}

export function useTaskEvents() {
  const logEvent = useCallback(async ({
    taskId,
    userId,
    eventType,
    oldValue,
    newValue,
    note,
    source = 'manual',
  }: LogEventParams) => {
    const { error } = await supabase.from('task_events').insert({
      task_id: taskId || null,
      user_id: userId,
      event_type: eventType,
      old_value: oldValue || null,
      new_value: newValue || null,
      note: note || null,
      source,
    });

    if (error) console.error('Failed to log event:', error);
  }, []);

  return { logEvent };
}
