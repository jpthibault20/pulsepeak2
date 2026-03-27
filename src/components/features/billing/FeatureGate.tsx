'use client';

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useSubscription, canAccess, type Feature } from '@/lib/subscription/context';
import { PaywallModal } from './PaywallModal';

interface FeatureGateProps {
    feature:  Feature;
    children: React.ReactNode;
    /** Mode de blocage :
     *  - 'modal'  : les enfants sont rendus normalement, au clic → PaywallModal (défaut)
     *  - 'blur'   : les enfants sont blurred + overlay avec badge locked
     *  - 'replace': remplace complètement le contenu par un placeholder locked
     */
    mode?:    'modal' | 'blur' | 'replace';
    /** Texte affiché dans le placeholder (mode blur/replace) */
    label?:   string;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
    feature,
    children,
    mode = 'modal',
    label = 'Feature PRO',
}) => {
    const { plan, role } = useSubscription();
    const [showPaywall, setShowPaywall] = useState(false);

    const allowed = canAccess(feature, plan, role);

    if (allowed) return <>{children}</>;

    // ── Mode blur : contenu visible mais inaccessible ──────────────────────────
    if (mode === 'blur') {
        return (
            <>
                <div className="relative group">
                    {/* Contenu flou */}
                    <div className="blur-sm opacity-40 pointer-events-none select-none">
                        {children}
                    </div>

                    {/* Overlay */}
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl"
                        onClick={() => setShowPaywall(true)}
                    >
                        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl px-4 py-3 flex flex-col items-center gap-2 shadow-xl">
                            <Lock size={20} className="text-amber-400" />
                            <span className="text-xs font-semibold text-amber-300">{label}</span>
                            <span className="text-xs text-slate-400 hover:text-white transition-colors underline">Débloquer</span>
                        </div>
                    </div>
                </div>

                <PaywallModal feature={feature} isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
            </>
        );
    }

    // ── Mode replace : placeholder compact ────────────────────────────────────
    if (mode === 'replace') {
        return (
            <>
                <button
                    onClick={() => setShowPaywall(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-500/20 bg-slate-800/40 text-slate-500 hover:opacity-80 transition-opacity cursor-pointer w-full"
                >
                    <Lock size={12} className="text-amber-400/60 group-hover:rotate-12 transition-transform duration-200" />
                    <span className="text-xs">{label}</span>
                </button>

                <PaywallModal feature={feature} isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
            </>
        );
    }

    // ── Mode modal (défaut) : clone les enfants, intercepte le onClick ─────────
    // On wrape dans un div qui capture le clic et ouvre le paywall
    return (
        <>
            <div
                className="relative cursor-pointer group"
                onClick={() => setShowPaywall(true)}
            >
                {/* Badge cadenas discret sur le composant */}
                <div className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Lock size={10} className="text-amber-400" />
                </div>

                {/* Enfants rendus normalement mais pointer-events désactivés */}
                <div className="pointer-events-none opacity-70">
                    {children}
                </div>
            </div>

            <PaywallModal feature={feature} isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
        </>
    );
};
