import React from 'react';
import { Zap, CheckCircle2, XCircle, Bike, Footprints, Waves, Dumbbell, Activity } from 'lucide-react';
import type { Workout } from '@/lib/data/type';

interface WorkoutBadgeProps {
    workout: Workout;
    onClick: (e: React.MouseEvent) => void;
    isCompact?: boolean;
}

// 1. Définition précise du type pour le style
type SportStyleConfig = {
    icon: React.ElementType; // On remplace 'any' par React.ElementType (le type d'un composant)
    color: string;
    bg: string;
    border: string;
};

// 2. Configuration utilisant le type défini
const SPORT_CONFIG: Record<string, SportStyleConfig> = {
    cycling: {
        icon: Bike,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-l-blue-500'
    },
    running: {
        icon: Footprints,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-l-emerald-500'
    },
    swimming: {
        icon: Waves,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-l-cyan-500'
    },
    strength: {
        icon: Dumbbell,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-l-purple-500'
    },
    default: {
        icon: Activity,
        color: 'text-slate-400',
        bg: 'bg-slate-700/30',
        border: 'border-l-slate-500'
    }
};

export function WorkoutBadge({ workout, onClick, isCompact = false }: WorkoutBadgeProps) {
    // Sécurisation de la clé sport
    const sportKey = (workout.sportType || '').toLowerCase();

    // Recherche intelligente de la configuration (match partiel, ex: "road cycling" -> "cycling")
    const configKey = Object.keys(SPORT_CONFIG).find(k => sportKey.includes(k) && k !== 'default') || 'default';

    const style = SPORT_CONFIG[configKey];
    const Icon = style.icon;

    // Formatage de la durée
    const hours = Math.floor(workout.plannedData.durationMinutes / 60);
    const mins = workout.plannedData.durationMinutes % 60;
    const durationLabel = hours > 0
        ? `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`
        : `${mins}m`;

    const tss = workout.plannedData.plannedTSS ?? 0;
    const isDone = workout.status === 'completed';
    const isMissed = workout.status === 'missed';

    // --- RENDU COMPACT ---
    if (isCompact) {
        return (
            <div
                onClick={onClick}
                className={`
          flex items-center gap-3 p-2 rounded-md
          hover:bg-slate-800 transition-colors cursor-pointer group
          border border-transparent hover:border-slate-700
        `}
            >
                <div className={`p-1.5 rounded-full ${style.bg} ${style.color}`}>
                    <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white">
                        {workout.title || workout.workoutType}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{durationLabel}</span>
                        {tss > 0 && <span className="text-slate-600">• TSS {tss}</span>}
                    </p>
                </div>
                {isDone && <CheckCircle2 size={16} className="text-emerald-500" />}
                {isMissed && <XCircle size={16} className="text-red-500/50" />}
            </div>
        );
    }

    // --- RENDU CARTE CLASSIQUE ---
    return (
        <div
            onClick={onClick}
            className={`
        relative overflow-hidden rounded-r-md rounded-l-xs
        bg-slate-800/80 hover:bg-slate-800 border-y border-r border-slate-700/50
        border-l-[3px] ${style.border}
        p-2 cursor-pointer transition-all duration-200
        hover:shadow-lg hover:shadow-black/20 hover:translate-x-0.5
        group
      `}
        >
            {/* Header : Titre et Statut */}
            <div className="flex justify-between items-start mb-1.5 gap-2">
                <h4 className={`
          text-[11px] font-semibold leading-tight line-clamp-2
          ${isDone ? 'text-slate-200  decoration-slate-600' : 'text-slate-400'}
        `}>
                    {workout.workoutType}
                </h4>

                <div className="shrink-0">
                    {isDone && <CheckCircle2 size={14} className="text-emerald-500" />}
                    {isMissed && <XCircle size={14} className="text-red-400/60" />}
                </div>
            </div>

            {/* Footer : Métriques */}
            <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 ${style.color}`}>
                        <Icon size={12} />
                        <span className="font-medium">{durationLabel}</span>
                    </div>
                </div>

                {tss > 0 && (
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <Zap size={10} className="text-yellow-500" fill="currentColor" />
                        <span>{tss}</span>
                    </div>
                )}
            </div>

            {/* Effet "Glass" au survol */}
            <div className="absolute inset-0 pointer-events-none bg-white/0 group-hover:bg-white/2 transition-colors" />
        </div>
    );
}
