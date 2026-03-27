'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, X, Zap, Trophy, User, Sparkles, ArrowLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'monthly' | 'annual';
type PlanId = 'free' | 'pro' | 'elite';

interface PricingFeature {
    label:    string;
    included: boolean;
    pro?:     boolean; // mis en avant
}

interface PricingPlan {
    id:          PlanId;
    name:        string;
    tagline:     string;
    monthlyPrice: number;
    annualPrice:  number;    // prix mensuel si annuel
    icon:        React.ReactNode;
    badge?:      string;
    features:    PricingFeature[];
    ctaLabel:    string;
    ctaVariant:  'primary' | 'outline' | 'secondary';
    highlighted: boolean;
}

// ─── Données des plans ────────────────────────────────────────────────────────

const PLANS: PricingPlan[] = [
    {
        id:           'free',
        name:         'Starter',
        tagline:      'Pour commencer',
        monthlyPrice: 0,
        annualPrice:  0,
        icon:         <User size={20} />,
        features: [
            { label: 'Calendrier d\'entraînement',         included: true },
            { label: '1 génération IA / mois',             included: true },
            { label: 'Bloc de 4 semaines maximum',         included: true },
            { label: 'Sync Strava (lecture seule)',        included: true },
            { label: 'Profil athlète + calibration FTP',   included: true },
            { label: 'Générations illimitées',             included: false },
            { label: 'Régénération individuelle IA',       included: false },
            { label: 'Stats avancées + analyse annuelle',  included: false },
            { label: 'Chat IA conversationnel',            included: false },
        ],
        ctaLabel:    'Commencer gratuitement',
        ctaVariant:  'outline',
        highlighted: false,
    },
    {
        id:           'pro',
        name:         'Athlete',
        tagline:      'Pour progresser',
        monthlyPrice: 9.99,
        annualPrice:  7.42,  // 89 € / 12
        icon:         <Zap size={20} />,
        badge:        'Populaire',
        features: [
            { label: 'Tout Starter inclus',                included: true },
            { label: 'Générations IA illimitées',          included: true, pro: true },
            { label: 'Régénération individuelle IA',       included: true, pro: true },
            { label: 'Thème personnalisé (1–8 semaines)',  included: true, pro: true },
            { label: 'Stats avancées + analyse annuelle',  included: true, pro: true },
            { label: 'Sync Strava avec feedback auto',     included: true },
            { label: 'Historique illimité',                included: true },
            { label: 'Personnalité IA (Strict / Coach…)',  included: true },
            { label: 'Chat IA conversationnel',            included: false },
        ],
        ctaLabel:    'Essayer PRO — 14 jours gratuits',
        ctaVariant:  'primary',
        highlighted: true,
    },
    {
        id:           'elite',
        name:         'Champion',
        tagline:      'Pour performer',
        monthlyPrice: 19.99,
        annualPrice:  14.92, // 179 € / 12
        icon:         <Trophy size={20} />,
        badge:        'Performance',
        features: [
            { label: 'Tout Athlete inclus',                included: true },
            { label: 'Chat IA conversationnel illimité',   included: true, pro: true },
            { label: 'Analyse biomécanique IA',            included: true, pro: true },
            { label: 'Export PDF plans d\'entraînement',   included: true },
            { label: 'Recommandations nutrition',          included: true },
            { label: 'Support prioritaire',                included: true },
            { label: 'Badge Champion dans le profil',      included: true },
            { label: 'Accès anticipé nouvelles features',  included: true },
        ],
        ctaLabel:    'Choisir Champion',
        ctaVariant:  'secondary',
        highlighted: false,
    },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PricingPage() {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const highlight    = searchParams.get('highlight') as PlanId | null;

    const [period, setPeriod] = useState<Period>('monthly');

    const discount = Math.round((1 - 7.42 / 9.99) * 100); // ~26%

    return (
        <div className="min-h-screen bg-slate-950 pb-20">

            {/* Déco background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/5 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-5xl mx-auto px-4 py-12">

                {/* Retour */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 text-sm"
                >
                    <ArrowLeft size={16} />
                    Retour
                </button>

                {/* Hero */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Progressez comme<br className="hidden md:block" /> un athlète pro
                    </h1>
                    <p className="text-slate-400 text-lg max-w-xl mx-auto">
                        Plans adaptés à votre niveau et vos objectifs de triathlon. Annulez à tout moment.
                    </p>

                    {/* Toggle mensuel / annuel */}
                    <div className="inline-flex items-center mt-8 bg-slate-800 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setPeriod('monthly')}
                            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                                period === 'monthly'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Mensuel
                        </button>
                        <button
                            onClick={() => setPeriod('annual')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                                period === 'annual'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Annuel
                            <span className={`text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold transition-all ${
                                period === 'annual' ? 'opacity-100' : 'opacity-60'
                            }`}>
                                -{discount}%
                            </span>
                        </button>
                    </div>
                </div>

                {/* Grille des plans */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PLANS.map((plan) => {
                        const isHighlighted = plan.highlighted || plan.id === highlight;
                        const price = period === 'annual' ? plan.annualPrice : plan.monthlyPrice;

                        return (
                            <div
                                key={plan.id}
                                className={`relative flex flex-col rounded-2xl border p-6 md:p-7 transition-all ${
                                    isHighlighted
                                        ? 'bg-slate-900 border-blue-500/50 ring-1 ring-blue-500/30 shadow-xl shadow-blue-900/20'
                                        : 'bg-slate-900/60 border-slate-800'
                                }`}
                            >
                                {/* Badge plan */}
                                {plan.badge && (
                                    <div className="absolute -top-px left-1/2 -translate-x-1/2">
                                        <span className={`text-xs font-bold px-4 py-1 rounded-b-lg ${
                                            plan.id === 'pro'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-700 text-slate-300'
                                        }`}>
                                            {plan.badge}
                                        </span>
                                    </div>
                                )}

                                {/* Header */}
                                <div className="flex items-center gap-3 mb-4 mt-2">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                        plan.id === 'pro'    ? 'bg-blue-600/20 text-blue-400' :
                                        plan.id === 'elite'  ? 'bg-purple-500/20 text-purple-400' :
                                        'bg-slate-700 text-slate-400'
                                    }`}>
                                        {plan.icon}
                                    </div>
                                    <div>
                                        <div className="text-white font-bold">{plan.name}</div>
                                        <div className="text-slate-400 text-xs">{plan.tagline}</div>
                                    </div>
                                </div>

                                {/* Prix */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold text-white tabular-nums">
                                            {price === 0 ? '0' : price.toFixed(2).replace('.', ',')}
                                            <span className="text-lg text-slate-400">€</span>
                                        </span>
                                        {price > 0 && (
                                            <span className="text-slate-400 text-sm">/mois</span>
                                        )}
                                    </div>
                                    {period === 'annual' && price > 0 && (
                                        <p className="text-slate-500 text-xs mt-1">
                                            Facturé {(price * 12).toFixed(0)} € / an
                                        </p>
                                    )}
                                </div>

                                {/* Features */}
                                <ul className="space-y-3 flex-1 mb-6">
                                    {plan.features.map((f) => (
                                        <li key={f.label} className="flex items-start gap-2.5">
                                            {f.included ? (
                                                <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                                            ) : (
                                                <X size={15} className="text-slate-600 shrink-0 mt-0.5" />
                                            )}
                                            <span className={`text-sm leading-snug ${
                                                f.included
                                                    ? f.pro ? 'text-slate-200 font-medium' : 'text-slate-300'
                                                    : 'text-slate-600'
                                            }`}>
                                                {f.label}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => router.push(`/billing/upgrade?plan=${plan.id}&period=${period}`)}
                                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                        plan.ctaVariant === 'primary'
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                                            : plan.ctaVariant === 'secondary'
                                            ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                            : 'border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    {plan.id === 'pro' && <Sparkles size={15} />}
                                    {plan.ctaLabel}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Garantie */}
                <p className="text-center text-slate-500 text-sm mt-10">
                    Essai gratuit de 14 jours · Aucune carte requise · Annulation en 1 clic
                </p>
            </div>
        </div>
    );
}
