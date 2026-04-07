'use client';

import React from 'react';
import {
    Sparkles,
    UserRound,
    ChevronRight,
    Bike,
    Footprints,
    Waves,
} from 'lucide-react';
import Image from 'next/image';

interface WelcomeScreenProps {
    onContinue: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
    return (
        <div className="min-h-[80dvh] flex items-center justify-center px-4 animate-in fade-in duration-500">
            <div className="w-full max-w-md text-center">

                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="relative w-16 h-16">
                        <Image
                            src="/logoWhite.png"
                            alt="PulsePeak"
                            width={64}
                            height={64}
                            className="object-contain invert dark:invert-0"
                        />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                    Bienvenue sur{' '}
                    <span className="bg-linear-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                        PulsePeak
                    </span>
                </h1>

                <p className="mt-3 text-slate-500 dark:text-slate-400 text-base leading-relaxed">
                    Votre coach sportif intelligent pour le triathlon
                </p>

                {/* Sport icons */}
                <div className="flex items-center justify-center gap-4 mt-8">
                    <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-500/15 border border-green-200/60 dark:border-green-500/20 flex items-center justify-center">
                        <Bike size={26} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-500/15 border border-orange-200/60 dark:border-orange-500/20 flex items-center justify-center">
                        <Footprints size={26} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-cyan-100 dark:bg-cyan-500/15 border border-cyan-200/60 dark:border-cyan-500/20 flex items-center justify-center">
                        <Waves size={26} className="text-cyan-600 dark:text-cyan-400" />
                    </div>
                </div>

                {/* Card explaining what to do */}
                <div className="mt-10 bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 text-left shadow-lg shadow-slate-900/5 dark:shadow-black/20">
                    <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
                            <UserRound size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                Configurez votre profil
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Pour vous proposer des plans d&apos;entraînement personnalisés, nous avons besoin de quelques informations sur vous.
                            </p>
                        </div>
                    </div>

                    {/* Steps preview */}
                    <div className="mt-4 space-y-2.5 pl-[52px]">
                        {[
                            { label: 'Vos informations de base', desc: 'Nom, âge, poids' },
                            { label: 'Vos sports', desc: 'Vélo, course, natation' },
                            { label: 'Votre disponibilité', desc: 'Heures par semaine' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{i + 1}</span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-1.5">— {item.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pl-[52px]">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                            <Sparkles size={12} />
                            <span>Moins de 2 minutes — vous pourrez compléter plus tard</span>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <button
                    onClick={onContinue}
                    className="mt-8 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 h-12 rounded-xl text-base shadow-lg shadow-blue-900/20 transition-all duration-200 active:scale-[0.98]"
                >
                    Commencer
                    <ChevronRight size={18} />
                </button>

                <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                    Vos données restent privées et sécurisées
                </p>
            </div>
        </div>
    );
};
