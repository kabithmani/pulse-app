import { ParsedInput, TaskType, TaskPriority } from './types';
import { addDays, addHours, setHours, setMinutes, startOfTomorrow, startOfToday, nextMonday } from 'date-fns';

// Parses natural language like "Call Amit about pricing tomorrow 11am"
// into structured task data
export function parseTaskInput(input: string): ParsedInput {
  const lower = input.toLowerCase().trim();
  
  const result: ParsedInput = {
    title: input.trim(),
    type: 'task',
    priority: 'medium',
  };

  // ── Detect task type ──
  if (/\b(follow[- ]?up|check[- ]?in|ping|reach out|get back to)\b/.test(lower)) {
    result.type = 'follow_up';
  } else if (/\b(remind|reminder|don'?t forget|remember to)\b/.test(lower)) {
    result.type = 'reminder';
  } else if (/\b(every day|daily|each morning|each evening|habit)\b/.test(lower)) {
    result.type = 'habit';
  } else if (/\b(call|email|send|message|text|meet|meeting|schedule)\b/.test(lower)) {
    result.type = 'follow_up';
  }

  // ── Detect priority ──
  if (/\b(urgent|asap|immediately|critical|emergency)\b/.test(lower)) {
    result.priority = 'urgent';
  } else if (/\b(important|high priority|priority)\b/.test(lower)) {
    result.priority = 'high';
  } else if (/\b(low priority|whenever|no rush|not urgent)\b/.test(lower)) {
    result.priority = 'low';
  }

  // ── Detect date ──
  const now = new Date();
  
  if (/\btoday\b/.test(lower)) {
    result.due_date = startOfToday().toISOString();
  } else if (/\btomorrow\b/.test(lower)) {
    result.due_date = startOfTomorrow().toISOString();
  } else if (/\bday after tomorrow\b/.test(lower)) {
    result.due_date = addDays(startOfToday(), 2).toISOString();
  } else if (/\bnext week\b/.test(lower)) {
    result.due_date = nextMonday(now).toISOString();
  } else if (/\bin (\d+) days?\b/.test(lower)) {
    const match = lower.match(/\bin (\d+) days?\b/);
    if (match) result.due_date = addDays(startOfToday(), parseInt(match[1])).toISOString();
  } else if (/\bin (\d+) hours?\b/.test(lower)) {
    const match = lower.match(/\bin (\d+) hours?\b/);
    if (match) result.due_date = addHours(now, parseInt(match[1])).toISOString();
  } else if (/\bmonday\b/.test(lower)) {
    result.due_date = nextMonday(now).toISOString();
  }

  // ── Detect time ──
  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3];
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    result.due_time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // If no date was set, assume today
    if (!result.due_date) {
      const dateWithTime = setMinutes(setHours(now, hours), minutes);
      result.due_date = dateWithTime.toISOString();
    }
  } else if (/\bmorning\b/.test(lower)) {
    result.due_time = '09:00';
    if (!result.due_date) result.due_date = startOfToday().toISOString();
  } else if (/\bafternoon\b/.test(lower)) {
    result.due_time = '14:00';
    if (!result.due_date) result.due_date = startOfToday().toISOString();
  } else if (/\bevening\b/.test(lower)) {
    result.due_time = '18:00';
    if (!result.due_date) result.due_date = startOfToday().toISOString();
  }

  // ── Detect person name ──
  // Patterns: "with [Name]", "to [Name]", "[Name] about", "call [Name]"
  const personPatterns = [
    /\b(?:with|to|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /\b(?:call|email|text|message|ping|meet)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:about|regarding|on|for)/,
  ];
  
  for (const pattern of personPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      // Filter out common false positives
      const name = match[1];
      const falsePositives = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Today', 'Tomorrow', 'Morning', 'Afternoon', 'Evening', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      if (!falsePositives.includes(name)) {
        result.person = name;
        break;
      }
    }
  }

  // ── Clean up the title ──
  // Remove date/time words from title for cleaner display
  let cleanTitle = result.title;
  cleanTitle = cleanTitle.replace(/\b(today|tomorrow|day after tomorrow|next week|next monday)\b/gi, '');
  cleanTitle = cleanTitle.replace(/\b(in \d+ (?:days?|hours?))\b/gi, '');
  cleanTitle = cleanTitle.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');
  cleanTitle = cleanTitle.replace(/\b(morning|afternoon|evening)\b/gi, '');
  cleanTitle = cleanTitle.replace(/\b(urgent|asap|important|high priority|low priority|no rush)\b/gi, '');
  cleanTitle = cleanTitle.replace(/\s{2,}/g, ' ').trim();
  
  if (cleanTitle.length > 3) {
    result.title = cleanTitle;
  }

  return result;
}
