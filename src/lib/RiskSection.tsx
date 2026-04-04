'use client';

import { ScoredTask } from '@/lib/riskEngine';
import TaskCard from '@/components/TaskCard';
import { Task } from '@/lib/types';

interface RiskSectionProps {
  title: string;
  icon: string;
  tasks: ScoredTask[];
  accentColor: string;
  emptyMessage?: string;
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  myDay?: Set<string>;
  onToggleMyDay?: (id: string) => void;
}

export default function RiskSection({ title, icon, tasks, accentColor, emptyMessage, onToggle, onDelete, onUpdate, myDay, onToggleMyDay }: RiskSectionProps) {
  if (tasks.length === 0 && emptyMessage) return null;
  if (tasks.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-sm">{icon}</span>
        <h3 className="text-xs font-semibold tracking-wide uppercase" style={{ color: accentColor }}>
          {title}
        </h3>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: `${accentColor}15`, color: accentColor }}>
          {tasks.length}
        </span>
      </div>

      {/* Task cards */}
      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task.id} className="relative">
            {/* Risk reason badge */}
            <div className="absolute -top-1 right-3 z-10">
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: `${accentColor}12`, color: accentColor }}>
                {task.riskReason}
              </span>
            </div>
            <TaskCard
              task={task}
              onToggle={() => onToggle(task.id, task.status)}
              onDelete={() => onDelete(task.id)}
              onUpdate={(updates: Partial<Task>) => onUpdate(task.id, updates)}
              myDay={myDay ? myDay.has(task.id) : false}
              onToggleMyDay={onToggleMyDay ? () => onToggleMyDay(task.id) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
