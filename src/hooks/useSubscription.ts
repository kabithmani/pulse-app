'use client';

import { useMemo } from 'react';
import { User } from '@supabase/supabase-js';

const TRIAL_DAYS = 90; // 3 months
const PRICE_INR = 199;

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'unknown';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  daysRemaining: number;
  trialStarted: Date | null;
  isExpired: boolean;
  isTrial: boolean;
  isActive: boolean;
  priceINR: number;
  trialDaysTotal: number;
}

export function useSubscription(user: User | null): SubscriptionInfo {
  return useMemo(() => {
    if (!user) return {
      status: 'unknown', daysRemaining: 0, trialStarted: null,
      isExpired: false, isTrial: false, isActive: false,
      priceINR: PRICE_INR, trialDaysTotal: TRIAL_DAYS,
    };

    const meta = user.user_metadata || {};
    const status: SubscriptionStatus = meta.subscription_status || 'trial';

    // Active paying subscriber — never show paywall
    if (status === 'active') return {
      status: 'active', daysRemaining: 999, trialStarted: null,
      isExpired: false, isTrial: false, isActive: true,
      priceINR: PRICE_INR, trialDaysTotal: TRIAL_DAYS,
    };

    // Calculate trial days
    const trialStarted = meta.trial_started_at
      ? new Date(meta.trial_started_at)
      : new Date(user.created_at); // fallback to account creation

    const daysSinceStart = Math.floor(
      (Date.now() - trialStarted.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = Math.max(0, TRIAL_DAYS - daysSinceStart);
    const isExpired = daysRemaining === 0;

    return {
      status: isExpired ? 'expired' : 'trial',
      daysRemaining,
      trialStarted,
      isExpired,
      isTrial: !isExpired,
      isActive: false,
      priceINR: PRICE_INR,
      trialDaysTotal: TRIAL_DAYS,
    };
  }, [user]);
}
