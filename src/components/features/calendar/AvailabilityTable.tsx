'use client';

import React from 'react';
import { Bike, Footprints, Waves, MessageSquare, Sparkle } from 'lucide-react';
import { DurationInput } from '@/components/features/profile/Availability';
import type { AvailabilitySlot } from '@/lib/data/type';

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

interface AvailabilityTableProps {
    availability: { [key: string]: AvailabilitySlot };
    activeSports: { swimming: boolean; cycling: boolean; running: boolean };
    onSlotChange: (day: string, sport: keyof Omit<AvailabilitySlot, 'comment'>, value: number) => void;
    onCommentChange: (day: string, value: string) => void;
    onAiChoiceChange: (day: string, value: boolean) => void;
}

export function AvailabilityTable({
    availability,
    activeSports,
    onSlotChange,
    onCommentChange,
    onAiChoiceChange,
}: AvailabilityTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="text-left py-2 font-medium text-slate-500 w-20 pl-1">Jour</th>
                        <th className="py-2 w-12 text-center">
                            <div className="flex justify-center">
                                <div className="p-1.5 bg-violet-100 dark:bg-violet-500/10 rounded-md text-violet-600 dark:text-violet-400">
                                    <Sparkle size={16} />
                                </div>
                            </div>
                        </th>
                        {activeSports.swimming && (
                            <th className="py-2 w-20 text-center">
                                <div className="flex justify-center">
                                    <div className="p-1.5 bg-cyan-100 dark:bg-cyan-500/10 rounded-md text-cyan-600 dark:text-cyan-400">
                                        <Waves size={16} />
                                    </div>
                                </div>
                            </th>
                        )}
                        {activeSports.cycling && (
                            <th className="py-2 w-20 text-center">
                                <div className="flex justify-center">
                                    <div className="p-1.5 bg-purple-100 dark:bg-purple-500/10 rounded-md text-purple-600 dark:text-purple-400">
                                        <Bike size={16} />
                                    </div>
                                </div>
                            </th>
                        )}
                        {activeSports.running && (
                            <th className="py-2 w-20 text-center">
                                <div className="flex justify-center">
                                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/10 rounded-md text-emerald-600 dark:text-emerald-400">
                                        <Footprints size={16} />
                                    </div>
                                </div>
                            </th>
                        )}
                        <th className="py-2 text-center">
                            <div className="flex justify-center">
                                <div className="p-1.5 bg-slate-100 dark:bg-slate-500/10 rounded-md text-slate-500 dark:text-slate-400">
                                    <MessageSquare size={16} />
                                </div>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                    {DAYS_FR.map(day => {
                        const slot = availability[day] ?? { swimming: 0, cycling: 0, running: 0, comment: '', aiChoice: false };
                        const isAiChoice = slot.aiChoice ?? false;
                        return (
                            <tr key={day} className={`group transition-colors ${isAiChoice ? 'bg-violet-50/50 dark:bg-violet-500/5' : 'hover:bg-slate-100/30 dark:hover:bg-slate-800/30'}`}>
                                <td className="py-1 pl-1 text-slate-500 dark:text-slate-400 font-medium capitalize text-xs">
                                    {day}
                                </td>
                                <td className="p-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => onAiChoiceChange(day, !isAiChoice)}
                                        title="Laisser l'IA décider"
                                        className={`p-1.5 rounded-md transition-all ${
                                            isAiChoice
                                                ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-300 dark:ring-violet-500/40'
                                                : 'text-slate-300 dark:text-slate-700 hover:text-slate-400 dark:hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <Sparkle size={14} />
                                    </button>
                                </td>
                                {activeSports.swimming && (
                                    <td className="p-1">
                                        {isAiChoice ? (
                                            <div className="w-full h-9 flex items-center justify-center">
                                                <span className="text-[10px] text-violet-400 dark:text-violet-500 font-medium">auto</span>
                                            </div>
                                        ) : (
                                            <DurationInput
                                                value={slot.swimming}
                                                onChange={val => onSlotChange(day, 'swimming', val)}
                                                placeholder="-"
                                                className="focus:text-cyan-400 focus:ring-cyan-500/50"
                                            />
                                        )}
                                    </td>
                                )}
                                {activeSports.cycling && (
                                    <td className="p-1">
                                        {isAiChoice ? (
                                            <div className="w-full h-9 flex items-center justify-center">
                                                <span className="text-[10px] text-violet-400 dark:text-violet-500 font-medium">auto</span>
                                            </div>
                                        ) : (
                                            <DurationInput
                                                value={slot.cycling}
                                                onChange={val => onSlotChange(day, 'cycling', val)}
                                                placeholder="-"
                                                className="focus:text-orange-400 focus:ring-orange-500/50"
                                            />
                                        )}
                                    </td>
                                )}
                                {activeSports.running && (
                                    <td className="p-1">
                                        {isAiChoice ? (
                                            <div className="w-full h-9 flex items-center justify-center">
                                                <span className="text-[10px] text-violet-400 dark:text-violet-500 font-medium">auto</span>
                                            </div>
                                        ) : (
                                            <DurationInput
                                                value={slot.running}
                                                onChange={val => onSlotChange(day, 'running', val)}
                                                placeholder="-"
                                                className="focus:text-emerald-400 focus:ring-emerald-500/50"
                                            />
                                        )}
                                    </td>
                                )}
                                <td className="p-1">
                                    <input
                                        type="text"
                                        value={slot.comment || ''}
                                        onChange={e => onCommentChange(day, e.target.value)}
                                        placeholder={isAiChoice ? "vacances, repos..." : "ex: club, chill..."}
                                        className="w-full min-w-[100px] bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-1 focus:ring-slate-400/30 transition-colors"
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-[10px] text-violet-500 dark:text-violet-400/70 italic">
                    <Sparkle size={9} />
                    <span>= l&apos;IA choisit le sport et la durée</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-600 italic">
                    &quot;1h30&quot;, &quot;90&quot;, &quot;1:30&quot; ou &quot;1.5&quot;
                </p>
            </div>
        </div>
    );
}
