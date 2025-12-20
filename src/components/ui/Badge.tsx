import React from 'react';
import { 
    Activity, Zap, Battery, Gauge, 
    ThermometerSun, Coffee, TrendingUp, 
    Timer, Flame, BarChart 
} from 'lucide-react';

// Configuration centralisée des styles et icônes
const BADGE_CONFIG: { [key: string]: { style: string; icon: React.ElementType } } = {
    Endurance: { 
        style: "bg-green-500/10 text-green-400 border-green-500/20", 
        icon: Battery 
    },
    HIIT: { 
        style: "bg-orange-500/10 text-orange-400 border-orange-500/20", 
        icon: Zap 
    },
    Threshold: { 
        style: "bg-red-500/10 text-red-400 border-red-500/20", 
        icon: Gauge 
    },
    Recovery: { 
        style: "bg-blue-500/10 text-blue-400 border-blue-500/20", 
        icon: Activity 
    },
    Tempo: { 
        style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", 
        icon: Timer 
    },
    Rest: { 
        style: "bg-slate-700/30 text-slate-400 border-slate-600/30", 
        icon: Coffee 
    },
    VO2max: { 
        style: "bg-purple-500/10 text-purple-400 border-purple-500/20", 
        icon: Flame 
    },
    PMA: { 
        style: "bg-pink-500/10 text-pink-400 border-pink-500/20", 
        icon: ThermometerSun 
    },
    Fartlek: { 
        style: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", 
        icon: TrendingUp 
    },
    Test: { 
        style: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", 
        icon: BarChart 
    },
};

const DEFAULT_CONFIG = { 
    style: "bg-slate-800 text-slate-300 border-slate-700", 
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