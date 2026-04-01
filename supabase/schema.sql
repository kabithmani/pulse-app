-- ============================================
-- PULSE APP — Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- CONTACTS TABLE
-- People your users interact with
-- ============================================
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- TASKS TABLE
-- Tasks, follow-ups, reminders, habits
-- ============================================
create type task_type as enum ('task', 'follow_up', 'reminder', 'habit');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type repeat_type as enum ('none', 'daily', 'weekly', 'monthly', 'custom');

create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  type task_type default 'task' not null,
  priority task_priority default 'medium' not null,
  status task_status default 'pending' not null,
  due_date timestamptz,
  due_time time,
  repeat repeat_type default 'none' not null,
  contact_id uuid references public.contacts(id) on delete set null,
  context text,  -- what was discussed, why this task exists
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- TASK NOTES TABLE
-- Notes, updates, and history on tasks
-- ============================================
create table public.task_notes (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now() not null
);

-- ============================================
-- USER PREFERENCES TABLE
-- Per-user settings
-- ============================================
create table public.user_preferences (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  display_name text,
  morning_briefing_time time default '08:00:00',
  notification_enabled boolean default true,
  timezone text default 'Asia/Kolkata',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- This is what keeps each user's data private
-- Nobody — not even you — can see another user's data
-- ============================================

-- Enable RLS on all tables
alter table public.contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.task_notes enable row level security;
alter table public.user_preferences enable row level security;

-- Contacts: users can only CRUD their own contacts
create policy "Users can view own contacts"
  on public.contacts for select using (auth.uid() = user_id);
create policy "Users can create own contacts"
  on public.contacts for insert with check (auth.uid() = user_id);
create policy "Users can update own contacts"
  on public.contacts for update using (auth.uid() = user_id);
create policy "Users can delete own contacts"
  on public.contacts for delete using (auth.uid() = user_id);

-- Tasks: users can only CRUD their own tasks
create policy "Users can view own tasks"
  on public.tasks for select using (auth.uid() = user_id);
create policy "Users can create own tasks"
  on public.tasks for insert with check (auth.uid() = user_id);
create policy "Users can update own tasks"
  on public.tasks for update using (auth.uid() = user_id);
create policy "Users can delete own tasks"
  on public.tasks for delete using (auth.uid() = user_id);

-- Task Notes: users can only CRUD their own notes
create policy "Users can view own task notes"
  on public.task_notes for select using (auth.uid() = user_id);
create policy "Users can create own task notes"
  on public.task_notes for insert with check (auth.uid() = user_id);
create policy "Users can update own task notes"
  on public.task_notes for update using (auth.uid() = user_id);
create policy "Users can delete own task notes"
  on public.task_notes for delete using (auth.uid() = user_id);

-- User Preferences: users can only CRUD their own preferences
create policy "Users can view own preferences"
  on public.user_preferences for select using (auth.uid() = user_id);
create policy "Users can create own preferences"
  on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own preferences"
  on public.user_preferences for update using (auth.uid() = user_id);

-- ============================================
-- INDEXES for fast queries
-- ============================================
create index idx_tasks_user_id on public.tasks(user_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_type on public.tasks(type);
create index idx_tasks_contact on public.tasks(contact_id);
create index idx_contacts_user_id on public.contacts(user_id);
create index idx_task_notes_task on public.task_notes(task_id);

-- ============================================
-- AUTO-UPDATE updated_at timestamps
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function update_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function update_updated_at();

create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function update_updated_at();

-- ============================================
-- REALTIME — Enable for instant cross-device sync
-- ============================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.contacts;
