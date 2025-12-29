'use client';

import React, { useState, useMemo } from 'react';
import {
    Activity, Clock, Zap,
    BarChart2, CalendarDays, Target,
    TrendingUp, MapPin, Filter
} from 'lucide-react';
import type { Schedule, Workout, Profile } from '@/lib/data/type';
import { Card } from '@/components/ui/Card';

interface StatsViewProps {
    scheduleData: Schedule;
    profile: Profile;
}

export const StatsView: React.FC<StatsViewProps> = ({ scheduleData }) => {
    const [viewMode, setViewMode] = useState<'annual' | 'custom'>('custom');
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        end.setDate(end.getDate() + 7);
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    });

    // Helper pour formater les minutes en "2h30"
    const formatDuration = (mins: number): string => {
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return `${h}h${m > 0 ? (m < 10 ? '0' + m : m) : ''}`;
    };

    // 1. Données pour le Graphique Annuel
    const annualStats = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const stats = new Array(12).fill(null).map(() => ({
            plannedMinutes: 0,
            actualMinutes: 0
        }));

        scheduleData.workouts.forEach(w => {
            const date = new Date(w.date);
            if (isNaN(date.getTime())) return;

            if (date.getFullYear() === currentYear) {
                const month = date.getMonth();
                const plannedDuration = w.plannedData.durationMinutes || 0;
                stats[month].plannedMinutes += plannedDuration;

                if (w.status === 'completed' && w.completedData) {
                    stats[month].actualMinutes += w.completedData.actualDurationMinutes;
                }
            }
        });
        return stats;
    }, [scheduleData.workouts]);

    // 2. Données filtrées
    const filteredWorkouts = useMemo((): Workout[] => {
        return scheduleData.workouts.filter(w => {
            const wDate = new Date(w.date);
            if (viewMode === 'annual') {
                const currentYear = new Date().getFullYear();
                return wDate.getFullYear() === currentYear;
            } else {
                return wDate >= new Date(dateRange.start) && wDate <= new Date(dateRange.end);
            }
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [scheduleData.workouts, viewMode, dateRange]);

    // 3. Calcul des KPIs
    const kpis = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        let totalPlannedDuration = 0;
        let totalActualDuration = 0;
        let totalActualDistance = 0;
        let totalPlannedTSS = 0;
        let totalActualTSS = 0;
        let totalRPE = 0;
        let rpeCount = 0;
        let completedCount = 0;
        let missedCount = 0;
        let plannedCountSoFar = 0;
        const dailyLoads: number[] = [];

        filteredWorkouts.forEach(w => {
            const isPastOrToday = w.date <= todayStr;
            const plannedDuration = w.plannedData.durationMinutes || 0;
            const plannedTSS = w.plannedData.plannedTSS || 0;

            totalPlannedDuration += plannedDuration;
            totalPlannedTSS += plannedTSS;

            if (isPastOrToday) plannedCountSoFar++;

            if (w.status === 'completed' && w.completedData) {
                completedCount++;
                const actualDur = w.completedData.actualDurationMinutes;
                const actualDist = w.completedData.distanceKm;

                // Calcul TSS réel proportionnel
                const actualTssVal = plannedDuration > 0
                    ? (actualDur / plannedDuration) * plannedTSS
                    : plannedTSS;

                totalActualDuration += actualDur;
                totalActualDistance += actualDist;
                totalActualTSS += actualTssVal;

                totalRPE += w.completedData.perceivedEffort;
                rpeCount++;

                if (actualTssVal > 0) dailyLoads.push(actualTssVal);
            } else if (w.status === 'missed') {
                missedCount++;
                if (isPastOrToday) dailyLoads.push(0);
            }
        });

        // Calcul monotonie
        let monotony = 0;
        if (dailyLoads.length > 1) {
            const mean = dailyLoads.reduce((a, b) => a + b, 0) / dailyLoads.length;
            const variance = dailyLoads.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyLoads.length;
            const stdDev = Math.sqrt(variance);
            monotony = stdDev > 0 ? mean / stdDev : 0;
        }

        return {
            startDate: filteredWorkouts.length > 0 ? filteredWorkouts[0].date : null,
            endDate: filteredWorkouts.length > 0 ? filteredWorkouts[filteredWorkouts.length - 1].date : null,
            complianceRate: plannedCountSoFar > 0
                ? Math.round((completedCount / plannedCountSoFar) * 100)
                : 0,
            avgRpe: rpeCount > 0 ? (totalRPE / rpeCount).toFixed(1) : '-',
            totalActualDuration,
            totalPlannedDuration,
            totalActualDistance,
            totalPlannedTSS,
            totalActualTSS,
            completedCount,
            plannedCountSoFar,
            missedCount,
            monotony: monotony.toFixed(1),
            intensityFactor: totalActualDuration > 0
                ? (totalActualTSS / (totalActualDuration / 60)).toFixed(0)
                : '0',
        };
    }, [filteredWorkouts]);

    const formatDateShort = (dateStr: string | null): string => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short'
        });
    };

    const monthNamesShort = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    const monthNamesDesktop = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">

            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center">
                        <BarChart2 className="mr-2 text-blue-400" size={24} />
                        <span>Performance</span>
                    </h2>
                    <p className="text-slate-400 text-xs md:text-sm flex items-center gap-2 mt-1">
                        <CalendarDays size={14} />
                        <span className="hidden sm:inline">Période :</span>
                        <span className="text-white font-semibold">
                            {formatDateShort(kpis.startDate)} - {formatDateShort(kpis.endDate)}
                        </span>
                    </p>
                </div>

                {/* Boutons de Switch */}
                <div className="flex w-full md:w-auto bg-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('custom')}
                        className={`flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${viewMode === 'custom'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Ciblée
                    </button>
                    <button
                        onClick={() => setViewMode('annual')}
                        className={`flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${viewMode === 'annual'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Saison {new Date().getFullYear()}
                    </button>
                </div>
            </div>

            {/* --- DATE RANGE PICKER (Mode Custom) --- */}
            {viewMode === 'custom' && (
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50 w-full sm:w-fit mx-auto animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter size={14} className="text-slate-400 hidden sm:block" />
                        <span className="text-xs text-slate-400 w-6 sm:w-auto">Du</span>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="flex-1 bg-slate-900 border border-slate-600 text-white rounded px-3 py-1.5 text-sm md:text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="hidden sm:block w-px h-6 bg-slate-700"></div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs text-slate-400 w-6 sm:w-auto">Au</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="flex-1 bg-slate-900 border border-slate-600 text-white rounded px-3 py-1.5 text-sm md:text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
            )}

            {/* --- KPIS GRID --- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <Card className="flex flex-col items-center justify-center p-4 md:p-6 bg-slate-800/80 border-blue-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Activity size={48} className="md:w-16 md:h-16" />
                    </div>
                    <span className="text-2xl md:text-3xl font-bold text-white">
                        {kpis.totalActualTSS.toFixed(0)}
                    </span>
                    <span className="text-[10px] md:text-xs text-blue-300 uppercase tracking-wider mt-1 text-center">
                        Charge (TSS)
                    </span>
                </Card>

                <Card className="flex flex-col items-center justify-center p-4 md:p-6 bg-slate-800/80 border-emerald-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Clock size={48} className="md:w-16 md:h-16" />
                    </div>
                    <span className="text-2xl md:text-3xl font-bold text-white">
                        {formatDuration(kpis.totalActualDuration)}
                    </span>
                    <span className="text-[10px] md:text-xs text-emerald-300 uppercase tracking-wider mt-1 text-center">
                        Volume
                    </span>
                </Card>

                <Card className="flex flex-col items-center justify-center p-4 md:p-6 bg-slate-800/80 border-purple-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <MapPin size={48} className="md:w-16 md:h-16" />
                    </div>
                    <span className="text-2xl md:text-3xl font-bold text-white">
                        {kpis.totalActualDistance.toFixed(0)}<span className="text-sm">km</span>
                    </span>
                    <span className="text-[10px] md:text-xs text-purple-300 uppercase tracking-wider mt-1 text-center">
                        Distance
                    </span>
                </Card>

                <Card className="flex flex-col items-center justify-center p-4 md:p-6 bg-slate-800/80 border-orange-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <TrendingUp size={48} className="md:w-16 md:h-16" />
                    </div>
                    <span className="text-2xl md:text-3xl font-bold text-white">
                        {kpis.monotony}
                    </span>
                    <span className="text-[10px] md:text-xs text-orange-300 uppercase tracking-wider mt-1 text-center">
                        Monotonie
                    </span>
                </Card>
            </div>

            {/* --- GRAPHIQUE ANNUEL --- */}
            {viewMode === 'annual' && (
                <Card className="p-4 md:p-6 animate-in fade-in duration-500">
                    <h3 className="text-base md:text-lg font-semibold text-white mb-4 md:mb-6 flex items-center">
                        <CalendarDays className="mr-2 text-blue-400" size={20} />
                        Progression (Heures)
                    </h3>
                    <div className="flex justify-between items-end h-40 md:h-48 gap-1 md:gap-2">
                        {annualStats.map((m, idx) => {
                            const maxMinutes = Math.max(
                                ...annualStats.map(s => Math.max(s.plannedMinutes, s.actualMinutes)),
                                600
                            );
                            const heightPlanned = Math.max((m.plannedMinutes / maxMinutes) * 100, 2);
                            const heightActual = Math.max((m.actualMinutes / maxMinutes) * 100, 0);

                            return (
                                <div
                                    key={idx}
                                    className="flex-1 flex flex-col items-center group relative h-full justify-end"
                                >
                                    {/* Container Barres */}
                                    <div className="w-full flex flex-col justify-end relative h-full">
                                        {/* Barre Planifiée (Fond) */}
                                        <div
                                            className="w-full bg-slate-700/40 absolute bottom-0 transition-all duration-700 rounded-t-xs"
                                            style={{ height: `${heightPlanned}%` }}
                                        />

                                        {/* Barre Réalisée (Premier Plan) */}
                                        <div
                                            className={`w-full z-10 transition-all duration-700 rounded-t-xs ${m.actualMinutes > 0 ? 'bg-blue-500' : 'bg-transparent'
                                                }`}
                                            style={{ height: `${heightActual}%` }}
                                        />
                                    </div>

                                    {/* Tooltip Desktop */}
                                    {(m.plannedMinutes > 0 || m.actualMinutes > 0) && (
                                        <div className="hidden md:block absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] py-1.5 px-2.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 border border-slate-700 pointer-events-none shadow-xl">
                                            <div className="font-bold mb-0.5">{monthNamesDesktop[idx]}</div>
                                            <div className="text-slate-400">
                                                Prévu: <span className="text-slate-200">{formatDuration(m.plannedMinutes)}</span>
                                            </div>
                                            <div className="text-blue-400">
                                                Fait: <span className="text-white">{formatDuration(m.actualMinutes)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Labels Mois */}
                                    <span className="text-[9px] md:text-[10px] text-slate-500 mt-2 uppercase font-medium">
                                        <span className="md:hidden">{monthNamesShort[idx]}</span>
                                        <span className="hidden md:inline">{monthNamesDesktop[idx]}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Légende */}
                    <div className="flex justify-center gap-4 mt-4 text-[10px] md:text-xs text-slate-400">
                        <div className="flex items-center">
                            <div className="w-2 h-2 md:w-3 md:h-3 bg-slate-700 mr-1.5 rounded-sm" />
                            Planifié
                        </div>
                        <div className="flex items-center">
                            <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-500 mr-1.5 rounded-sm" />
                            Réalisé
                        </div>
                    </div>
                </Card>
            )}

            {/* --- CARTES DETAILS COACH --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

                {/* Qualité */}
                <Card className="p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold text-white mb-4 md:mb-6 flex items-center">
                        <Zap className="mr-2 text-yellow-400" size={20} /> Qualité
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                            <span className="text-slate-400 text-xs md:text-sm">Intensité (TSS/h)</span>
                            <div className="text-right">
                                <span className="text-white font-bold text-base md:text-lg">
                                    {kpis.intensityFactor}
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                            <span className="text-slate-400 text-xs md:text-sm">RPE Moyen</span>
                            <div className="text-right">
                                <span className={`font-bold text-base md:text-lg ${typeof kpis.avgRpe === 'string' ? 'text-white' :
                                        Number(kpis.avgRpe) > 7 ? 'text-red-400' : 'text-white'
                                    }`}>
                                    {kpis.avgRpe}{typeof kpis.avgRpe !== 'string' && '/10'}
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-slate-400 text-xs md:text-sm">Taux de réalisation</span>
                            <div className="text-right">
                                <span className={`font-bold text-base md:text-lg ${kpis.complianceRate < 80 ? 'text-orange-400' : 'text-emerald-400'
                                    }`}>
                                    {kpis.complianceRate}%
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                    {kpis.completedCount}/{kpis.plannedCountSoFar} séances
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Charge vs Objectif */}
                <Card className="p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold text-white mb-4 md:mb-6 flex items-center">
                        <Target className="mr-2 text-purple-400" size={20} /> Objectifs
                    </h3>
                    <div className="space-y-6">

                        {/* Jauge Volume */}
                        <div>
                            <div className="flex justify-between text-xs md:text-sm mb-2">
                                <span className="text-slate-400">Volume Horaire</span>
                                <span className="text-white font-mono">
                                    {Math.round((kpis.totalActualDuration / (kpis.totalPlannedDuration || 1)) * 100)}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-2 md:h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${kpis.totalActualDuration >= kpis.totalPlannedDuration
                                            ? 'bg-emerald-500'
                                            : 'bg-blue-500'
                                        }`}
                                    style={{
                                        width: `${Math.min(100, (kpis.totalActualDuration / (kpis.totalPlannedDuration || 1)) * 100)}%`
                                    }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
                                <span>{formatDuration(kpis.totalActualDuration)}</span>
                                <span>Obj: {formatDuration(kpis.totalPlannedDuration)}</span>
                            </div>
                        </div>

                        {/* Jauge Charge */}
                        <div>
                            <div className="flex justify-between text-xs md:text-sm mb-2">
                                <span className="text-slate-400">Charge (TSS)</span>
                                <span className="text-white font-mono">
                                    {Math.round((kpis.totalActualTSS / (kpis.totalPlannedTSS || 1)) * 100)}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-2 md:h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${kpis.totalActualTSS > kpis.totalPlannedTSS * 1.1
                                            ? 'bg-red-500'
                                            : 'bg-yellow-500'
                                        }`}
                                    style={{
                                        width: `${Math.min(100, (kpis.totalActualTSS / (kpis.totalPlannedTSS || 1)) * 100)}%`
                                    }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
                                <span>{kpis.totalActualTSS.toFixed(0)}</span>
                                <span>Obj: {kpis.totalPlannedTSS}</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
