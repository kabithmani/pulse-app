'use client';

interface MorningBriefingProps {
  name: string;
  todayCount: number;
  overdueCount: number;
  followUpCount: number;
}

export default function MorningBriefing({ name, todayCount, overdueCount, followUpCount }: MorningBriefingProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const icon = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙';

  const hasTasks = todayCount > 0 || overdueCount > 0;

  return (
    <div className="mt-6 mb-6 rounded-2xl p-5"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <p className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {icon} {greeting}, {name}
      </p>
      {hasTasks ? (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          You have <strong style={{ color: 'var(--text-primary)' }}>{todayCount} item{todayCount !== 1 ? 's' : ''}</strong> due today
          {followUpCount > 0 && (
            <>, including <strong style={{ color: 'var(--accent)' }}>{followUpCount} follow-up{followUpCount !== 1 ? 's' : ''}</strong></>
          )}
          {overdueCount > 0 && (
            <>, and <strong style={{ color: 'var(--danger)' }}>{overdueCount} overdue item{overdueCount !== 1 ? 's' : ''}</strong> that need{overdueCount === 1 ? 's' : ''} attention</>
          )}
          .
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          You're all caught up. Nothing due today! 🎉
        </p>
      )}
    </div>
  );
}
