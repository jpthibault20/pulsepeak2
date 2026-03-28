'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Plus, BedDouble } from 'lucide-react';
import type { Workout } from '@/lib/data/DatabaseTypes';
import { WorkoutBadge } from './WorkoutBadge';
import { formatDateKey, DAY_NAMES_SHORT, MONTH_NAMES } from '@/lib/utils';
import { Schedule } from '@/lib/data/DatabaseTypes';

interface MobileCalendarStripProps {
    weekRows: (Date | null)[][];
    currentMonth: number;
    scheduleData: Schedule;
    selectedDay: Date;
    onSelectDay: (date: Date) => void;
    onOpenManualModal: (e: React.MouseEvent, date: Date) => void;
    onViewWorkout: (workout: Workout) => void;
}

// DAY_NAMES_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'] (Mon=0)
// date.getDay() returns 0=Sun, so offset: (getDay() + 6) % 7
function getDayLabel(date: Date): string {
    return DAY_NAMES_SHORT[(date.getDay() + 6) % 7];
}

const SPORT_DOT: Record<string, string> = {
    cycling:  'bg-blue-500',
    running:  'bg-orange-500',
    swimming: 'bg-cyan-500',
    other:    'bg-purple-500',
};

export function MobileCalendarStrip({
    weekRows,
    currentMonth,
    scheduleData,
    selectedDay,
    onSelectDay,
    onOpenManualModal,
    onViewWorkout,
}: MobileCalendarStripProps) {
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

    // Auto-scroll the selected day into view whenever it changes
    useEffect(() => {
        const el = scrollRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [selectedKey, currentMonth]);

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
                                    ? 'bg-blue-600 shadow-md shadow-blue-900/40'
                                    : isToday
                                        ? 'bg-slate-800 ring-1 ring-blue-500/60'
                                        : 'bg-transparent active:bg-slate-800/60'
                                }
                            `}
                        >
                            {/* Day abbreviation */}
                            <span className={`
                                text-[9px] font-semibold uppercase tracking-widest leading-none mb-1.5
                                ${isSelected ? 'text-blue-200' : isToday ? 'text-blue-400' : 'text-slate-500'}
                            `}>
                                {getDayLabel(date)}
                            </span>

                            {/* Day number */}
                            <span className={`
                                text-[15px] font-bold leading-none
                                ${isSelected ? 'text-white' : 'text-slate-200'}
                            `}>
                                {date.getDate()}
                            </span>

                            {/* Sport dots */}
                            <div className="flex gap-[3px] mt-1.5 h-[5px] items-center">
                                {wks.length === 0
                                    ? <div className="w-[5px] h-[5px] rounded-full bg-transparent" />
                                    : wks.slice(0, 3).map((w, i) => (
                                        <div
                                            key={i}
                                            className={`w-[5px] h-[5px] rounded-full ${SPORT_DOT[w.sportType] ?? 'bg-slate-400'}`}
                                        />
                                    ))
                                }
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Selected Day Header ── */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {getDayLabel(selectedDay)} {selectedDay.getDate()} {MONTH_NAMES[selectedDay.getMonth()]}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {dayWorkouts.length > 0
                            ? `${dayWorkouts.length} séance${dayWorkouts.length > 1 ? 's' : ''}`
                            : 'Aucune séance planifiée'}
                    </p>
                </div>
                <button
                    onClick={e => onOpenManualModal(e, selectedDay)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-colors border border-slate-700/60"
                >
                    <Plus size={14} />
                    Ajouter
                </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-800/80" />

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
                    <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                        <BedDouble size={22} className="text-slate-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-slate-500">Jour de repos</p>
                        <p className="text-xs text-slate-600 mt-0.5">Aucune séance planifiée</p>
                    </div>
                </div>
            )}
        </div>
    );
}
