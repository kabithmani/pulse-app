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
  const [showDetails, setShowDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Form state for detailed mode
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatType>('none');
  const [contactId, setContactId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Voice Input ──
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Indian English, change as needed

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // ── Submit ──
  const handleSubmit = () => {
    if (!input.trim()) return;

    if (showDetails) {
      // Use detailed form fields
      onSubmit({
        title: input.trim(),
        description: description || undefined,
        type,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        due_time: dueTime || undefined,
        repeat,
        contact_id: contactId || undefined,
      });
    } else {
      // Parse natural language
      const parsed = parseTaskInput(input);
      onSubmit({
        title: parsed.title,
        type: parsed.type,
        priority: parsed.priority,
        due_date: parsed.due_date,
        due_time: parsed.due_time,
        contact_id: parsed.person ? '__new__' : undefined,
        context: parsed.person, // Will be used to find/create contact
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') onClose();
  };

  // Show parsed preview
  const parsed = input.trim() ? parseTaskInput(input) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up safe-bottom"
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }}>
        <div className="p-5 max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>New task</h2>
            <button onClick={onClose} className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Cancel
            </button>
          </div>

          {/* Main input with mic */}
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder='Try: "Call Amit about pricing tomorrow 11am"'
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

          {/* Smart parse preview */}
          {parsed && !showDetails && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-[10px] px-2 py-1 rounded-full font-medium"
                style={{ background: '#E5F1FF', color: '#007AFF' }}>
                {parsed.type.replace('_', ' ')}
              </span>
              {parsed.due_date && (
                <span className="text-[10px] px-2 py-1 rounded-full font-medium"
                  style={{ background: '#EEFBF2', color: '#34C759' }}>
                  {new Date(parsed.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  {parsed.due_time && ` ${parsed.due_time}`}
                </span>
              )}
              {parsed.person && (
                <span className="text-[10px] px-2 py-1 rounded-full font-medium"
                  style={{ background: '#F3F0FF', color: '#5856D6' }}>
                  {parsed.person}
                </span>
              )}
              {parsed.priority !== 'medium' && (
                <span className="text-[10px] px-2 py-1 rounded-full font-medium"
                  style={{
                    background: parsed.priority === 'urgent' ? '#FFF0EF' : '#FFF7ED',
                    color: parsed.priority === 'urgent' ? '#FF3B30' : '#FF9500',
                  }}>
                  {parsed.priority}
                </span>
              )}
            </div>
          )}

          {/* Toggle for detailed mode */}
          <button onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-medium mb-3"
            style={{ color: 'var(--accent)' }}>
            {showDetails ? 'Use smart input' : 'Add more details'}
          </button>

          {/* Detailed form fields */}
          {showDetails && (
            <div className="space-y-3 mb-4">
              {/* Type selector */}
              <div className="flex gap-2">
                {(['task', 'follow_up', 'reminder', 'habit'] as TaskType[]).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium"
                    style={{
                      background: type === t ? 'var(--text-primary)' : 'var(--bg-secondary)',
                      color: type === t ? 'var(--bg)' : 'var(--text-secondary)',
                      border: type === t ? 'none' : '1px solid var(--border)',
                    }}>
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>

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

              {/* Date and time */}
              <div className="flex gap-2">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
                <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                  className="w-28 text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
              </div>

              {/* Repeat */}
              <select value={repeat} onChange={e => setRepeat(e.target.value as RepeatType)}
                className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>

              {/* Contact */}
              <select value={contactId} onChange={e => setContactId(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                <option value="">No contact linked</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                ))}
              </select>

              {/* Description */}
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Add notes or context..."
                rows={2}
                className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
            </div>
          )}

          {/* Submit */}
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
