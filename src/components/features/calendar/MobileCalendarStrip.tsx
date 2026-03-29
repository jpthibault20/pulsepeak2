'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Plus, BedDouble, Trophy, Target, Calendar, MapPin, Mountain } from 'lucide-react';
import type { Workout } from '@/lib/data/DatabaseTypes';
import { WorkoutBadge } from './WorkoutBadge';
import { MobileWeekBar } from './MobileWeekBar';
import { useCalendarContext } from './CalendarContext';
import { formatDateKey, DAY_NAMES_SHORT, MONTH_NAMES } from '@/lib/utils';
import type { WeekStats } from '@/hooks/useWeekStats';

interface MobileCalendarStripProps {
    weekRows: (Date | null)[][];
    currentMonth: number;
    selectedDay: Date;
    onSelectDay: (date: Date) => void;
    onOpenManualModal: (e: React.MouseEvent, date: Date) => void;
}

// DAY_NAMES_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'] (Mon=0)
// date.getDay() returns 0=Sun, so offset: (getDay() + 6) % 7
function getDayLabel(date: Date): string {
    return DAY_NAMES_SHORT[(date.getDay() + 6) % 7];
}

const SPORT_DOT: Record<string, string> = {
    cycling:  'bg-sky-500',
    running:  'bg-orange-500',
    swimming: 'bg-cyan-500',
    strength: 'bg-purple-500',
    default:  'bg-slate-400',
};

function getDotColor(workout: Workout): string {
    if (workout.status === 'completed') return 'bg-emerald-500';
    if (workout.status === 'missed')    return 'bg-red-500';
    return SPORT_DOT[workout.sportType?.toLowerCase()] ?? SPORT_DOT.default;
}

const SPORT_LABELS: Record<string, string> = {
    cycling:   'Vélo',
    running:   'Course',
    swimming:  'Natation',
    triathlon: 'Triathlon',
    duathlon:  'Duathlon',
};

