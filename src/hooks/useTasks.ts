'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Task, TaskFormData } from '@/lib/types';
import { startOfDay, endOfDay, isBefore, isToday, isAfter } from 'date-fns';

export function useTasks(userId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all tasks for the user
  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*, contact:contacts(*)')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching tasks:', error);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }, [userId]);

  // Subscribe to real-time changes (cross-device sync)
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

  // Create a new task
  const createTask = useCallback(async (formData: TaskFormData) => {
    if (!userId) return null;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...formData, user_id: userId, status: 'pending' })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return null;
    }
    return data;
  }, [userId]);

  // Update a task
  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return null;
    }
    return data;
  }, []);

  // Toggle task completion
  const toggleComplete = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    return updateTask(taskId, { 
      status: newStatus, 
      completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined 
    });
  }, [updateTask]);

  // Delete a task
  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error('Error deleting task:', error);
  }, []);

  // ── Filtered views ──
  const now = new Date();

  const todayTasks = tasks.filter(t => 
    t.status !== 'completed' && t.due_date && isToday(new Date(t.due_date))
  );

  const overdueTasks = tasks.filter(t => 
    t.status !== 'completed' && t.due_date && isBefore(new Date(t.due_date), startOfDay(now)) && !isToday(new Date(t.due_date))
  );

  const upcomingTasks = tasks.filter(t => 
    t.status !== 'completed' && t.due_date && isAfter(new Date(t.due_date), endOfDay(now))
  );

  const completedTasks = tasks.filter(t => t.status === 'completed');

  const pendingTasks = tasks.filter(t => t.status !== 'completed');

  return {
    tasks,
    loading,
    todayTasks,
    overdueTasks,
    upcomingTasks,
    completedTasks,
    pendingTasks,
    createTask,
    updateTask,
    toggleComplete,
    deleteTask,
    refetch: fetchTasks,
  };
}
