'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '@/lib/types';
import { differenceInMinutes, isPast, isToday } from 'date-fns';

export interface TaskAlert {
  id: string;
  taskId: string;
  title: string;
  message: string;
  type: 'overdue' | 'due_soon' | 'follow_up';
  timestamp: number;
}

// Generate a short alert tone using Web Audio API (no external files needed)
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 880; // A5
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);
    
    // Second tone (slightly higher, slight delay)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1108; // C#6
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);
    
    // Clean up after sounds finish
    setTimeout(() => ctx.close(), 1000);
  } catch (e) {
    // Audio not available — fail silently
  }
}

// Vibrate if supported (Android Chrome — iOS blocks this)
function vibrateDevice() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]); // buzz-pause-buzz pattern
    }
  } catch (e) {
    // Vibration not available
  }
}

// Request browser notification permission
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Send a browser notification (shows even if tab is in background)
function sendBrowserNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'pulse-alert', // Replaces previous notification instead of stacking
      });
    } catch (e) {
      // Notification not available
    }
  }
}

export function useTaskAlerts(tasks: Task[]) {
  const [alerts, setAlerts] = useState<TaskAlert[]>([]);
  const firedAlertsRef = useRef<Set<string>>(new Set());

  const checkTasks = useCallback(() => {
    if (!tasks || tasks.length === 0) return;

    const now = new Date();
    const newAlerts: TaskAlert[] = [];

    for (const task of tasks) {
      if (task.status === 'completed') continue;
      if (!task.due_date) continue;

      const due = new Date(task.due_date);
      const minutesUntil = differenceInMinutes(due, now);
      const alertKey = `${task.id}-${due.toISOString().slice(0, 13)}`; // unique per task per hour

      // Skip if already alerted for this task this hour
      if (firedAlertsRef.current.has(alertKey)) continue;

      // ALERT: Task is due within 15 minutes
      if (minutesUntil >= 0 && minutesUntil <= 15 && isToday(due)) {
        firedAlertsRef.current.add(alertKey);
        const mins = Math.max(1, minutesUntil);
        newAlerts.push({
          id: `alert-${task.id}-${Date.now()}`,
          taskId: task.id,
          title: `Due in ${mins} minute${mins !== 1 ? 's' : ''}`,
          message: task.title,
          type: 'due_soon',
          timestamp: Date.now(),
        });
      }

      // ALERT: Task just became overdue (within last 5 minutes)
      if (minutesUntil < 0 && minutesUntil >= -5 && isToday(due)) {
        const overdueKey = `overdue-${task.id}-${due.toISOString().slice(0, 13)}`;
        if (!firedAlertsRef.current.has(overdueKey)) {
          firedAlertsRef.current.add(overdueKey);
          newAlerts.push({
            id: `alert-${task.id}-${Date.now()}`,
            taskId: task.id,
            title: 'Task is now overdue',
            message: task.title,
            type: 'overdue',
            timestamp: Date.now(),
          });
        }
      }

      // ALERT: Follow-up not done for 3+ days
      if (task.type === 'follow_up' && isPast(due)) {
        const daysPast = Math.floor(-minutesUntil / 1440);
        if (daysPast >= 3) {
          const followUpKey = `followup-${task.id}-${new Date().toDateString()}`;
          if (!firedAlertsRef.current.has(followUpKey)) {
            firedAlertsRef.current.add(followUpKey);
            const personName = task.contact?.name || '';
            newAlerts.push({
              id: `alert-${task.id}-${Date.now()}`,
              taskId: task.id,
              title: personName ? `Follow up with ${personName}` : 'Follow-up overdue',
              message: `${task.title} — ${daysPast} days overdue`,
              type: 'follow_up',
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    if (newAlerts.length > 0) {
      // Fire sound + vibration for the first alert
      playAlertSound();
      vibrateDevice();

      // Send browser notification (works in background tabs)
      const topAlert = newAlerts[0];
      sendBrowserNotification(topAlert.title, topAlert.message);

      // Add to in-app alert list
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10)); // keep last 10
    }
  }, [tasks]);

  // Check every 60 seconds
  useEffect(() => {
    // Initial check after 2 seconds (let tasks load first)
    const initialTimeout = setTimeout(checkTasks, 2000);

    // Then check every 60 seconds
    const interval = setInterval(checkTasks, 60000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkTasks]);

  // Dismiss an alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Dismiss all alerts
  const dismissAll = useCallback(() => {
    setAlerts([]);
  }, []);

  return { alerts, dismissAlert, dismissAll };
}
