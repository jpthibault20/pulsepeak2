import { Card } from "@/components/ui/Card";
import { Bike, Check, Footprints, Link2, Waves, Unlink, PenOff, Lock } from "lucide-react";
import React, { Dispatch, SetStateAction } from "react";
import { Profile } from "@/lib/data/DatabaseTypes";

interface SportsAndLinkAppProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>;
    isPro?: boolean;
}

const SPORTS = [
    {
        key: 'cycling' as const,
        label: 'Cyclisme',
        desc: 'Route, VTT, Triathlon',
        icon: Bike,
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-100 dark:bg-orange-500/10',
        border: 'border-orange-500/30',
        activeBg: 'bg-orange-100 dark:bg-orange-500/10',
    },
    {
        key: 'running' as const,
        label: 'Running',
        desc: 'Route, Trail, Piste',
        icon: Footprints,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-100 dark:bg-emerald-500/10',
        border: 'border-emerald-500/30',
        activeBg: 'bg-emerald-100 dark:bg-emerald-500/10',
    },
    {
        key: 'swimming' as const,
        label: 'Natation',
        desc: 'Piscine, Open water',
        icon: Waves,
        color: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-100 dark:bg-cyan-500/10',
        border: 'border-cyan-500/30',
        activeBg: 'bg-cyan-100 dark:bg-cyan-500/10',
    },
];

export const SportsAndAppLink: React.FC<SportsAndLinkAppProps> = ({ formData, setFormData, isPro = false }) => {

    const toggleSport = (sport: keyof typeof formData.activeSports) => {
        setFormData(prev => ({
            ...prev,
            activeSports: { ...prev.activeSports, [sport]: !prev.activeSports[sport] }
        }));
    };

    const activeSports = SPORTS.filter(s => formData.activeSports[s.key]);

    return (
        <div className="space-y-4">

            {/* Disciplines */}
            <Card className="p-5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Disciplines pratiquées</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-500 ml-auto">{activeSports.length} / {SPORTS.length}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500 mb-5">Sélectionnez vos sports pour personnaliser votre planning et vos zones.</p>

                <div className="grid grid-cols-1 gap-3">
                    {SPORTS.map((sport) => {
                        const active = formData.activeSports[sport.key as keyof typeof formData.activeSports];
                        const Icon = sport.icon;
                        return (
                            <button
                                key={sport.key}
                                onClick={() => toggleSport(sport.key as keyof typeof formData.activeSports)}
                                className={`
                                    flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                                    ${active
                                        ? `${sport.activeBg} ${sport.border} shadow-sm`
                                        : 'bg-slate-100/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-50 hover:opacity-70 hover:border-slate-300 dark:hover:border-slate-700'
                                    }
                                `}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? sport.bg : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    <Icon size={20} className={active ? sport.color : 'text-slate-400 dark:text-slate-600'} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-semibold ${active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{sport.label}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{sport.desc}</p>
                                </div>
                                {/* Toggle */}
                                <div className={`
                                    w-9 h-5 rounded-full transition-all relative shrink-0
                                    ${active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}
                                `}>
                                    <div className={`
                                        absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all
                                        ${active ? 'left-[18px]' : 'left-0.5'}
                                    `} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* Strava */}
            <Card className="p-5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 relative overflow-hidden">
                {/* Strava orange accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-[#FC4C02]/5 rounded-bl-full pointer-events-none" />

                <div className="flex items-start gap-4">
                    {/* Strava icon */}
                    <div className="w-10 h-10 bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-xl flex items-center justify-center shrink-0">
                        <svg role="img" viewBox="0 0 24 24" fill="#FC4C02" className="w-5 h-5">
                            <title>Strava</title>
                            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                        </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Strava</p>
                        {formData.strava?.athleteId ? (
                            <>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">Connecté · Athlete #{formData.strava.athleteId}</p>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                        <Check size={11} strokeWidth={3} />
                                        Connecté
                                    </span>
                                    <a
                                        href="/api/strava/disconnect"
                                        className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    >
                                        <Unlink size={11} />
                                        Déconnecter
                                    </a>
                                </div>

                                {/* Strava write-back toggle */}
                                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!isPro) return;
                                            setFormData(prev => ({ ...prev, stravaWriteBack: !(prev.stravaWriteBack ?? true) }));
                                        }}
                                        className={`flex items-center justify-between w-full gap-3 text-left ${!isPro ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <PenOff size={13} className="text-slate-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    Écrire le TSS sur Strava
                                                    {!isPro && <Lock size={10} className="text-slate-400" />}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                                                    {isPro ? 'Ajoute le TSS calculé dans la description de vos activités' : 'Disponible avec le plan Pro'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`
                                            w-9 h-5 rounded-full transition-all relative shrink-0
                                            ${(formData.stravaWriteBack ?? true) ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}
                                        `}>
                                            <div className={`
                                                absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all
                                                ${(formData.stravaWriteBack ?? true) ? 'left-[18px]' : 'left-0.5'}
                                            `} />
                                        </div>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">Synchronisez vos activités automatiquement</p>
                                <a
                                    href="/api/strava/login"
                                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-[#FC4C02]/10 border border-[#FC4C02]/40 text-[#FC4C02] hover:bg-[#FC4C02] hover:text-white hover:border-[#FC4C02]"
                                >
                                    <Link2 size={11} />
                                    Connecter Strava
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};
