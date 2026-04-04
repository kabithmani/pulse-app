'use client';

import { SubscriptionInfo } from '@/hooks/useSubscription';

interface Props {
  sub: SubscriptionInfo;
}

export default function SubscriptionBanner({ sub }: Props) {
  // Active users or early trial (> 30 days remaining) — no banner
  if (sub.isActive || sub.daysRemaining > 30) return null;

  if (sub.isExpired) {
    return (
      <div className="sticky top-0 z-50 px-4 py-3 text-center"
        style={{ background: '#E24B4A', color: 'white' }}>
        <p className="text-sm font-semibold">Your free trial has ended</p>
        <p className="text-xs mt-0.5 opacity-90">
          Your data is safe. Subscribe for ₹{sub.priceINR}/month to continue adding tasks.
        </p>
        <a
          href="mailto:kabith.mani@gmail.com?subject=Pulse subscription"
          className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'white', color: '#E24B4A' }}>
          Subscribe — ₹{sub.priceINR}/month
        </a>
      </div>
    );
  }

  // Warning — 1–30 days left
  return (
    <div className="sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between"
      style={{ background: '#BA7517', color: 'white' }}>
      <p className="text-xs font-medium">
        ⏱ {sub.daysRemaining} day{sub.daysRemaining !== 1 ? 's' : ''} left in your free trial
      </p>
      <a
        href="mailto:kabith.mani@gmail.com?subject=Pulse subscription"
        className="text-xs font-semibold px-3 py-1 rounded-full ml-3 shrink-0"
        style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
        ₹{sub.priceINR}/mo
      </a>
    </div>
  );
}
