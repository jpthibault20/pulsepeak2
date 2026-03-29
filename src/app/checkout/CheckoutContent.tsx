'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    ArrowLeft, Check, Lock, Shield, CreditCard,
    Zap, Info,
} from 'lucide-react';

// ─── Données plan ─────────────────────────────────────────────────────────────

const PLAN_DATA = {
    dev: {
        name:        'Plan Développeur',
        price:       '5€',
        billing:     'par mois · sans engagement',
        description: 'Accès complet à toutes les fonctionnalités PulsePeak pendant la phase bêta.',
        features: [
            'Génération de plans IA personnalisés',
            'Coach IA illimité',
            'Calendrier d\'entraînement complet',
            'Stats avancées & analyse de performance',
            'Synchronisation Strava',
            'Objectifs & courses cibles',
        ],
        badgeLabel: 'BÊTA',
        badgeColor: 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    },
} as const;

type PlanKey = keyof typeof PLAN_DATA;

// ─── Composant ────────────────────────────────────────────────────────────────

export function CheckoutContent() {
    const searchParams = useSearchParams();
    const planParam = searchParams.get('plan') as PlanKey | null;
    const plan = planParam && planParam in PLAN_DATA ? PLAN_DATA[planParam] : PLAN_DATA.dev;

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">

            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <Link
                        href="/pricing"
                        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        Retour aux offres
                    </Link>
                    <span className="text-slate-900 dark:text-white font-bold tracking-tight">PulsePeak</span>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-10">
                <h1 className="text-2xl font-bold mb-2">Finaliser votre abonnement</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Vérifiez les détails ci-dessous avant de procéder au paiement.</p>

                <div className="grid grid-cols-1 gap-6">

                    {/* ── Récapitulatif commande ─────────────────────────── */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-5">
                        <h2 className="text-slate-900 dark:text-white font-semibold text-sm mb-4 flex items-center gap-2">
                            <CreditCard size={15} className="text-slate-500 dark:text-slate-400" />
                            Récapitulatif
                        </h2>

                        <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-slate-900 dark:text-white font-bold">{plan.name}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.badgeColor}`}>
                                        {plan.badgeLabel}
                                    </span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">{plan.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-2xl font-bold text-slate-900 dark:text-white">{plan.price}</span>
                                <p className="text-slate-500 text-xs">{plan.billing}</p>
                            </div>
                        </div>

                        {/* Features incluses */}
                        <ul className="space-y-2 mb-4">
                            {plan.features.map(f => (
                                <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    {f}
                                </li>
                            ))}
                        </ul>

                        {/* Total */}
                        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">Total mensuel</span>
                            <span className="text-slate-900 dark:text-white font-bold">{plan.price}/mois</span>
                        </div>
                    </div>

                    {/* ── Informations de facturation (placeholder) ──────── */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-5">
                        <h2 className="text-slate-900 dark:text-white font-semibold text-sm mb-4">Informations de facturation</h2>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1.5">Nom complet</label>
                                <input
                                    type="text"
                                    placeholder="Jean Dupont"
                                    disabled
                                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 placeholder-slate-400 dark:placeholder-slate-600 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1.5">Email</label>
                                <input
                                    type="email"
                                    placeholder="vous@email.com"
                                    disabled
                                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 placeholder-slate-400 dark:placeholder-slate-600 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 text-xs mb-1.5">Carte bancaire</label>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 flex items-center gap-2">
                                    <CreditCard size={14} className="text-slate-400 dark:text-slate-600" />
                                    <span className="text-slate-400 dark:text-slate-600 text-sm">Formulaire Stripe · bientôt disponible</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Notice Stripe ───────────────────────────────────── */}
                    <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                        <Info size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-amber-600 dark:text-amber-300 text-sm font-semibold mb-0.5">
                                Paiement en cours d&apos;intégration
                            </p>
                            <p className="text-amber-600/60 dark:text-amber-300/60 text-xs leading-relaxed">
                                L&apos;intégration Stripe est en cours de finalisation.
                                Le bouton de paiement sera activé prochainement.
                                Pour accéder à l&apos;application dès maintenant, contactez-nous.
                            </p>
                        </div>
                    </div>

                    {/* ── Bouton paiement (désactivé — dépend de Stripe) ── */}
                    <div>
                        <button
                            disabled
                            className="w-full flex items-center justify-center gap-2.5 bg-slate-200 dark:bg-slate-700 text-slate-500 font-semibold py-4 rounded-2xl text-sm cursor-not-allowed border border-slate-300 dark:border-slate-600"
                        >
                            <Lock size={15} />
                            Payer {plan.price}/mois avec Stripe
                            <span className="text-slate-400 dark:text-slate-600 text-xs font-normal ml-1">(intégration en cours)</span>
                        </button>

                        {/* Garanties */}
                        <div className="flex items-center justify-center gap-4 mt-4 text-slate-500 dark:text-slate-600 text-xs flex-wrap">
                            <span className="flex items-center gap-1">
                                <Shield size={11} />
                                Paiement sécurisé
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                                <Zap size={11} />
                                Sans engagement
                            </span>
                            <span>·</span>
                            <span>Résiliation à tout moment</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
