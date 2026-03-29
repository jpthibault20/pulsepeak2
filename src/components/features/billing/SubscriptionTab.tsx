'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
    Check, Lock, Zap, Crown, ArrowRight,
    CreditCard, AlertCircle,
} from 'lucide-react';
import { useSubscription, type Plan } from '@/lib/subscription/context';

// ─── Données des plans ────────────────────────────────────────────────────────

interface PlanConfig {
    id:          Plan;
    name:        string;
    price:       string;
    priceLabel:  string;
    badge?:      string;
    badgeColor?: string;
    description: string;
    features:    string[];
    cta:         string;
    available:   boolean;    // false = coming soon
    highlighted: boolean;
}

const PLANS: PlanConfig[] = [
    {
        id:          'free',
        name:        'Gratuit',
        price:       '0€',
        priceLabel:  'Pour toujours',
        description: 'Accès en lecture uniquement.',
        features:    [
            'Création de compte',
            'Consultation du profil',
        ],
        cta:         'Plan actuel',
        available:   true,
        highlighted: false,
    },
    {
        id:          'dev',
        name:        'Développeur',
        price:       '5€',
        priceLabel:  '/mois · Offre de lancement',
        badge:       'BÊTA',
        badgeColor:  'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        description: 'Accès complet pendant la phase de développement.',
        features:    [
            'Génération de plans IA',
            'Coach IA illimité',
            'Calendrier d\'entraînement',
            'Stats avancées',
            'Synchronisation Strava',
            'Objectifs & courses',
        ],
        cta:         'Souscrire — 5€/mois',
        available:   true,
        highlighted: true,
    },
    {
        id:          'pro',
        name:        'Pro',
        price:       '20€',
        priceLabel:  '/mois · Version finale',
        badge:       'BIENTÔT',
        badgeColor:  'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
        description: 'L\'abonnement définitif avec toutes les fonctionnalités finalisées.',
        features:    [
            'Tout le plan Développeur',
            'Fonctionnalités finalisées & optimisées',
            'Support prioritaire',
            'Nouvelles features en avant-première',
        ],
        cta:         'Bientôt disponible',
        available:   false,
        highlighted: false,
    },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export function SubscriptionTab() {
    const { plan: currentPlan, status } = useSubscription();
    const router = useRouter();

    const handleSubscribe = (planId: Plan) => {
        if (planId === 'dev') {
            router.push('/checkout?plan=dev');
        }
    };

    return (
        <div className="space-y-6">

            {/* ── Statut actuel ─────────────────────────────────────────── */}
            <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-2xl p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <CreditCard size={18} className="text-slate-600 dark:text-slate-300" />
                    </div>
                    <div className="flex-1">
                        <p className="text-slate-900 dark:text-white font-semibold text-sm">Abonnement actuel</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                            {currentPlan === 'free' && 'Aucun abonnement actif'}
                            {currentPlan === 'dev'  && `Plan Développeur · ${status === 'active' ? 'Actif' : status}`}
                            {currentPlan === 'pro'  && `Plan Pro · ${status === 'active' ? 'Actif' : status}`}
                        </p>
                    </div>
                    <span className={`
                        px-2.5 py-1 rounded-full text-xs font-bold border
                        ${currentPlan === 'free' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600' : ''}
                        ${currentPlan === 'dev'  ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' : ''}
                        ${currentPlan === 'pro'  ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' : ''}
                    `}>
                        {currentPlan === 'free' ? 'GRATUIT' : currentPlan === 'dev' ? 'DEV BÊTA' : 'PRO'}
                    </span>
                </div>

                {currentPlan === 'free' && (
                    <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/15 rounded-xl p-3">
                        <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-amber-600 dark:text-amber-300/80 text-xs leading-relaxed">
                            Sans abonnement, aucune fonctionnalité n&apos;est disponible. Souscrivez à l&apos;offre Développeur pour accéder à l&apos;application.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Plans ─────────────────────────────────────────────────── */}
            <div className="space-y-3">
                {PLANS.map(plan => {
                    const isActive    = currentPlan === plan.id;
                    const isLocked    = !plan.available;
                    const isCurrent   = isActive;

                    return (
                        <div
                            key={plan.id}
                            className={`
                                relative rounded-2xl border p-5 transition-all
                                ${plan.highlighted && !isCurrent
                                    ? 'border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/5'
                                    : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/40'
                                }
                                ${isCurrent ? 'border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/5' : ''}
                                ${isLocked  ? 'opacity-60' : ''}
                            `}
                        >
                            {/* Badge actif */}
                            {isCurrent && (
                                <div className="absolute -top-2.5 left-4">
                                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                        PLAN ACTIF
                                    </span>
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    {/* Nom + badge */}
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-slate-900 dark:text-white font-bold">{plan.name}</span>
                                        {plan.badge && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.badgeColor}`}>
                                                {plan.badge}
                                            </span>
                                        )}
                                        {isLocked && (
                                            <Lock size={11} className="text-slate-500" />
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-xs mb-3">{plan.description}</p>

                                    {/* Features */}
                                    <ul className="space-y-1.5">
                                        {plan.features.map(f => (
                                            <li key={f} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <Check size={11} className={isLocked ? 'text-slate-500 dark:text-slate-600' : 'text-emerald-600 dark:text-emerald-400'} />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Prix */}
                                <div className="text-right shrink-0">
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{plan.price}</div>
                                    <div className="text-slate-500 text-[10px] leading-tight max-w-[90px]">{plan.priceLabel}</div>
                                </div>
                            </div>

                            {/* CTA */}
                            {!isCurrent && (
                                <div className="mt-4 pt-4 border-t border-slate-300/50 dark:border-slate-700/50">
                                    {plan.id === 'dev' && (
                                        <button
                                            onClick={() => handleSubscribe(plan.id)}
                                            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-lg shadow-amber-900/20"
                                        >
                                            <Zap size={14} />
                                            {plan.cta}
                                            <ArrowRight size={14} />
                                        </button>
                                    )}
                                    {plan.id === 'pro' && (
                                        <button
                                            disabled
                                            className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-500 font-semibold py-2.5 rounded-xl text-sm cursor-not-allowed border border-slate-300 dark:border-slate-600"
                                        >
                                            <Crown size={14} />
                                            {plan.cta}
                                        </button>
                                    )}
                                    {plan.id === 'free' && currentPlan !== 'free' && (
                                        <button
                                            disabled
                                            className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold py-2.5 rounded-xl text-sm cursor-not-allowed"
                                        >
                                            Rétrograder
                                        </button>
                                    )}
                                </div>
                            )}

                            {isCurrent && plan.id === 'dev' && (
                                <div className="mt-4 pt-4 border-t border-slate-300/50 dark:border-slate-700/50">
                                    <p className="text-slate-500 text-xs text-center">
                                        Gestion de l&apos;abonnement via Stripe · Disponible prochainement
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Note bêta ─────────────────────────────────────────────── */}
            <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-300/50 dark:border-slate-700/50 rounded-xl p-4">
                <p className="text-slate-500 text-xs leading-relaxed text-center">
                    PulsePeak est en phase de développement actif. L&apos;offre à 5€/mois donne accès à toutes les fonctionnalités actuelles.
                    Le tarif passera à 20€/mois lors de la version finale.
                    <span className="block mt-1 text-slate-500 dark:text-slate-600">Intégration paiement Stripe en cours.</span>
                </p>
            </div>
        </div>
    );
}
