'use client';

type FilterMode = 'all' | 'today' | 'overdue' | 'upcoming' | 'completed';

interface TaskFiltersProps {
  active: FilterMode;
  onChange: (filter: FilterMode) => void;
  counts: Record<FilterMode, number>;
}

const filters: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Done' },
];

export default function TaskFilters({ active, onChange, counts }: TaskFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
      {filters.map(f => {
        const isActive = active === f.key;
        const isOverdue = f.key === 'overdue' && counts.overdue > 0;

        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
            style={{
              background: isActive
                ? (isOverdue ? 'var(--danger)' : 'var(--text-primary)')
                : 'var(--bg-secondary)',
              color: isActive ? 'var(--bg)' : 'var(--text-secondary)',
              border: isActive ? 'none' : '1px solid var(--border)',
            }}>
            {f.label}
            {counts[f.key] > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : (isOverdue ? 'var(--danger)' : 'var(--bg-tertiary)'),
                  color: isActive ? 'var(--bg)' : (isOverdue ? 'white' : 'var(--text-secondary)'),
                }}>
                {counts[f.key]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
