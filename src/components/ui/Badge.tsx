import React from 'react';
import {
    Activity, Zap, Battery, Gauge,
    ThermometerSun, Coffee, TrendingUp,
    Timer, Flame, BarChart
} from 'lucide-react';

// Configuration centralisée des styles et icônes
const BADGE_CONFIG: { [key: string]: { style: string; icon: React.ElementType } } = {
    Endurance: {
        style: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200/60 dark:border-green-500/20",
        icon: Battery
    },
    HIIT: {
        style: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200/60 dark:border-orange-500/20",
        icon: Zap
    },
    Threshold: {
        style: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/60 dark:border-red-500/20",
        icon: Gauge
    },
    Recovery: {
        style: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/60 dark:border-blue-500/20",
        icon: Activity
    },
    Tempo: {
        style: "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200/60 dark:border-yellow-500/20",
        icon: Timer
    },
    Rest: {
        style: "bg-slate-100 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-600/30",
        icon: Coffee
    },
    VO2max: {
        style: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200/60 dark:border-purple-500/20",
        icon: Flame
    },
    PMA: {
        style: "bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200/60 dark:border-pink-500/20",
        icon: ThermometerSun
    },
    Fartlek: {
        style: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-500/20",
        icon: TrendingUp
    },
    Test: {
        style: "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200/60 dark:border-cyan-500/20",
        icon: BarChart
    },
};

const DEFAULT_CONFIG = {
    style: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700",
    icon: Activity
};

export const Badge: React.FC<{ type: string, className?: string }> = ({ type, className = "" }) => {
    // Récupération de la config ou fallback sur défaut
    const config = BADGE_CONFIG[type] || DEFAULT_CONFIG;
    const Icon = config.icon;

    return (
        <span className={`
            inline-flex items-center gap-1.5
            px-2.5 py-0.5
            rounded-full border
            text-[10px] sm:text-xs font-semibold uppercase tracking-wide
            whitespace-nowrap shadow-xs
            ${config.style}
            ${className}
        `}>
            {/* L'icône est cachée sur très petits écrans si besoin, ou ajustée en taille */}
            <Icon size={10} className="stroke-[2.5px]" />
            {type}
        </span>
    );
};
