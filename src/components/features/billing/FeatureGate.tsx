'use client';

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useSubscription, canAccess, type Feature } from '@/lib/subscription/context';
import { PaywallModal } from './PaywallModal';

interface FeatureGateProps {
    feature:  Feature;
    mode?:    'modal' | 'blur' | 'replace';
    label?:   string;
    children: React.ReactNode;
}

export function FeatureGate({ feature, mode = 'modal', label, children }: FeatureGateProps) {
    const { plan, role } = useSubscription();
    const [showPaywall, setShowPaywall] = useState(false);

    const allowed = canAccess(feature, plan, role);
    if (allowed) return <>{children}</>;

    // ── modal : children visibles mais clics interceptés ──────────────────────
    if (mode === 'modal') {
        return (
            <>
                <div
                    className="relative cursor-pointer"
                    onClick={() => setShowPaywall(true)}
                >
                    <div className="pointer-events-none opacity-60 select-none">
                        {children}
                    </div>
                </div>
                <PaywallModal
                    isOpen={showPaywall}
                    onClose={() => setShowPaywall(false)}
                    feature={feature}
                    label={label}
                />
            </>
        );
    }

    // ── blur : children floutés avec badge lock ────────────────────────────────
    if (mode === 'blur') {
        return (
            <>
                <div className="relative">
                    <div className="blur-sm pointer-events-none select-none">{children}</div>
                    <div
                        className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        onClick={() => setShowPaywall(true)}
                    >
                        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 rounded-full px-4 py-2 shadow-lg backdrop-blur-sm">
                            <Lock size={13} className="text-blue-400" />
                            <span className="text-xs font-semibold text-white">{label ?? 'Plan Athlete'}</span>
                        </div>
                    </div>
                </div>
                <PaywallModal
                    isOpen={showPaywall}
                    onClose={() => setShowPaywall(false)}
                    feature={feature}
                    label={label}
                />
            </>
        );
    }

    // ── replace : placeholder avec icône lock ─────────────────────────────────
    return (
        <>
            <button
                onClick={() => setShowPaywall(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-500 text-sm hover:border-blue-500/40 hover:text-blue-400 transition-colors"
            >
                <Lock size={13} />
                {label ?? 'Fonctionnalité Pro'}
            </button>
            <PaywallModal
                isOpen={showPaywall}
                onClose={() => setShowPaywall(false)}
                feature={feature}
                label={label}
            />
        </>
    );
}
