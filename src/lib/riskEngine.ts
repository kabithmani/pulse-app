import { Task } from './types';
import { differenceInHours, differenceInDays, isPast, isToday, isTomorrow, startOfDay } from 'date-fns';

export type RiskLevel = 'high' | 'medium' | 'safe' | 'no_date';

export interface ScoredTask extends Task {
  risk: RiskLevel;
  riskReason: string;
}

export interface EAInsight {
  greeting: string;
  icon: string;
  headline: string;
  details: string[];
  mood: 'calm' | 'alert' | 'urgent';
}

// ── Score a single task ──
export function scoreTask(task: Task): ScoredTask {
  // Completed tasks are always safe
  if (task.status === 'completed') {
    return { ...task, risk: 'safe', riskReason: 'Completed' };
  }

  // No due date = no_date (still needs attention)
  if (!task.due_date) {
    return { ...task, risk: 'no_date', riskReason: 'No due date set' };
  }

  const now = new Date();
  const due = new Date(task.due_date);
  const hoursUntilDue = differenceInHours(due, now);
  const daysUntilDue = differenceInDays(startOfDay(due), startOfDay(now));

  // HIGH RISK: overdue or due within 4 hours
  if (isPast(due) && !isToday(due)) {
    const daysOverdue = Math.abs(daysUntilDue);
    return {
      ...task,
      risk: 'high',
      riskReason: `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`,
    };
  }

  if (isToday(due) && isPast(due)) {
    return { ...task, risk: 'high', riskReason: 'Due time has passed today' };
  }

  if (isToday(due) && hoursUntilDue <= 4 && hoursUntilDue >= 0) {
    return { ...task, risk: 'high', riskReason: `Due in ${hoursUntilDue} hour${hoursUntilDue !== 1 ? 's' : ''}` };
  }

  // Follow-ups that are overdue are always high risk
  if (task.type === 'follow_up' && isPast(due)) {
    return { ...task, risk: 'high', riskReason: 'Follow-up overdue' };
  }

  // MEDIUM RISK: due today or tomorrow
  if (isToday(due)) {
    return { ...task, risk: 'medium', riskReason: 'Due today' };
  }

  if (isTomorrow(due)) {
    return { ...task, risk: 'medium', riskReason: 'Due tomorrow' };
  }

  // Follow-ups due within 3 days are medium risk
  if (task.type === 'follow_up' && daysUntilDue <= 3) {
    return { ...task, risk: 'medium', riskReason: `Follow-up due in ${daysUntilDue} days` };
  }

  // Urgent/high priority tasks due within 3 days are medium risk
  if ((task.priority === 'urgent' || task.priority === 'high') && daysUntilDue <= 3) {
    return { ...task, risk: 'medium', riskReason: `High priority, due in ${daysUntilDue} days` };
  }

  // SAFE: everything else
  return { ...task, risk: 'safe', riskReason: `Due in ${daysUntilDue} days` };
}

// ── Score all tasks ──
export function scoreAllTasks(tasks: Task[]): ScoredTask[] {
  return tasks
    .filter(t => t.status !== 'completed')
    .map(scoreTask)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, no_date: 2, safe: 3 };
      return order[a.risk] - order[b.risk];
    });
}

// ── Generate EA insight (the "Your EA says" message) ──
export function generateEAInsight(tasks: Task[], userName: string): EAInsight {
  const scored = scoreAllTasks(tasks);
  const highRisk = scored.filter(t => t.risk === 'high');
  const medium = scored.filter(t => t.risk === 'medium');
  const noDate = scored.filter(t => t.risk === 'no_date');
  const followUps = scored.filter(t => t.type === 'follow_up' && t.risk !== 'safe');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const icon = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙';

  const details: string[] = [];

  // Nothing pending at all
  if (scored.length === 0) {
    return {
      greeting,
      icon,
      headline: `${userName}, you're all clear.`,
      details: ['No pending tasks. Enjoy your day!'],
      mood: 'calm',
    };
  }

  // URGENT mood
  if (highRisk.length > 0) {
    const overdueCount = highRisk.filter(t => t.riskReason.includes('Overdue')).length;
    const dueSoonCount = highRisk.length - overdueCount;

    if (overdueCount > 0) {
      details.push(`${overdueCount} item${overdueCount !== 1 ? 's are' : ' is'} overdue — handle ${overdueCount === 1 ? 'it' : 'these'} first.`);
    }
    if (dueSoonCount > 0) {
      details.push(`${dueSoonCount} item${dueSoonCount !== 1 ? 's are' : ' is'} due very soon.`);
    }

    // Name the most critical item
    const topItem = highRisk[0];
    const personNote = topItem.contact ? ` with ${topItem.contact.name}` : '';
    details.push(`Most urgent: "${topItem.title}"${personNote} — ${topItem.riskReason.toLowerCase()}.`);

    return {
      greeting,
      icon,
      headline: `${userName}, you have ${highRisk.length} item${highRisk.length !== 1 ? 's' : ''} that need${highRisk.length === 1 ? 's' : ''} immediate attention.`,
      details,
      mood: 'urgent',
    };
  }

  // ALERT mood (medium risk items)
  if (medium.length > 0) {
    details.push(`${medium.length} item${medium.length !== 1 ? 's' : ''} due today or tomorrow.`);

    if (followUps.length > 0) {
      const names = followUps
        .filter(t => t.contact)
        .map(t => t.contact!.name)
        .slice(0, 2);
      if (names.length > 0) {
        details.push(`Follow up with ${names.join(' and ')}.`);
      }
    }

    if (noDate.length > 0) {
      details.push(`${noDate.length} task${noDate.length !== 1 ? 's have' : ' has'} no due date — consider setting one.`);
    }

    return {
      greeting,
      icon,
      headline: `${userName}, a few things need your focus today.`,
      details,
      mood: 'alert',
    };
  }

  // CALM mood
  if (noDate.length > 0) {
    details.push(`${noDate.length} task${noDate.length !== 1 ? 's have' : ' has'} no due date.`);
  }
  details.push(`${scored.filter(t => t.risk === 'safe').length} task${scored.filter(t => t.risk === 'safe').length !== 1 ? 's' : ''} on track — nothing urgent.`);

  return {
    greeting,
    icon,
    headline: `${userName}, you're in good shape.`,
    details,
    mood: 'calm',
  };
}
