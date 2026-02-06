import React from 'react';
import {
    Clock, Zap, Check, X,
    Bike, Footprints, Waves, Dumbbell, Activity,
    Home, Sun
} from 'lucide-react';
import type { Workoutold } from '@/lib/data/type';

interface WorkoutBadgeProps {
    workout: Workoutold;
    onClick: (e: React.MouseEvent) => void;
    isCompact?: boolean;
}

// 1. Configuration des styles par Sport (Couleur + Icone)
const SPORT_CONFIG: Record<string, { icon: React.ElementType, color: string, bg: string }> = {
    cycling: { icon: Bike, color: 'text-sky-400', bg: 'bg-sky-500' },
    running: { icon: Footprints, color: 'text-orange-400', bg: 'bg-orange-500' },
    swimming: { icon: Waves, color: 'text-cyan-400', bg: 'bg-cyan-500' },
    strength: { icon: Dumbbell, color: 'text-purple-400', bg: 'bg-purple-500' },
    default: { icon: Activity, color: 'text-slate-400', bg: 'bg-slate-500' }
};

export function WorkoutBadge({ workout, onClick, isCompact = false }: WorkoutBadgeProps) {
    // --- Extraction des données ---
    const sportKey = workout.sportType?.toLowerCase() || 'default';
    const config = SPORT_CONFIG[sportKey] || SPORT_CONFIG.default;
    const SportIcon = config.icon;

    const isIndoor = workout.mode?.toLowerCase() === 'indoor';
    const isCompleted = workout.status === 'completed';
    const isMissed = workout.status === 'missed';

    const duration = workout.completedData?.actualDurationMinutes || workout.plannedData?.durationMinutes || 0;
    const tss = workout.plannedData?.plannedTSS;

    // --- Style dynamique du conteneur ---
    // Si manqué : fond rougeatre très léger + bordure rouge
    // Si fait : fond vert très léger
    let containerStyle = "border-l-2 bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750";

    if (isCompleted) {
        containerStyle = "border-l-2 border-emerald-500 bg-emerald-950/10 hover:bg-emerald-950/20";
    } else if (isMissed) {
        containerStyle = "border-l-2 border-red-500 bg-red-950/10 hover:bg-red-950/20";
    } else {
        // En attente : on utlise la couleur du sport pour la bordure gauche
        containerStyle = `border-l-2 border-blue-500 bg-slate-800 hover:bg-slate-750`;
    }

    return (
        <div
            onClick={onClick}
            className={`
                relative flex flex-col gap-1
                w-full rounded-r-md shadow-sm transition-all duration-200 cursor-pointer
                overflow-hidden group
                ${containerStyle}
                ${isCompact ? 'p-1.5' : 'p-2'}
                mb-1.5
            `}
        >
            {/* --- EN-TÊTE : Icone Sport + Titre + Badge Indoor --- */}
            <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    {/* Icône Sport (Colorée) */}
                    <div className={`shrink-0 ${config.color} opacity-90`}>
                        <SportIcon size={isCompact ? 13 : 15} strokeWidth={2.5} />
                    </div>

                    {/* Titre tronqué */}
                    <span className={`truncate font-medium text-slate-200 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                        {workout.title}
                    </span>
                </div>

                {/* --- BADGE INDOOR / OUTDOOR --- */}
                {/* C'est ici que l'UI fait la différence : une petite pilule visuelle */}
                <div
                    title={isIndoor ? "Indoor / Home Trainer" : "Extérieur"}
                    className={`
                        shrink-0 flex items-center justify-center rounded-sm px-1 py-0.5
                        text-[9px] font-bold uppercase tracking-wider border
                        ${isIndoor
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }
                    `}
                >
                    {isIndoor ? (
                        <Home size={10} className="mr-0.5" />
                    ) : (
                        <Sun size={10} className="mr-0.5" />
                    )}
                </div>
            </div>

            {/* --- LIGNE DE DÉTAILS (Temps, TSS, Statut) --- */}
            {!isCompact && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">

                    {/* Groupe Metrics */}
                    <div className="flex items-center gap-3">
                        {/* Temps */}
                        <div className="flex items-center gap-1 hover:text-slate-300 transition-colors">
                            <Clock size={11} />
                            <span>{duration}&apos;</span>
                        </div>

                        {/* TSS (Affiché seulement si > 0) */}
                        {tss ? (
                            <div className="flex items-center gap-1 hover:text-yellow-500/80 transition-colors">
                                <Zap size={11} className={isCompleted ? "text-yellow-600" : "text-slate-500"} />
                                <span>{tss}</span>
                            </div>
                        ) : null}
                    </div>

                    {/* Indicateur de Statut (Icone seule) */}
                    <div>
                        {isCompleted && (
                            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-1.5 rounded-full">
                                <Check size={10} strokeWidth={3} />
                            </div>
                        )}
                        {isMissed && (
                            <div className="flex items-center text-red-500 bg-red-500/10 px-1 rounded-full">
                                <X size={10} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