export function MobileCalendarStrip({
    weekRows,
    currentMonth,
    selectedDay,
    onSelectDay,
    onOpenManualModal,
}: MobileCalendarStripProps) {
    const { scheduleData, profile, objectives, onViewWorkout, onEditObjective, onRefresh, onOpenGenModal } = useCalendarContext();
    const scrollRef  = useRef<HTMLDivElement>(null);
    const todayKey   = useMemo(() => formatDateKey(new Date()), []);
    const selectedKey = formatDateKey(selectedDay);

    // All days of the current month (flat, no nulls)
    const monthDays = useMemo(() =>
        weekRows.flat().filter((d): d is Date => d !== null && d.getMonth() === currentMonth)
    , [weekRows, currentMonth]);

    // Workouts for the selected day
    const dayWorkouts = useMemo(() =>
        scheduleData.workouts.filter(w => w.date === selectedKey)
    , [selectedKey, scheduleData.workouts]);

    // Objectives for the selected day
    const dayObjectives = useMemo(() =>
        objectives.filter(o => o.date === selectedKey)
    , [selectedKey, objectives]);

    // Auto-scroll the selected day into view whenever it changes
    useEffect(() => {
        const el = scrollRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [selectedKey, currentMonth]);

    // ── Week stats for the selected day ──
    const selectedWeek = useMemo(() => {
        return weekRows.find(week =>
            week.some(d => d !== null && formatDateKey(d) === selectedKey)
        ) ?? [];
    }, [weekRows, selectedKey]);

    const weekStartDate = useMemo(() => {
        const firstNonNull = selectedWeek.find(d => d !== null);
        if (!firstNonNull) return null;
        const idx = selectedWeek.indexOf(firstNonNull);
        const monday = new Date(firstNonNull);
        monday.setDate(monday.getDate() - idx);
        return formatDateKey(monday);
    }, [selectedWeek]);

    const weekStats = useMemo<WeekStats>(() => {
        const stats: WeekStats = {
            plannedTSS: 0, plannedDuration: 0, actualDuration: 0, distance: 0,
            completed: 0, completedTSS: 0, total: 0,
            sportBreakdown: { cycling: 0, running: 0, swimming: 0, other: 0 },
            sportDuration:  { cycling: 0, running: 0, swimming: 0, other: 0 },
        };
        const dates = new Set(
            selectedWeek.filter((d): d is Date => d !== null).map(d => formatDateKey(d))
        );
        scheduleData.workouts.forEach(w => {
            if (!dates.has(w.date)) return;
            stats.total++;
            stats.plannedTSS += w.plannedData.plannedTSS ?? 0;
            stats.plannedDuration += w.plannedData.durationMinutes;
            const sport = w.sportType as keyof typeof stats.sportBreakdown;
            if (stats.sportBreakdown[sport] !== undefined) {
                stats.sportBreakdown[sport]++;
            }
            if (w.status === 'completed' && w.completedData) {
                stats.completed++;
                stats.actualDuration += w.completedData.actualDurationMinutes;
                stats.distance += w.completedData.distanceKm ?? 0;
                const cd = w.completedData;
                const tss = cd.metrics?.cycling?.tss ?? cd.calculatedTSS ?? w.plannedData.plannedTSS ?? 0;
                stats.completedTSS += tss;
                if (stats.sportDuration[sport] !== undefined) {
                    stats.sportDuration[sport] += cd.actualDurationMinutes;
                }
            } else {
                if (stats.sportDuration[sport] !== undefined) {
                    stats.sportDuration[sport] += w.plannedData.durationMinutes;
                }
            }
        });
        return stats;
    }, [selectedWeek, scheduleData.workouts]);

    const { isPastWeek, isFarFuture, weeksAhead } = useMemo(() => {
        const today = new Date();
        const day = today.getDay();
        const daysToMon = day === 0 ? -6 : 1 - day;
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() + daysToMon);
        thisMonday.setHours(0, 0, 0, 0);

        const weekStart = weekStartDate ? new Date(weekStartDate + 'T00:00:00') : null;
        const past = weekStart ? weekStart < thisMonday : false;
        const ahead = weekStart
            ? Math.round((weekStart.getTime() - thisMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
            : 0;
        return { isPastWeek: past, isFarFuture: ahead >= 2, weeksAhead: ahead };
    }, [weekStartDate]);

    return (
        <div className="space-y-4">

            {/* ── Horizontal Day Strip ── */}
            <div
                ref={scrollRef}
                className="flex gap-1 overflow-x-auto px-0.5 pb-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {monthDays.map(date => {
                    const key        = formatDateKey(date);
                    const isSelected = key === selectedKey;
                    const isToday    = key === todayKey;
                    const wks        = scheduleData.workouts.filter(w => w.date === key);
                    const dayObjs    = objectives.filter(o => o.date === key);
                    const hasPrimary = dayObjs.some(o => o.priority === 'principale');
                    const hasSecondary = !hasPrimary && dayObjs.length > 0;

                    return (
                        <button
                            key={key}
                            data-selected={isSelected ? 'true' : 'false'}
                            onClick={() => onSelectDay(date)}
                            className={`
                                flex-shrink-0 flex flex-col items-center
                                w-[46px] pt-2.5 pb-2.5 rounded-2xl
                                transition-all duration-150 focus:outline-none
                                ${isSelected
                                    ? 'bg-blue-600 shadow-md shadow-blue-500/20 dark:shadow-blue-900/40'
                                    : isToday
                                        ? 'bg-slate-100 dark:bg-slate-800 ring-1 ring-blue-400/60 dark:ring-blue-500/60'
                                        : hasPrimary
                                            ? 'bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-500/40'
                                            : hasSecondary
                                                ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500/30'
                                                : 'bg-transparent active:bg-slate-100/80 dark:active:bg-slate-800/60'
                                }
                            `}
                        >
                            {/* Day abbreviation */}
                            <span className={`
                                text-[9px] font-semibold uppercase tracking-widest leading-none mb-1.5
                                ${isSelected ? 'text-blue-200' : isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}
                            `}>
                                {getDayLabel(date)}
                            </span>

                            {/* Day number */}
                            <span className={`
                                text-[15px] font-bold leading-none
                                ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}
                            `}>
                                {date.getDate()}
                            </span>

                            {/* Sport dots + objective indicator */}
                            <div className="flex gap-[3px] mt-1.5 h-[5px] items-center">
                                {hasPrimary && (
                                    <div className="w-[5px] h-[5px] rounded-full bg-rose-400" />
                                )}
                                {hasSecondary && (
                                    <div className="w-[5px] h-[5px] rounded-full bg-amber-400" />
                                )}
                                {wks.length === 0 && !hasPrimary && !hasSecondary
                                    ? <div className="w-[5px] h-[5px] rounded-full bg-transparent" />
                                    : wks.slice(0, hasPrimary || hasSecondary ? 2 : 3).map((w, i) => (
                                        <div
                                            key={i}
                                            className={`w-[5px] h-[5px] rounded-full ${getDotColor(w)}`}
                                        />
                                    ))
                                }
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Week Summary Bar ── */}
            <MobileWeekBar
                stats={weekStats}
                weekStartDate={weekStartDate}
                isPastWeek={isPastWeek}
                isFarFuture={isFarFuture}
                weeksAhead={weeksAhead}
                profileAvailability={profile.weeklyAvailability}
                activeSports={profile.activeSports}
                onRefresh={onRefresh}
                onOpenGenModal={onOpenGenModal}
            />

            {/* ── Selected Day Header ── */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {getDayLabel(selectedDay)} {selectedDay.getDate()} {MONTH_NAMES[selectedDay.getMonth()]}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {dayWorkouts.length > 0
                            ? `${dayWorkouts.length} séance${dayWorkouts.length > 1 ? 's' : ''}`
                            : 'Aucune séance planifiée'}
                        {dayObjectives.length > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 ml-1">
                                · {dayObjectives.length} objectif{dayObjectives.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={e => onOpenManualModal(e, selectedDay)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors border border-slate-200/60 dark:border-slate-700/60"
                >
                    <Plus size={14} />
                    Ajouter
                </button>
            </div>

            {/* ── Objective Cards ── */}
            {dayObjectives.length > 0 && (
                <div className="space-y-2">
                    {dayObjectives.map(obj => {
                        const isPrimary = obj.priority === 'principale';
                        return (
                            <div
                                key={obj.id}
                                onClick={() => onEditObjective(obj)}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                                    isPrimary
                                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/40'
                                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isPrimary ? 'bg-rose-100 dark:bg-rose-600/20 border border-rose-200 dark:border-rose-500/30' : 'bg-amber-100 dark:bg-amber-600/20 border border-amber-200 dark:border-amber-500/30'
                                }`}>
                                    {isPrimary
                                        ? <Trophy size={13} className="text-rose-600 dark:text-rose-400" />
                                        : <Target size={13} className="text-amber-600 dark:text-amber-400" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-slate-900 dark:text-white text-sm font-semibold truncate">{obj.name}</span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                            isPrimary
                                                ? 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                                                : 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                                        }`}>
                                            {isPrimary ? 'Principal' : 'Secondaire'}
                                        </span>
                                    </div>
                                    <p className="text-slate-500 text-xs mt-0.5">{SPORT_LABELS[obj.sport] ?? obj.sport}</p>
                                    <div className="flex flex-wrap gap-2.5 mt-1">
                                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                            <Calendar size={9} />
                                            {new Date(obj.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                        {obj.distanceKm && (
                                            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                <MapPin size={9} />
                                                {obj.distanceKm} km
                                            </span>
                                        )}
                                        {obj.elevationGainM && (
                                            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                <Mountain size={9} />
                                                {obj.elevationGainM} m D+
                                            </span>
                                        )}
                                    </div>
                                    {obj.comment && (
                                        <p className="text-slate-500 text-xs mt-1 italic line-clamp-1">{obj.comment}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Divider */}
            <div className="h-px bg-slate-200 dark:bg-slate-800/80" />

            {/* ── Day Workouts ── */}
            {dayWorkouts.length > 0 ? (
                <div className="space-y-3">
                    {dayWorkouts.map(workout => (
                        <WorkoutBadge
                            key={workout.id}
                            workout={workout}
                            onClick={() => onViewWorkout(workout)}
                            isCompact={false}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100/60 dark:bg-slate-800/50 flex items-center justify-center">
                        <BedDouble size={22} className="text-slate-400 dark:text-slate-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-slate-500">Jour de repos</p>
                        <p className="text-xs text-slate-500 dark:text-slate-600 mt-0.5">Aucune séance planifiée</p>
                    </div>
                </div>
            )}
        </div>
    );
}
