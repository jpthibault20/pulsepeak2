'use client';

import React, { createContext, useContext } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plan     = 'free' | 'pro' | 'elite';
export type Status   = 'active' | 'trial' | 'past_due' | 'cancelled';
export type UserRole = 'user' | 'freeUse' | 'admin';

export interface Subscription {
    plan:   Plan;
    status: Status;
    role:   UserRole;
    trialEndsAt?:       string | null;
    currentPeriodEnd?:  string | null;
    cancelAtPeriodEnd?: boolean;
}

// ─── Feature map ──────────────────────────────────────────────────────────────

export type Feature =
    | 'regenerate-workout'
    | 'custom-plan-theme'
    | 'annual-stats'
    | 'advanced-stats'
    | 'chat-ai';

const FEATURE_PLANS: Record<Feature, Plan[]> = {
    'regenerate-workout': ['pro', 'elite'],
    'custom-plan-theme':  ['pro', 'elite'],
    'annual-stats':       ['pro', 'elite'],
    'advanced-stats':     ['pro', 'elite'],
    'chat-ai':            ['elite'],
};

/** admin et freeUse ont accès illimité à toutes les features */
export function hasFullAccess(role: UserRole): boolean {
    return role === 'admin' || role === 'freeUse';
}

export function canAccess(feature: Feature, plan: Plan, role: UserRole = 'user'): boolean {
    if (hasFullAccess(role)) return true;
    return FEATURE_PLANS[feature].includes(plan);
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<Subscription>({
    plan:   'free',
    status: 'active',
    role:   'user',
});

interface SubscriptionProviderProps {
    children:      React.ReactNode;
    subscription?: Partial<Subscription>;
}

export function SubscriptionProvider({ children, subscription }: SubscriptionProviderProps) {
    const value: Subscription = {
        plan:              subscription?.plan   ?? 'free',
        status:            subscription?.status ?? 'active',
        role:              subscription?.role   ?? 'user',
        trialEndsAt:       subscription?.trialEndsAt      ?? null,
        currentPeriodEnd:  subscription?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    };
    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription(): Subscription {
    return useContext(SubscriptionContext);
}
