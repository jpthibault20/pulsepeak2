'use client';

import React, { createContext, useContext } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plan     = 'free' | 'dev' | 'pro';
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
    | 'generate-plan'
    | 'regenerate-workout'
    | 'custom-plan-theme'
    | 'annual-stats'
    | 'advanced-stats'
    | 'chat-ai';

// Pour l'avenir : quand le plan 'pro' sera actif, toutes les features y seront incluses
const FEATURE_PLANS: Record<Feature, Plan[]> = {
    'generate-plan':      ['pro'],
    'regenerate-workout': ['pro'],
    'custom-plan-theme':  ['pro'],
    'annual-stats':       ['pro'],
    'advanced-stats':     ['pro'],
    'chat-ai':            ['pro'],
};

/**
 * admin, freeUse et le plan 'dev' ont accès illimité à toutes les features.
 * Le plan 'dev' = accès complet pendant la phase bêta (offre 5€/mois).
 */
export function hasFullAccess(role: UserRole, plan: Plan = 'free'): boolean {
    return role === 'admin' || role === 'freeUse' || plan === 'dev';
}

/**
 * Détermine si un utilisateur peut accéder à une feature donnée.
 * - free  → aucun accès (redirection vers upgrade)
 * - dev   → accès complet (phase bêta)
 * - pro   → accès selon FEATURE_PLANS (futur)
 * - admin/freeUse → accès complet
 */
export function canAccess(feature: Feature, plan: Plan, role: UserRole = 'user'): boolean {
    if (hasFullAccess(role, plan)) return true;
    if (plan === 'free') return false;
    return FEATURE_PLANS[feature].includes(plan);
}

/** Retourne true si l'utilisateur est sur le plan gratuit (sans abonnement actif). */
export function isFreePlan(plan: Plan, role: UserRole = 'user'): boolean {
    return plan === 'free' && role !== 'admin' && role !== 'freeUse';
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
