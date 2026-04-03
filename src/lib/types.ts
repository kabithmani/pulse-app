export type TaskType = 'task' | 'follow_up' | 'reminder' | 'habit';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  due_time?: string;
  repeat: RepeatType;
  recurrence_days?: number;
  contact_id?: string;
  context?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  notes?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskNote {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  display_name?: string;
  morning_briefing_time: string;
  notification_enabled: boolean;
  timezone: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  due_date?: string;
  due_time?: string;
  repeat: RepeatType;
  recurrence_days?: number;
  contact_id?: string;
  context?: string;
}

export interface ParsedInput {
  title: string;
  type: TaskType;
  priority: TaskPriority;
  due_date?: string;
  due_time?: string;
  person?: string;
}
