'use client';

import { TaskAlert } from '@/hooks/useTaskAlerts';

interface AlertToastProps {
  alerts: TaskAlert[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

const typeStyles = {
  overdue: { bg: 'rgba(255,59,48,0.08)', border: 'rgba(255,59,48,0.2)', icon: '🔴', color: '#FF3B30' },
  due_soon: { bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.2)', icon: '🟠', color: '#FF9500' },
  follow_up: { bg: 'rgba(88,86,214,0.08)', border: 'rgba(88,86,214,0.2)', icon: '🔄', color: '#5856D6' },
};

export default function AlertToast({ alerts, onDismiss, onDismissAll }: AlertToastProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-4 pointer-events-none">
      <div className="max-w-2xl mx-auto space-y-2">
        {alerts.slice(0, 3).map((alert, i) => {
          const style = typeStyles[alert.type];
          return (
            <div
              key={alert.id}
              className="rounded-xl p-3 pointer-events-auto"
              style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                animation: `slide-down 0.3s ease-out ${i * 0.08}s both`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: style.color }}>
                    {alert.title}
                  </p>
                  <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>
                    {alert.message}
                  </p>
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-xs font-medium shrink-0 px-2 py-1 rounded-lg"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {alerts.length > 1 && (
          <button
            onClick={onDismissAll}
            className="text-xs font-medium px-3 py-1.5 rounded-lg pointer-events-auto mx-auto block"
            style={{ color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            Dismiss all ({alerts.length})
          </button>
        )}
      </div>
    </div>
  );
}
