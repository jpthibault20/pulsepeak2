import { Card } from "@/components/ui/Card";
import { AvailabilitySlot } from "@/lib/data/type";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { SectionHeader } from "./SessionHeader";
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
const DurationInput = ({
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

    return (
        <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
            <div className="p-6">
                <SectionHeader
                    icon={Calendar}
                    title="Volume Hebdomadaire"
                    color="text-purple-400"
                    rightContent={
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-700">
                            <Clock size={14} className="text-slate-400" />
                            <span className="text-sm font-semibold text-slate-200">{getTotalHours()} <span className="text-slate-500 font-normal">/ sem</span></span>
                        </div>
                    }
                />

                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800">
                                <th className="text-left py-3 font-medium text-slate-500 w-24 pl-2">Jour</th>

                                {formData.activeSports.swimming && (
                                    <th className="py-3 w-24 text-center"> {/* Colonne un peu plus large pour le texte */}
                                        <div className="flex justify-center">
                                            <div className="p-1.5 bg-cyan-500/10 rounded-md text-cyan-400">
                                                <Waves size={18} />
                                            </div>
                                        </div>
                                    </th>
                                )}

                                {formData.activeSports.cycling && (
                                    <th className="py-3 w-24 text-center">
                                        <div className="flex justify-center">
                                            <div className="p-1.5 bg-orange-500/10 rounded-md text-orange-400">
                                                <Bike size={18} />
                                            </div>
                                        </div>
                                    </th>
                                )}

                                {formData.activeSports.running && (
                                    <th className="py-3 w-24 text-center">
                                        <div className="flex justify-center">
                                            <div className="p-1.5 bg-emerald-500/10 rounded-md text-emerald-400">
                                                <Footprints size={18} />
                                            </div>
                                        </div>
                                    </th>
                                )}

                                <th className="text-left py-3 pl-6 font-medium text-slate-500">
                                    Notes
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-800/50">
                            {Object.keys(formData.weeklyAvailability).map((day) => (
                                <tr key={day} className="group hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 pl-2 text-slate-300 font-medium capitalize">
                                        {day}
                                    </td>

                                    {/* NATATION */}
                                    {formData.activeSports.swimming && (
                                        <td className="p-1">
                                            <DurationInput
                                                value={formData.weeklyAvailability[day].swimming}
                                                onChange={(val) => handleSportChange(day, 'swimming', val)}
                                                placeholder="-"
                                                className="focus:text-cyan-400 focus:ring-cyan-500/50"
                                            />
                                        </td>
                                    )}

                                    {/* VÉLO */}
                                    {formData.activeSports.cycling && (
                                        <td className="p-1">
                                            <DurationInput
                                                value={formData.weeklyAvailability[day].cycling}
                                                onChange={(val) => handleSportChange(day, 'cycling', val)}
                                                placeholder="-"
                                                className="focus:text-orange-400 focus:ring-orange-500/50"
                                            />
                                        </td>
                                    )}

                                    {/* COURSE */}
                                    {formData.activeSports.running && (
                                        <td className="p-1">
                                            <DurationInput
                                                value={formData.weeklyAvailability[day].running}
                                                onChange={(val) => handleSportChange(day, 'running', val)}
                                                placeholder="-"
                                                className="focus:text-emerald-400 focus:ring-emerald-500/50"
                                            />
                                        </td>
                                    )}

                                    {/* COMMENTAIRE */}
                                    <td className="p-1 pl-4">
                                        <input
                                            type="text"
                                            value={formData.weeklyAvailability[day].comment || ''}
                                            onChange={(e) => handleCommentChange(day, e.target.value)}
                                            placeholder="Club, récup, ..."
                                            className="w-full h-9 bg-transparent text-sm text-slate-400 placeholder-slate-700 rounded px-2 outline-none focus:text-slate-200 focus:bg-slate-800 transition-all hover:bg-slate-800/30"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-4 flex justify-end gap-x-4">
                        <p className="text-[11px] text-slate-500 italic">
                            Astuce: Tapez &quot;1h30&quot;, &quot;90&quot;, &quot;1:30&quot; ou &quot;1.5&quot;
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
