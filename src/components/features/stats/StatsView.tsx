'use client';

import React, { useState, useMemo } from 'react';
import {
    Activity, Clock, Zap,

    Info, BarChart2, CalendarDays, Target,
    TrendingUp, MapPin
} from 'lucide-react';
import { Profile, Workout } from '@/lib/data/type';
import { Card } from '@/components/ui/Card';

interface StatsViewProps {
    scheduleData: { workouts: { [key: string]: Workout } };
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

    // 1. Données pour le Graphique Annuel (TOUTE L'ANNÉE)
    const annualStats = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const allWorkouts = Object.values(scheduleData.workouts);

        // Initialisation propre pour éviter les références partagées
        const stats = new Array(12).fill(null).map(() => ({ plannedTss: 0, actualTss: 0 }));

        console.group("DEBUG ANNUAL STATS");
        console.log("Current Year:", currentYear);
        console.log("Total Workouts found:", allWorkouts.length);

        allWorkouts.forEach(w => {
            const date = new Date(w.date);

            // Vérification validité date
            if (isNaN(date.getTime())) {
                console.warn("Invalid date found:", w.date, w);
                return;
            }

            // Vérification année
            if (date.getFullYear() === currentYear) {
                const month = date.getMonth();
                const tssToAdd = w.tss || 0;

                stats[month].plannedTss += tssToAdd;

                if (tssToAdd > 0) {
                    // console.log(`Mois ${month+1}: Ajout ${tssToAdd} TSS Planifié (Date: ${w.date})`);
                }

                if (w.status === 'completed') {
                    const durationRatio = w.completedData?.actualDuration
                        ? (w.completedData.actualDuration / (w.duration || 1))
                        : 1;

                    const actualTssVal = durationRatio * (w.tss || 0);

                    console.log(`Mois ${month + 1} [COMPLETED]: TSS Réel calculé: ${actualTssVal.toFixed(1)} (Ratio durée: ${durationRatio.toFixed(2)})`);

                    stats[month].actualTss += actualTssVal;
                }
            } else {
                // console.log(`Ignored workout from wrong year: ${date.getFullYear()}`);
            }
        });

        console.log("Final Stats Array:", JSON.parse(JSON.stringify(stats))); // Deep copy log
        console.groupEnd();

