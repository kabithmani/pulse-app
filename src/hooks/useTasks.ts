'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Task, TaskFormData } from '@/lib/types';
import { startOfDay, endOfDay, isBefore, isToday, isAfter } from 'date-fns';
import { useTaskEvents } from '@/hooks/useTaskEvents';

export function useTasks(userId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logEvent } = useTaskEvents();

  const clearError = useCallback(() => setError(null), []);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('tasks')
      .select('*, contact:contacts(*)')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      setError('Could not load tasks. Check your connection and try again.');
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchTasks();

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => { fetchTasks(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchTasks]);

  const createTask = useCallback(async (formData: TaskFormData) => {
    if (!userId) return null;
    setError(null);

    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...formData, user_id: userId, status: 'pending' })
      .select()
      .single();

    if (error) {
      setError('Could not save task. Please try again.');
      return null;
    }

    await logEvent({
      taskId: data.id,
      userId,
      eventType: 'created',
      newValue: { title: data.title, type: data.type, due_date: data.due_date },
      source: 'manual',
    });

    return data;
  }, [userId, logEvent]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    setError(null);

    const oldTask = tasks.find(t => t.id === taskId);

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      setError('Could not update task. Please try again.');
      return null;
    }

    await logEvent({
      taskId,
      userId: userId!,
      eventType: 'updated',
      oldValue: oldTask ? {
        title: oldTask.title,
        type: oldTask.type,
        due_date: oldTask.due_date,
        priority: oldTask.priority,
      } : undefined,
      newValue: {
        title: updates.title,
        type: updates.type,
        due_date: updates.due_date,
        priority: updates.priority,
      },
      source: 'manual',
    });

    if (updates.status === 'completed') {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.contact_id) {
        await supabase
          .from('contacts')
          .update({ last_interaction_date: new Date().toISOString() })
          .eq('id', task.contact_id);
      }
    }

    return data;
  }, [tasks, userId, logEvent]);

  const toggleComplete = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const eventType = newStatus === 'completed' ? 'completed' : 'reopened';

    await logEvent({
      taskId,
      userId: userId!,
      eventType,
      oldValue: { status: currentStatus },
      newValue: { status: newStatus },
      source: 'manual',
    });

    return updateTask(taskId, {
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined,
    });
  }, [updateTask, userId, logEvent]);

  const deleteTask = useCallback(async (taskId: string) => {
    setError(null);
    const task = tasks.find(t => t.id === taskId);

    await logEvent({
      taskId,
      userId: userId!,
      eventType: 'deleted',
      oldValue: task ? { title: task.title, type: task.type } : undefined,
      source: 'manual',
    });

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) setError('Could not delete task. Please try again.');
  }, [tasks, userId, logEvent]);

  const now = new Date();

  const todayTasks = tasks.filter(t =>
    t.status !== 'completed' && t.due_date && isToday(new Date(t.due_date))
  );
  const overdueTasks = tasks.filter(t =>
    t.status !== 'completed' && t.due_date &&
    isBefore(new Date(t.due_date), startOfDay(now)) &&
    !isToday(new Date(t.due_date))
  );
  const upcomingTasks = tasks.filter(t =>
    t.status !== 'completed' && t.due_date && isAfter(new Date(t.due_date), endOfDay(now))
  );
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const pendingTasks = tasks.filter(t => t.status !== 'completed');

  return {
    tasks, loading, error, clearError,
    todayTasks, overdueTasks, upcomingTasks,
    completedTasks, pendingTasks,
    createTask, updateTask, toggleComplete, deleteTask,
    refetch: fetchTasks,
  };
}
