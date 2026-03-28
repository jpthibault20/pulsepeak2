'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Sparkles, X, Check } from 'lucide-react';
import type { Feature } from '@/lib/subscription/context';

interface PaywallModalProps {
    isOpen:   boolean;
    onClose:  () => void;
    feature:  Feature;
    label?:   string;
}

const FEATURE_CONTENT: Record<Feature, { title: string; desc: string; highlights: string[] }> = {
    'regenerate-workout': {
        title: 'Régénération IA',
        desc:  'Demandez à l\'IA de réécrire n\'importe quelle séance selon vos instructions.',
        highlights: ['Instructions personnalisées', 'Adapté à votre forme du jour', 'Illimité'],
    },
    'custom-plan-theme': {
        title: 'Thème personnalisé',
        desc:  'Décrivez librement votre objectif et l\'IA construit un plan sur mesure.',
        highlights: ['Description libre', 'Durée 1–8 semaines', 'Bloc 100% adapté'],
    },
    'annual-stats': {
        title: 'Stats annuelles',
        desc:  'Visualisez votre progression sur toute la saison mois par mois.',
        highlights: ['Graphique saisonnier', 'Volume planifié vs réalisé', 'Analyse annuelle'],
    },
    'advanced-stats': {
        title: 'Stats avancées',
        desc:  'Accédez aux métriques de qualité : intensité, RPE moyen, taux de réalisation.',
        highlights: ['TSS/h intensité', 'RPE moyen', 'Compliance %'],
    },
    'chat-ai': {
        title: 'Coach IA',
        desc:  'Posez toutes vos questions à votre coach IA en temps réel.',
        highlights: ['Conversation illimitée', 'Conseils personnalisés', 'Disponible 24/7'],
    },
};

export function PaywallModal({ isOpen, onClose, feature, label }: PaywallModalProps) {
    const router = useRouter();
    if (!isOpen) return null;

    const content = FEATURE_CONTENT[feature];

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-4">
                    <Lock size={22} className="text-blue-400" />
                </div>

                <h3 className="text-white font-bold text-lg mb-1">{label ?? content.title}</h3>
                <p className="text-slate-400 text-sm mb-5 leading-relaxed">{content.desc}</p>

                <ul className="space-y-2 mb-6">
                    {content.highlights.map(h => (
                        <li key={h} className="flex items-center gap-2 text-sm text-slate-300">
                            <Check size={13} className="text-emerald-400 shrink-0" />
                            {h}
                        </li>
                    ))}
                </ul>

                <button
                    onClick={() => { onClose(); router.push('/pricing?highlight=pro'); }}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/30"
                >
                    <Sparkles size={15} />
                    Essayer Athlete — 14 jours gratuits
                </button>

                <p className="text-center text-slate-600 text-xs mt-3">Annulation à tout moment</p>
            </div>
        </div>
    );
}
