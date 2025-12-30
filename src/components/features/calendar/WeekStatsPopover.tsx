import React, { useEffect, useRef } from 'react';
import { X, Zap, TrendingUp, Bike, Footprints, Waves, Dumbbell, Activity, Timer } from 'lucide-react';
import type { WeekStats } from '@/hooks/useWeekStats';

interface WeekStatsPopoverProps {
    stats: WeekStats;
    onClose: () => void;
}

// Typage strict pour les sports
type SportType = 'cycling' | 'running' | 'swimming' | 'strength' | 'default';

const SPORT_CONFIG: Record<SportType, { label: string, icon: React.ElementType, color: string }> = {
    cycling: { label: 'Vélo', icon: Bike, color: 'text-blue-400' },
    running: { label: 'Course', icon: Footprints, color: 'text-emerald-400' },
    swimming: { label: 'Natation', icon: Waves, color: 'text-cyan-400' },
    strength: { label: 'Muscu', icon: Dumbbell, color: 'text-purple-400' },
    default: { label: 'Autre', icon: Activity, color: 'text-slate-400' }
};

export function WeekStatsPopover({ stats, onClose }: WeekStatsPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);

    // Fermeture au clic extérieur
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Helper pour formater la durée (ex: 5h30)
    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0 && m === 0) return "0h";
        if (h === 0) return `${m}m`;
        return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`;
    };

    // Calculs de progression temporelle
    const planned = stats.plannedDuration || 1; // Évite division par zéro
    const actual = stats.actualDuration;
    const progressPercent = Math.min((actual / planned) * 100, 100);
    const isOverTarget = actual > planned;

    return (
        <div
            ref={popoverRef}
            className="absolute top-0 right-[105%] z-50 w-80 
                       bg-slate-900/95 backdrop-blur-md border border-slate-700/50 
                       rounded-xl shadow-2xl shadow-black/50 overflow-hidden
                       animate-in fade-in zoom-in-95 slide-in-from-right-2 duration-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <TrendingUp size={16} className="text-blue-500" />
                        Résumé Hebdo
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Performance & Volume</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-6">

                {/* --- NOUVELLE SECTION JAUGE DE TEMPS --- */}
                <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <Timer size={14} className="text-blue-400" />
                            <span>Volume réalisé</span>
                        </div>
                        <div className="text-right flex items-baseline gap-1">
                            <span className={`font-bold text-sm ${isOverTarget ? 'text-emerald-400' : 'text-white'}`}>
                                {formatDuration(actual)}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                                / {formatDuration(stats.plannedDuration)} prévus
                            </span>
                        </div>
                    </div>

                    {/* Barre de progression */}
                    <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden ring-1 ring-white/5">
                        {/* Indicateur de fond hachuré pour le "reste à faire" (optionnel, pour le style) */}
                        <div className="absolute inset-0 opacity-10"
                            style={{ backgroundImage: 'linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 50%, #ffffff 50%, #ffffff 75%, transparent 75%, transparent)', backgroundSize: '8px 8px' }}
                        />

                        {/* Jauge de remplissage */}
                        <div
                            className={`h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)] 
                                ${isOverTarget
                                    ? 'bg-linear-to-r from-emerald-600 to-emerald-400'
                                    : 'bg-linear-to-r from-blue-600 to-cyan-400'}`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    {/* Pourcentage sous la barre */}
                    <div className="flex justify-end mt-1">
                        <span className={`text-[10px] font-medium ${isOverTarget ? 'text-emerald-500' : 'text-blue-400'}`}>
                            {Math.round((actual / planned) * 100)}% de l&apos;objectif
                        </span>
                    </div>
                </div>

                {/* 2. Grid Stats Secondaires (TSS & Distance) */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Carte TSS */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5 flex flex-col justify-between hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-medium mb-1">
                            <Zap size={12} className="text-yellow-500/80" fill="currentColor" />
                            <span>CHARGE TSS</span>
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight mt-1">
                            {stats.plannedTSS}
                        </p>
                    </div>

                    {/* Carte Distance / Séances */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5 flex flex-col justify-between hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-medium mb-1">
                            <Activity size={12} className="text-purple-400" />
                            <span>SÉANCES</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                            <p className="text-xl font-bold text-white tracking-tight">
                                {stats.completed}
                            </p>
                            <span className="text-xs text-slate-500">/ {stats.total}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Répartition par sport */}
                {stats.total > 0 && (
                    <div className="pt-2 border-t border-white/5">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Répartition
                        </h4>
                        <div className="space-y-2">
                            {(Object.entries(stats.sportBreakdown) as [string, number][])
                                .filter(([, count]) => count > 0)
                                .map(([sportKey, count]) => {
                                    const key = Object.keys(SPORT_CONFIG).find(k => sportKey.toLowerCase().includes(k)) || 'default';
                                    const config = SPORT_CONFIG[key as SportType];
                                    const Icon = config.icon;

                                    return (
                                        <div key={sportKey} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-md bg-slate-800 ring-1 ring-white/5 ${config.color.replace('text-', 'bg-')}/10`}>
                                                    <Icon size={14} className={config.color} />
                                                </div>
                                                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                                    {config.label}
                                                </span>
                                            </div>
                                            <span className="text-xs font-medium text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">
                                                {count}
                                            </span>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
