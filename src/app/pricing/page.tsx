import React from 'react';
import Link from 'next/link';
import { Check, Lock, Zap, Crown, ArrowLeft, Shield } from 'lucide-react';

export const metadata = { title: 'Tarifs · PulsePeak' };

// ─── Données statiques (Server Component, pas besoin de 'use client') ─────────

const plans = [
    {
        id:          'free',
        name:        'Gratuit',
        price:       '0€',
        priceDetail: 'Pour toujours',
        badge:       null,
        badgeColor:  '',
        description: 'Créez votre compte et explorez l\'interface.',
        features: [
            { label: 'Création de compte',          included: true  },
            { label: 'Consultation du profil',       included: true  },
            { label: 'Génération de plans IA',       included: false },
            { label: 'Coach IA',                     included: false },
            { label: 'Calendrier d\'entraînement',   included: false },
            { label: 'Stats & analyse',              included: false },
            { label: 'Synchronisation Strava',       included: false },
        ],
        cta:         null,
        ctaHref:     null,
        available:   false,
        highlighted: false,
    },
    {
        id:          'dev',
        name:        'Développeur',
        price:       '5€',
        priceDetail: '/mois · Offre de lancement',
        badge:       'BÊTA',
        badgeColor:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
        description: 'Accès complet pendant la phase de développement. Prix réduit car l\'app évolue encore.',
        features: [
            { label: 'Tout le plan Gratuit',                    included: true },
            { label: 'Génération de plans IA',                  included: true },
            { label: 'Coach IA illimité',                       included: true },
            { label: 'Calendrier d\'entraînement complet',      included: true },
            { label: 'Stats avancées & analyse de performance', included: true },
            { label: 'Synchronisation Strava',                  included: true },
            { label: 'Objectifs & courses',                     included: true },
        ],
        cta:         'Souscrire — 5€/mois',
        ctaHref:     '/checkout?plan=dev',
        available:   true,
        highlighted: true,
    },
    {
        id:          'pro',
        name:        'Pro',
        price:       '20€',
        priceDetail: '/mois · Version finale',
        badge:       'BIENTÔT',
        badgeColor:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
        description: 'L\'abonnement définitif avec toutes les fonctionnalités finalisées et optimisées.',
        features: [
            { label: 'Tout le plan Développeur',                   included: true  },
            { label: 'Fonctionnalités finalisées & optimisées',    included: true  },
            { label: 'Support prioritaire',                        included: true  },
            { label: 'Nouvelles features en avant-première',       included: true  },
            { label: 'Garantie de stabilité & performances',       included: true  },
        ],
        cta:         'Bientôt disponible',
        ctaHref:     null,
        available:   false,
        highlighted: false,
    },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white">

            {/* Header */}
            <div className="border-b border-slate-800 px-4 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                    >
                        <ArrowLeft size={16} />
                        Retour à l&apos;application
                    </Link>
                    <span className="text-white font-bold tracking-tight">PulsePeak</span>
                </div>
            </div>

            {/* Hero */}
            <div className="max-w-4xl mx-auto px-4 pt-12 pb-6 text-center">
                <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-amber-300 text-xs font-semibold mb-4">
                    <Zap size={12} />
                    Phase de développement actif
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                    Choisissez votre plan
                </h1>
                <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
                    PulsePeak est en version bêta. Accédez à toutes les fonctionnalités
                    dès maintenant pour 5€/mois. Le tarif passera à 20€/mois lors de la sortie officielle.
                </p>
            </div>

            {/* Plans grid */}
            <div className="max-w-4xl mx-auto px-4 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plans.map(plan => (
                        <div
                            key={plan.id}
                            className={`
                                relative rounded-2xl border p-6 flex flex-col
                                ${plan.highlighted
                                    ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-slate-900 shadow-xl shadow-amber-900/10'
                                    : 'border-slate-800 bg-slate-900/60'
                                }
                                ${!plan.available && plan.id !== 'free' ? 'opacity-70' : ''}
                            `}
                        >
                            {/* Badge highlight */}
                            {plan.highlighted && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-amber-500 text-slate-950 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg">
                                        ✦ RECOMMANDÉ
                                    </span>
                                </div>
                            )}

                            {/* Plan name + badge */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-white font-bold text-lg">{plan.name}</span>
                                {plan.badge && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.badgeColor}`}>
                                        {plan.badge}
                                    </span>
                                )}
                                {!plan.available && plan.id === 'pro' && (
                                    <Lock size={12} className="text-slate-500" />
                                )}
                            </div>

                            {/* Price */}
                            <div className="mb-3">
                                <span className="text-4xl font-bold text-white">{plan.price}</span>
                                <span className="text-slate-400 text-sm ml-1">{plan.priceDetail}</span>
                            </div>

                            {/* Description */}
                            <p className="text-slate-400 text-sm leading-relaxed mb-5">{plan.description}</p>

                            {/* Features */}
                            <ul className="space-y-2.5 flex-1 mb-6">
                                {plan.features.map(f => (
                                    <li key={f.label} className="flex items-start gap-2.5 text-sm">
                                        {f.included
                                            ? <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                                            : <span className="w-3.5 h-3.5 mt-0.5 shrink-0 flex items-center justify-center text-slate-700 text-lg leading-none">—</span>
                                        }
                                        <span className={f.included ? 'text-slate-300' : 'text-slate-600'}>
                                            {f.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            {plan.id === 'dev' && plan.ctaHref && (
                                <Link
                                    href={plan.ctaHref}
                                    className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-amber-900/30 text-sm"
                                >
                                    <Zap size={14} />
                                    {plan.cta}
                                </Link>
                            )}
                            {plan.id === 'pro' && (
                                <button
                                    disabled
                                    className="flex items-center justify-center gap-2 bg-slate-800 text-slate-500 font-semibold py-3 rounded-xl text-sm cursor-not-allowed border border-slate-700 w-full"
                                >
                                    <Crown size={14} />
                                    {plan.cta}
                                </button>
                            )}
                            {plan.id === 'free' && (
                                <Link
                                    href="/"
                                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl transition-colors text-sm"
                                >
                                    Continuer gratuitement
                                </Link>
                            )}
                        </div>
                    ))}
                </div>

                {/* Garanties */}
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    {[
                        { icon: Shield,  label: 'Sans engagement',    desc: 'Résiliez à tout moment depuis votre profil' },
                        { icon: Zap,     label: 'Accès immédiat',      desc: 'Disponible dès la confirmation du paiement' },
                        { icon: Crown,   label: 'Prix bêta garanti',   desc: 'Tarif 5€ maintenu pendant toute la bêta' },
                    ].map(g => {
                        const Icon = g.icon;
                        return (
                            <div key={g.label} className="flex flex-col items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                    <Icon size={15} className="text-slate-400" />
                                </div>
                                <p className="text-white text-sm font-semibold">{g.label}</p>
                                <p className="text-slate-500 text-xs">{g.desc}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Note paiement */}
                <p className="text-center text-slate-600 text-xs mt-8">
                    Paiement sécurisé par Stripe · Intégration en cours de finalisation
                </p>
            </div>
        </div>
    );
}
