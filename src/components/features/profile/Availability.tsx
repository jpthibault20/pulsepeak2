import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { AvailabilitySlot } from "@/lib/data/type";
import { Bike, Calendar, Footprints, Waves, Clock } from "lucide-react";
import { Profile } from "@/lib/data/DatabaseTypes";

interface AvailabilityProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

// --- 1. HELPER (Hors du composant pour être réutilisé) ---
const formatMinutesToDuration = (minutes: number | undefined): string => {
    if (!minutes || minutes === 0) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h${m < 10 ? '0' : ''}${m}`; // Ex: 1h30
    if (h > 0) return `${h}h`;  // Ex: 1h
    return `${m}m`; // Ex: 45m
};

// --- 2. COMPOSANT CORRIGÉ ---
export const DurationInput = ({
    value,
    onChange,
    placeholder,
    className
}: {
    value: number | undefined,
    onChange: (val: number) => void,
    placeholder?: string,
    className?: string
}) => {
    // CORRECTION ICI : On initialise l'état directement avec la valeur formatée.
    // Plus besoin d'attendre le premier useEffect pour voir quelque chose.
    const [localStr, setLocalStr] = useState(() => formatMinutesToDuration(value));

    // Synchronisation : Uniquement si la valeur externe change (ex: reset du formulaire)
    useEffect(() => {
        const expectedStr = formatMinutesToDuration(value);
        // On ne met à jour que si l'affichage est différent de ce qu'il devrait être
        // Cela évite la boucle de rendu infinie ou l'erreur "cascading renders"
        if (localStr !== expectedStr) {
            setLocalStr(expectedStr);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleBlur = () => {
        const text = localStr.toLowerCase().trim();

        // Si vide, on envoie 0
        if (!text) {
            if (value !== 0) onChange(0);
            return;
        }

        let totalMinutes = 0;

        // Logique "Point = Séparateur" (Ta demande spécifique)
        // On normalise : "h", ".", "," deviennent tous ":"
        const normalized = text.replace(/[h.,]/g, ':');

        if (normalized.includes(':')) {
            // Cas "1.30", "1:30", "1h30" -> Split
            const parts = normalized.split(':');
            const h = parseInt(parts[0]) || 0;
            const m = parseInt(parts[1]) || 0;
            totalMinutes = (h * 60) + m;
        } else {
            // Cas "90", "120" ou "2"
            const num = parseFloat(text);
            if (!isNaN(num)) {
                // Si < 8, on assume que ce sont des heures (2 -> 2h)
                // Sinon des minutes (90 -> 1h30)
                totalMinutes = num < 8 ? num * 60 : num;
            }
        }

        // IMPORTANT : On notifie le parent uniquement si le chiffre a changé
        // pour éviter de redéclencher des renders inutiles
        if (totalMinutes !== value) {
            onChange(totalMinutes);
        }

        // On force le ré-affichage propre immédiatement (ex: on tape "90" -> ça devient "1h30")
        setLocalStr(formatMinutesToDuration(totalMinutes));
    };

    return (
        <input
            type="text"
            value={localStr}
            onChange={(e) => setLocalStr(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
            placeholder={placeholder}
            className={`w-full h-9 bg-transparent text-center text-slate-300 placeholder-slate-700 font-medium rounded outline-none ring-1 ring-transparent transition-all hover:bg-slate-800/50 focus:bg-slate-800 ${className}`}
            style={{ caretColor: 'white' }}
        />
    );
};




// --- 2. COMPOSANT PRINCIPAL ---
export const Availability: React.FC<AvailabilityProps> = ({ formData, setFormData }) => {

    const getTotalHours = () => {
        let totalMin = 0;
        Object.values(formData.weeklyAvailability).forEach(slot => {
            if (formData.activeSports.swimming) totalMin += slot.swimming || 0;
            if (formData.activeSports.running) totalMin += slot.running || 0;
            if (formData.activeSports.cycling) totalMin += slot.cycling || 0;
        });
        // Affichage joli du header (ex: 5h30)
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return m > 0 ? `${h}h${m}` : `${h}h`;
    };

    const handleSportChange = (day: string, sport: keyof AvailabilitySlot, minutes: number) => {
        setFormData(prev => ({
            ...prev,
            weeklyAvailability: {
                ...prev.weeklyAvailability,
                [day]: {
                    ...prev.weeklyAvailability[day],
                    [sport]: minutes
                }
            }
        }));
    };

    const handleCommentChange = (day: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            weeklyAvailability: {
                ...prev.weeklyAvailability,
                [day]: { ...prev.weeklyAvailability[day], comment: value }
            }
        }));
    };

    const activeSportList = [
        formData.activeSports.swimming && { key: 'swimming' as const, icon: Waves, color: 'text-cyan-400', ring: 'focus:ring-cyan-500/50 focus:text-cyan-300', accent: 'bg-cyan-500/10' },
        formData.activeSports.cycling  && { key: 'cycling'  as const, icon: Bike,  color: 'text-orange-400', ring: 'focus:ring-orange-500/50 focus:text-orange-300', accent: 'bg-orange-500/10' },
        formData.activeSports.running  && { key: 'running'  as const, icon: Footprints, color: 'text-emerald-400', ring: 'focus:ring-emerald-500/50 focus:text-emerald-300', accent: 'bg-emerald-500/10' },
    ].filter(Boolean) as { key: 'swimming'|'cycling'|'running'; icon: React.ElementType; color: string; ring: string; accent: string }[];

    return (
        <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
            <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Calendar size={14} className="text-purple-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Volume Hebdomadaire</h3>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
                        <Clock size={12} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-200">{getTotalHours()}<span className="text-slate-500 font-normal ml-0.5">/sem</span></span>
                    </div>
                </div>

                {/* Desktop : tableau */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800">
                                <th className="text-left py-3 font-medium text-slate-500 w-24 pl-2">Jour</th>
                                {activeSportList.map(s => (
                                    <th key={s.key} className="py-3 w-24 text-center">
                                        <div className="flex justify-center">
                                            <div className={`p-1.5 ${s.accent} rounded-md ${s.color}`}>
                                                <s.icon size={16} />
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="text-left py-3 pl-4 font-medium text-slate-500">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {Object.keys(formData.weeklyAvailability).map((day) => (
                                <tr key={day} className="group hover:bg-slate-800/30 transition-colors">
                                    <td className="py-2.5 pl-2 text-slate-300 font-medium text-sm">{day}</td>
                                    {activeSportList.map(s => (
                                        <td key={s.key} className="p-1">
                                            <DurationInput
                                                value={formData.weeklyAvailability[day][s.key]}
                                                onChange={(val) => handleSportChange(day, s.key, val)}
                                                placeholder="-"
                                                className={s.ring}
                                            />
                                        </td>
                                    ))}
                                    <td className="p-1 pl-3">
                                        <input
                                            type="text"
                                            value={formData.weeklyAvailability[day].comment || ''}
                                            onChange={(e) => handleCommentChange(day, e.target.value)}
                                            placeholder="Club, récup, ..."
                                            className="w-full h-9 bg-transparent text-sm text-slate-400 placeholder-slate-700 rounded px-2 outline-none focus:text-slate-200 focus:bg-slate-800 transition-all"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile : cartes par jour */}
                <div className="sm:hidden space-y-2">
                    {Object.keys(formData.weeklyAvailability).map((day) => {
                        const slot = formData.weeklyAvailability[day];
                        const total = activeSportList.reduce((s, sp) => s + (slot[sp.key] || 0), 0);
                        const isEmpty = total === 0;
                        return (
                            <div key={day} className={`rounded-xl border transition-all ${isEmpty ? 'border-slate-800 bg-slate-900/30' : 'border-slate-700 bg-slate-800/40'}`}>
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className={`text-sm font-semibold ${isEmpty ? 'text-slate-500' : 'text-white'}`}>{day}</span>
                                    {total > 0 && (
                                        <span className="text-xs text-slate-400 font-medium">
                                            {Math.floor(total / 60) > 0 ? `${Math.floor(total / 60)}h` : ''}{total % 60 > 0 ? `${total % 60}m` : ''}
                                        </span>
                                    )}
                                </div>
                                {activeSportList.length > 0 && (
                                    <div className="px-4 pb-3 grid grid-cols-3 gap-2">
                                        {activeSportList.map(s => (
                                            <div key={s.key} className="space-y-1">
                                                <div className={`flex items-center gap-1 ${s.color}`}>
                                                    <s.icon size={11} />
                                                    <span className="text-[10px] uppercase tracking-wide font-medium opacity-70">
                                                        {s.key === 'swimming' ? 'Natation' : s.key === 'cycling' ? 'Vélo' : 'Course'}
                                                    </span>
                                                </div>
                                                <DurationInput
                                                    value={slot[s.key]}
                                                    onChange={(val) => handleSportChange(day, s.key, val)}
                                                    placeholder="—"
                                                    className={`text-sm ${s.ring} bg-slate-900/60 rounded-lg ring-1 ring-slate-700`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Note */}
                                <div className="px-4 pb-3">
                                    <input
                                        type="text"
                                        value={slot.comment || ''}
                                        onChange={(e) => handleCommentChange(day, e.target.value)}
                                        placeholder="Note (club, récup...)"
                                        className="w-full h-8 bg-transparent text-xs text-slate-400 placeholder-slate-600 rounded px-1 outline-none focus:text-slate-200 border-b border-slate-800 focus:border-slate-600 transition-all"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="text-[11px] text-slate-600 italic mt-3 text-right">
                    Format accepté : 1h30, 90, 1:30, 1.5
                </p>
            </div>
        </Card>
    );
}
