'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Zap, Trophy, User, CheckCircle,
    CreditCard, Calendar, AlertCircle, Sparkles, ExternalLink
} from 'lucide-react';
import { useSubscription } from '@/lib/subscription/context';
import { PlanBadge } from '@/components/features/billing/PlanBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

// ─── Plan details ─────────────────────────────────────────────────────────────

const PLAN_DETAILS = {
    free: {
        name:     'Starter',
        icon:     User,
        color:    'text-slate-400',
        bg:       'bg-slate-700',
        features: [
            'Calendrier d\'entraînement',
            '1 génération IA / mois',
            'Bloc de 4 semaines maximum',
            'Sync Strava (lecture seule)',
            'Profil athlète + calibration FTP',
        ],
    },
    pro: {
        name:     'Athlete',
        icon:     Zap,
        color:    'text-blue-400',
        bg:       'bg-blue-600/20',
        features: [
            'Tout Starter inclus',
            'Générations IA illimitées',
            'Régénération individuelle IA',
            'Thème personnalisé (1–8 semaines)',
            'Stats avancées + analyse annuelle',
            'Sync Strava avec feedback auto',
            'Historique illimité',
            'Personnalité IA (Strict / Coach…)',
        ],
    },
    elite: {
        name:     'Champion',
        icon:     Trophy,
        color:    'text-purple-400',
        bg:       'bg-purple-500/20',
        features: [
            'Tout Athlete inclus',
            'Chat IA conversationnel illimité',
            'Analyse biomécanique IA',
            'Export PDF plans d\'entraînement',
            'Recommandations nutrition',
            'Support prioritaire',
        ],
    },
};

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
    const router = useRouter();
    const { plan, status, trialEndsAt, currentPeriodEnd, cancelAtPeriodEnd } = useSubscription();

    const details = PLAN_DETAILS[plan];
    const PlanIcon = details.icon;

    const isTrial    = status === 'trial';
    const isPastDue  = status === 'past_due';
    const isCancelled = status === 'cancelled';

    return (
        <div className="min-h-screen bg-slate-950 pb-20">

            {/* Background déco */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-600/5 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-2xl mx-auto px-4 py-12">

                {/* Retour */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 text-sm"
                >
                    <ArrowLeft size={16} />
                    Retour
                </button>

                {/* Titre */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">Abonnement</h1>
                    <p className="text-slate-400 text-sm mt-1">Gérez votre plan et vos informations de facturation.</p>
                </div>

                {/* ── Carte plan actuel ── */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${details.bg}`}>
                                <PlanIcon size={20} className={details.color} />
                            </div>
                            <div>
                                <div className="text-white font-bold text-lg">{details.name}</div>
                                <PlanBadge plan={plan} status={status} size="sm" />
                            </div>
                        </div>

                        {plan !== 'free' && (
                            <span className="text-slate-400 text-sm">
                                {plan === 'pro' ? '9,99 €' : '19,99 €'}<span className="text-slate-600">/mois</span>
                            </span>
                        )}
                    </div>

                    {/* Alertes de statut */}
                    {isTrial && trialEndsAt && (
                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4">
                            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-300">
                                Essai gratuit jusqu&apos;au <strong>{formatDate(trialEndsAt)}</strong>.
                                Aucun paiement avant cette date.
                            </p>
                        </div>
                    )}

                    {isPastDue && (
                        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4">
                            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-300">
                                Paiement en échec. Veuillez mettre à jour votre moyen de paiement.
                            </p>
                        </div>
                    )}

                    {cancelAtPeriodEnd && currentPeriodEnd && (
                        <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2.5 mb-4">
                            <AlertCircle size={16} className="text-orange-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-orange-300">
                                Abonnement annulé. Accès jusqu&apos;au <strong>{formatDate(currentPeriodEnd)}</strong>.
                            </p>
                        </div>
                    )}

                    {/* Prochain renouvellement */}
                    {plan !== 'free' && !cancelAtPeriodEnd && currentPeriodEnd && !isPastDue && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                            <Calendar size={14} />
                            Prochain renouvellement : <span className="text-white">{formatDate(currentPeriodEnd)}</span>
                        </div>
                    )}

                    {/* Features incluses */}
                    <ul className="space-y-2 mt-4">
                        {details.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                                {f}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* ── Actions ── */}
                <div className="space-y-3">
                    {plan === 'free' && (
                        <button
                            onClick={() => router.push('/pricing')}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/30"
                        >
                            <Sparkles size={16} />
                            Passer à Athlete — 14 jours gratuits
                        </button>
                    )}

                    {plan !== 'free' && !cancelAtPeriodEnd && !isCancelled && (
                        <button
                            onClick={() => router.push('/pricing')}
                            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors border border-slate-700"
                        >
                            Changer de plan
                        </button>
                    )}

                    {plan !== 'free' && (
                        <button
                            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white py-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors text-sm"
                            onClick={() => {
                                // TODO Phase 4: Stripe customer portal redirect
                                alert('Portail de facturation disponible bientôt.');
                            }}
                        >
                            <CreditCard size={15} />
                            Gérer le paiement
                            <ExternalLink size={12} className="opacity-50" />
                        </button>
                    )}
                </div>

                {/* ── Historique (placeholder) ── */}
                {plan !== 'free' && (
                    <div className="mt-8">
                        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                            <CreditCard size={16} className="text-slate-400" />
                            Historique de facturation
                        </h2>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
                            <p className="text-slate-500 text-sm">
                                L&apos;historique sera disponible après intégration Stripe.
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer légal */}
                <p className="text-center text-slate-600 text-xs mt-10">
                    Questions ? <a href="mailto:support@pulsepeak.fr" className="underline hover:text-slate-400 transition-colors">support@pulsepeak.fr</a>
                </p>
            </div>
        </div>
    );
}