        return stats;
    }, [scheduleData]);

    // 2. Données filtrées pour les KPIs (Période Custom)
    const filteredWorkouts = useMemo(() => {
        const allWorkouts = Object.values(scheduleData.workouts);
        return allWorkouts.filter(w => {
            const wDate = new Date(w.date);
            if (viewMode === 'annual') {
                const currentYear = new Date().getFullYear();
                return wDate.getFullYear() === currentYear;
            } else {
                return wDate >= new Date(dateRange.start) && wDate <= new Date(dateRange.end);
            }
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [scheduleData, viewMode, dateRange]);

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

            // 1. Totaux PLANIFIÉS (Sur toute la période)
            totalPlannedDuration += w.duration || 0;
            totalPlannedTSS += w.tss || 0;

            // 2. Totaux "À DATE"
            if (isPastOrToday) {
                plannedCountSoFar++;
            }

            // 3. Totaux RÉALISÉS
            if (w.status === 'completed') {
                completedCount++;
                const actualDur = w.completedData?.actualDuration ? Number(w.completedData.actualDuration) : (w.duration || 0);
                const actualDist = w.completedData?.distance ? Number(w.completedData.distance) : 0;
                const actualTssVal = w.duration > 0 ? (actualDur / w.duration) * (w.tss || 0) : (w.tss || 0);

                totalActualDuration += actualDur;
                totalActualDistance += actualDist;
                totalActualTSS += actualTssVal;

                totalRPE += Number(w.completedData?.rpe) || 0;
                if (Number(w.completedData?.rpe) > 0) rpeCount++;

                if (actualTssVal > 0) dailyLoads.push(actualTssVal);
            } else if (w.status === 'missed') {
                missedCount++;
                if (isPastOrToday) dailyLoads.push(0);
            }
        });

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
            complianceRate: plannedCountSoFar > 0 ? Math.round((completedCount / plannedCountSoFar) * 100) : 0,
            avgRpe: rpeCount > 0 ? (totalRPE / rpeCount).toFixed(1) : '-',
            totalActualDuration,
            totalPlannedDuration,
            totalActualDistance,
            totalPlannedTSS,
            totalActualTSS,
            completedCount,
            missedCount,
            plannedCountSoFar,
            monotony: monotony.toFixed(1),
            intensityFactor: totalActualDuration > 0 ? (totalActualTSS / (totalActualDuration / 60)).toFixed(0) : 0,
            totalCount: filteredWorkouts.length
        };
    }, [filteredWorkouts]);

    const formatDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return `${h}h${m > 0 ? m : ''}`;
    };

    const formatDateShort = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    const monthNamesShort = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <BarChart2 className="mr-2 text-blue-400" /> Analyse de la Performance
                    </h2>
                    <p className="text-slate-400 text-sm flex items-center gap-2">
                        <CalendarDays size={14} />
                        Période : <span className="text-white font-semibold">{formatDateShort(kpis.startDate)} - {formatDateShort(kpis.endDate)}</span>
                    </p>
                </div>

                <div className="flex bg-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('custom')}
                        className={`px-4 py-2 text-sm rounded-md transition-all ${viewMode === 'custom' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Analyse Ciblée
                    </button>
                    <button
                        onClick={() => setViewMode('annual')}
                        className={`px-4 py-2 text-sm rounded-md transition-all ${viewMode === 'annual' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Saison {new Date().getFullYear()}
                    </button>
                </div>
            </div>

            {viewMode === 'custom' && (
                <div className="flex items-center gap-4 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50 mb-6 w-fit mx-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Du</span>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="w-4 h-1px bg-slate-600"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Au</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="flex flex-col items-center justify-center p-6 bg-slate-800/80 border-blue-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Activity size={64} /></div>
                    <span className="text-3xl font-bold text-white">{kpis.totalActualTSS.toFixed(0)}</span>
                    <span className="text-xs text-blue-300 uppercase tracking-wider mt-1">Charge Réelle (TSS)</span>
                    <span className="text-[10px] text-slate-500 mt-1">Sur {kpis.totalPlannedTSS} prévu</span>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6 bg-slate-800/80 border-emerald-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Clock size={64} /></div>
                    <span className="text-3xl font-bold text-white">{formatDuration(kpis.totalActualDuration)}</span>
                    <span className="text-xs text-emerald-300 uppercase tracking-wider mt-1">Volume Horaire</span>
                    <span className="text-[10px] text-slate-500 mt-1">Sur {formatDuration(kpis.totalPlannedDuration)} prévu</span>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6 bg-slate-800/80 border-purple-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><MapPin size={64} /></div>
                    <span className="text-3xl font-bold text-white">{kpis.totalActualDistance.toFixed(0)}<span className="text-sm">km</span></span>
                    <span className="text-xs text-purple-300 uppercase tracking-wider mt-1">Distance</span>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6 bg-slate-800/80 border-orange-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp size={64} /></div>
                    <span className="text-3xl font-bold text-white">{kpis.monotony}</span>
                    <span className="text-xs text-orange-300 uppercase tracking-wider mt-1">Monotonie</span>
                    <span className="text-[10px] text-slate-500 mt-1">{Number(kpis.monotony) > 2 ? "⚠️ Risque Élevé" : "✅ Charge Variée"}</span>
                </Card>
            </div>

            {/* Vue Graphique Annuelle (TOUJOURS CALCULÉ SUR TOUTE L'ANNÉE) */}
            {viewMode === 'annual' && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                        <CalendarDays className="mr-2 text-blue-400" size={20} /> Progression Saisonnière (TSS / Mois)
                    </h3>
                    {/* CORRECTION: suppression de items-end pour permettre l'étirement */}
                    <div className="flex justify-between h-48 gap-2">
                        {annualStats.map((m, idx) => {
                            const maxTss = Math.max(...annualStats.map(s => Math.max(s.plannedTss, s.actualTss)), 100);
                            const heightPlanned = Math.max((m.plannedTss / maxTss) * 100, 2);
                            const heightActual = Math.max((m.actualTss / maxTss) * 100, 0);

                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                    {/* CORRECTION: flex-1 pour remplir la hauteur, w-full */}
                                    <div className="w-full flex-1 bg-slate-800/50 rounded-t-sm relative flex flex-col justify-end">
                                        {/* Barre Planifiée (Fond grisé/bleuté) */}
                                        <div
                                            className="w-full rounded-t-sm bg-slate-700/50 absolute bottom-0 transition-all duration-700 border-t border-slate-500"
                                            style={{ height: `${heightPlanned}%` }}
                                        ></div>

                                        {/* Barre Réalisée (Premier plan coloré) */}
                                        <div
                                            className={`w-full rounded-t-sm z-10 transition-all duration-700 ${m.actualTss > 0 ? 'bg-blue-500 group-hover:bg-blue-400' : 'bg-transparent'}`}
                                            style={{ height: `${heightActual}%` }}
                                        ></div>

                                        {/* Tooltip */}
                                        {(m.plannedTss > 0 || m.actualTss > 0) && (
                                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 border border-slate-700 pointer-events-none">
                                                <div>Prévu: {Math.round(m.plannedTss)}</div>
                                                <div>Fait: {Math.round(m.actualTss)}</div>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-500 mt-2 uppercase">{monthNamesShort[idx]}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-center gap-4 mt-4 text-xs text-slate-400">
                        <div className="flex items-center"><div className="w-3 h-3 bg-slate-700 border-t border-slate-500 mr-1"></div> Planifié</div>
                        <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 mr-1"></div> Réalisé</div>
                    </div>
                </Card>
            )}


            {/* Vue Détails "Coach" */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                        <Zap className="mr-2 text-yellow-400" size={20} /> Qualité de l&apos;Entraînement
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-400 text-sm">Intensité Moyenne (TSS/h)</span>
                            <div className="text-right">
                                <span className="text-white font-bold text-lg">{kpis.intensityFactor}</span>
                                <span className="text-xs text-slate-500 block">Objectif endurance: 40-60</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-400 text-sm">RPE Moyen</span>
                            <div className="text-right">
                                <span className={`font-bold text-lg ${Number(kpis.avgRpe) > 7 ? 'text-red-400' : 'text-white'}`}>{kpis.avgRpe}/10</span>
                                <span className="text-xs text-slate-500 block">Ressenti global</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-slate-400 text-sm">Taux de réalisation (À date)</span>
                            <div className="text-right">
                                <span className={`font-bold text-lg ${kpis.complianceRate < 80 ? 'text-orange-400' : 'text-emerald-400'}`}>{kpis.complianceRate}%</span>
                                <span className="text-xs text-slate-500 block">{kpis.completedCount} / {kpis.plannedCountSoFar} séances échues</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                        <Target className="mr-2 text-purple-400" size={20} /> Charge vs Objectif (Période)
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-400">Volume Horaire</span>
                                <span className="text-white font-mono">{Math.round((kpis.totalActualDuration / (kpis.totalPlannedDuration || 1)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-3">
                                <div
                                    className={`h-3 rounded-full transition-all duration-1000 ${kpis.totalActualDuration >= kpis.totalPlannedDuration ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(100, (kpis.totalActualDuration / (kpis.totalPlannedDuration || 1)) * 100)}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>Fait: {formatDuration(kpis.totalActualDuration)}</span>
                                <span>Prévu: {formatDuration(kpis.totalPlannedDuration)}</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-400">Charge Physiologique (TSS)</span>
                                <span className="text-white font-mono">{Math.round((kpis.totalActualTSS / (kpis.totalPlannedTSS || 1)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-3">
                                <div
                                    className={`h-3 rounded-full transition-all duration-1000 ${kpis.totalActualTSS > kpis.totalPlannedTSS * 1.1 ? 'bg-red-500' : 'bg-yellow-500'}`}
                                    style={{ width: `${Math.min(100, (kpis.totalActualTSS / (kpis.totalPlannedTSS || 1)) * 100)}%` }}
                                ></div>
                            </div>
                            {kpis.totalActualTSS > kpis.totalPlannedTSS * 1.1 && (
                                <p className="text-xs text-red-400 mt-2 flex items-center">
                                    <Info size={12} className="mr-1" /> Attention : Surcharge (+10%) détectée.
                                </p>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};