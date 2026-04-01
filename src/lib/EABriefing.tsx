'use client';

import { EAInsight } from '@/lib/riskEngine';

interface EABriefingProps {
  insight: EAInsight;
}

export default function EABriefing({ insight }: EABriefingProps) {
  const moodStyles = {
    urgent: {
      background: 'linear-gradient(135deg, rgba(255,59,48,0.06), rgba(255,149,0,0.06))',
      border: 'rgba(255,59,48,0.15)',
      headlineColor: 'var(--danger)',
    },
    alert: {
      background: 'linear-gradient(135deg, rgba(255,149,0,0.06), rgba(0,122,255,0.04))',
      border: 'rgba(255,149,0,0.15)',
      headlineColor: 'var(--warning)',
    },
    calm: {
      background: 'var(--bg-secondary)',
      border: 'var(--border)',
      headlineColor: 'var(--success)',
    },
  };

  const style = moodStyles[insight.mood];

  return (
    <div className="mt-6 mb-6 rounded-2xl p-5" style={{ background: style.background, border: `1px solid ${style.border}` }}>
      {/* Greeting */}
      <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
        {insight.icon} {insight.greeting}
      </p>

      {/* EA Label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          YOUR EA SAYS
        </span>
      </div>

      {/* Headline */}
      <p className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {insight.headline}
      </p>

      {/* Details */}
      <div className="space-y-1.5">
        {insight.details.map((detail, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {i === 0 && insight.mood === 'urgent' && <span style={{ color: 'var(--danger)' }}>⚠ </span>}
            {i === 0 && insight.mood === 'alert' && <span style={{ color: 'var(--warning)' }}>→ </span>}
            {i === 0 && insight.mood === 'calm' && <span style={{ color: 'var(--success)' }}>✓ </span>}
            {i > 0 && '  '}
            {detail}
          </p>
        ))}
      </div>
    </div>
  );
}
