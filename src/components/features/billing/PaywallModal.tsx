'use client';

import React from 'react';
import { Lock, Sparkles, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Feature } from '@/lib/subscription/context';

// ─── Contenu par feature ──────────────────────────────────────────────────────

const FEATURE_CONTENT: Record<Feature, {
    title:       string;
    description: string;
    requiredPlan: 'PRO' | 'ELITE';
    highlights:  string[];
}> = {
    'regenerate-workout': {
        title:        'Régénération IA · Feature PRO',
        description:  "Laissez l'IA adapter chaque séance à vos sensations du moment, votre fatigue et vos objectifs.",
        requiredPlan: 'PRO',
        highlights: [
            'Régénérations illimitées',
            'Instructions personnalisées',
            'IA contextuelle sur vos feedbacks',
        ],
    },
    'custom-plan-theme': {
        title:        'Thème personnalisé · Feature PRO',
        description:  "Décrivez librement votre objectif et l'IA construit un plan sur mesure, durée incluse.",
        requiredPlan: 'PRO',
        highlights: [
            'Description libre en langage naturel',
            'Durée de 1 à 8 semaines',
            'Tous les sports du triathlon',
        ],
    },
    'annual-stats': {
        title:        'Statistiques annuelles · Feature PRO',
        description:  "Visualisez votre progression sur toute la saison avec le comparatif Planifié / Réalisé.",
        requiredPlan: 'PRO',
        highlights: [
            'Graphique annuel Planifié vs Réalisé',
            'Historique illimité',
            'Analyse par sport',
        ],
    },
    'advanced-stats': {
        title:        'Stats avancées · Feature PRO',
        description:  "Accédez à la monotonie d'entraînement et l'index d'intensité pour éviter le surentraînement.",
        requiredPlan: 'PRO',
        highlights: [
            'Indice de monotonie',
            'TSS hebdomadaire détaillé',
            'Alertes surcharge',
        ],
    },
    'chat-ai': {
        title:        'Coach IA conversationnel · Feature ELITE',
        description:  "Discutez avec votre coach IA pour des conseils personnalisés, analyses tactiques et motivation.",
        requiredPlan: 'ELITE',
        highlights: [
            'Chat illimité avec l\'IA',
            'Analyse biomécanique',
            'Recommandations nutrition',
        ],
    },
};

// ─── Composant ────────────────────────────────────────────────────────────────

interface PaywallModalProps {
    feature: Feature;
    isOpen:  boolean;
    onClose: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ feature, isOpen, onClose }) => {
    const router = useRouter();
    const content = FEATURE_CONTENT[feature];

    if (!isOpen) return null;

    const planParam = content.requiredPlan.toLowerCase();

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Close */}
                <div className="flex justify-end p-3 pb-0">
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 pb-6 space-y-5">
                    {/* Icône hero */}
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Lock size={28} className="text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{content.title}</h3>
                            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{content.description}</p>
                        </div>
                    </div>

                    {/* Features highlight */}
                    <ul className="space-y-2">
                        {content.highlights.map((h) => (
                            <li key={h} className="flex items-center gap-2.5 text-sm text-slate-300">
                                <Check size={14} className="text-emerald-400 shrink-0" />
                                {h}
                            </li>
                        ))}
                    </ul>

                    {/* CTAs */}
                    <div className="space-y-2 pt-1">
                        <button
                            onClick={() => { onClose(); router.push(`/pricing?highlight=${planParam}`); }}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/30"
                        >
                            <Sparkles size={16} />
                            Essayer {content.requiredPlan} — 14 jours gratuits
                        </button>
                        <button
                            onClick={() => { onClose(); router.push('/pricing'); }}
                            className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                        >
                            Voir tous les plans
                        </button>
                    </div>

                    <p className="text-center text-xs text-slate-600">
                        Aucun engagement · Annulez à tout moment
                    </p>
                </div>
            </div>
        </div>
    );
};
