'use client';

import { useState, useRef, useEffect } from 'react';
import { Contact, TaskFormData, TaskType, TaskPriority, RepeatType } from '@/lib/types';
import { parseTaskInput } from '@/lib/parser';

interface QuickAddProps {
  contacts: Contact[];
  onClose: () => void;
  onSubmit: (data: TaskFormData) => void;
}

export default function QuickAdd({ contacts, onClose, onSubmit }: QuickAddProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTranscriptRef = useRef('');

  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatType>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<number | undefined>(undefined);
  const [contactId, setContactId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDueDate(today);
    inputRef.current?.focus();
  }, []);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');

      setInput(transcript);
      latestTranscriptRef.current = transcript;

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        recognition.stop();
        const parsed = parseTaskInput(latestTranscriptRef.current);
        if (parsed.type !== 'task') setType(parsed.type);
        if (parsed.priority !== 'medium') setPriority(parsed.priority);
        if (parsed.due_date) {
          const d = new Date(parsed.due_date);
          setDueDate(d.toISOString().split('T')[0]);
        }
        if (parsed.due_time) setDueTime(parsed.due_time);
      }, 2000);
    };

    recognition.onerror = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const setQuickDate = (label: string) => {
    const today = new Date();
    let target: Date;
    switch (label) {
      case 'today': target = today; break;
      case 'tomorrow': target = new Date(today.getTime() + 86400000); break;
      case 'next_week': target = new Date(today.getTime() + 7 * 86400000); break;
      default: target = today;
    }
    setDueDate(target.toISOString().split('T')[0]);
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSubmit({
      title: input.trim(),
      description: description || undefined,
      type,
      priority,
      due_date: dueDate ? new Date(dueDate + 'T00:00:00').toISOString() : undefined,
      due_time: dueTime || undefined,
      repeat,
      recurrence_days: recurrenceDays,
      contact_id: contactId || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') onClose();
  };

  const formatSelectedDate = () => {
    if (!dueDate) return 'No date';
    const d = new Date(dueDate + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const recurrenceLabel = () => {
    if (!recurrenceDays) return null;
    const options: Record<number, string> = {
      3: 'every 3 days', 7: 'every week',
      14: 'every 2 weeks', 30: 'every month',
      60: 'every 2 months', 90: 'every 3 months',
    };
    return options[recurrenceDays] || `every ${recurrenceDays} days`;
  };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up safe-bottom"
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }}>
        <div className="p-5 max-w-2xl mx-auto">

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>New task</h2>
              {recurrenceDays && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>
                  🔁 Repeats {recurrenceLabel()} after completion
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Cancel
            </button>
          </div>

          {/* Main input */}
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="What needs to be done?"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={isListening ? stopListening : startListening}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative"
              style={{ background: isListening ? '#FF3B30' : 'var(--accent)' }}>
              {isListening && (
                <span className="absolute inset-0 rounded-full animate-pulse-ring"
                  style={{ background: 'rgba(255,59,48,0.3)' }} />
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Type selector */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto">
            {([
              { value: 'task', label: 'Task', icon: '📋' },
              { value: 'follow_up', label: 'Follow-up', icon: '🔄' },
              { value: 'reminder', label: 'Reminder', icon: '⏰' },
              { value: 'habit', label: 'Habit', icon: '🔁' },
            ] as { value: TaskType; label: string; icon: string }[]).map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className="text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1"
                style={{
                  background: type === t.value ? 'var(--text-primary)' : 'var(--bg-secondary)',
                  color: type === t.value ? 'var(--bg)' : 'var(--text-secondary)',
                  border: type === t.value ? 'none' : '1px solid var(--border)',
                }}>
                <span className="text-[11px]">{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Date selection */}
          <div className="mb-3">
            <div className="flex gap-1.5 mb-2">
              {['today', 'tomorrow', 'next_week'].map(label => (
                <button key={label} onClick={() => setQuickDate(label)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium capitalize"
                  style={{
                    background: formatSelectedDate().toLowerCase() === label.replace('_', ' ') || 
                      (label === 'today' && formatSelectedDate() === 'Today') ||
                      (label === 'tomorrow' && formatSelectedDate() === 'Tomorrow')
                      ? '#E5F1FF' : 'var(--bg-secondary)',
                    color: (label === 'today' && formatSelectedDate() === 'Today') ||
                      (label === 'tomorrow' && formatSelectedDate() === 'Tomorrow')
                      ? '#007AFF' : 'var(--text-secondary)',
                    border: `1px solid ${(label === 'today' && formatSelectedDate() === 'Today') ||
                      (label === 'tomorrow' && formatSelectedDate() === 'Tomorrow')
                      ? '#007AFF30' : 'var(--border)'}`,
                  }}>
                  {label === 'next_week' ? 'Next week' : label.charAt(0).toUpperCase() + label.slice(1)}
                </button>
              ))}
              <button onClick={() => setDueDate('')}
                className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{
                  background: !dueDate ? '#FFF0EF' : 'var(--bg-secondary)',
                  color: !dueDate ? '#FF3B30' : 'var(--text-tertiary)',
                  border: `1px solid ${!dueDate ? '#FF3B3030' : 'var(--border)'}`,
                }}>
                No date
              </button>
            </div>
            <div className="flex gap-2">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                className="w-28 text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
            </div>
          </div>

          <button onClick={() => setShowMore(!showMore)}
            className="text-xs font-medium mb-3"
            style={{ color: 'var(--accent)' }}>
            {showMore ? '− Less options' : '+ Priority, repeat, contact, notes'}
          </button>

          {showMore && (
            <div className="space-y-3 mb-4">
              {/* Priority */}
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
                  <button key={p} onClick={() => setPriority(p)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium capitalize"
                    style={{
                      background: priority === p ? 'var(--text-primary)' : 'var(--bg-secondary)',
                      color: priority === p ? 'var(--bg)' : 'var(--text-secondary)',
                      border: priority === p ? 'none' : '1px solid var(--border)',
                    }}>
                    {p}
                  </button>
                ))}
              </div>

              {/* Recurring follow-up */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  🔁 Auto-repeat after completion
                </label>
                <select
                  value={recurrenceDays ?? ''}
                  onChange={e => setRecurrenceDays(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: `1px solid ${recurrenceDays ? 'var(--accent)' : 'var(--border)'}` }}>
                  <option value="">Never — complete once and done</option>
                  <option value="3">Every 3 days</option>
                  <option value="7">Every week</option>
                  <option value="14">Every 2 weeks</option>
                  <option value="30">Every month</option>
                  <option value="60">Every 2 months</option>
                  <option value="90">Every 3 months</option>
                </select>
                {recurrenceDays && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    When you complete this, a new one appears {recurrenceLabel()} later automatically.
                  </p>
                )}
              </div>

              {/* Contact */}
              {contacts.length > 0 && (
                <select value={contactId} onChange={e => setContactId(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  <option value="">No contact linked</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                  ))}
                </select>
              )}

              {/* Notes */}
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Add notes or context..."
                rows={2}
                className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
            </div>
          )}

          <button onClick={handleSubmit}
            disabled={!input.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--accent)' }}>
            Add task
          </button>
        </div>
      </div>
    </>
  );
}
