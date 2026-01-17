import { Card } from "@/components/ui/Card";
import { AvailabilitySlot, Profile } from "@/lib/data/type";
import { Dispatch, SetStateAction } from "react";
import { SectionHeader } from "./SessionHeader";
import { Bike, Calendar, Footprints, Waves } from "lucide-react";

interface AvailabilityProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

export const Availability: React.FC<AvailabilityProps> = ({ formData, setFormData }) => {

        // Calcul dynamique des totaux
        const getTotalHours = () => {
            let totalMin = 0;
            Object.values(formData.weeklyAvailability).forEach(slot => {
                if (formData.activeSports.swimming) totalMin += slot.swimming;
                if (formData.activeSports.running) totalMin += slot.running;
                if (formData.activeSports.cycling) totalMin += slot.cycling;
            });
            return (totalMin / 60).toFixed(1);
        };
    
        // Handlers
        const handleAvailabilityChange = (day: string, sport: keyof AvailabilitySlot, value: string | number) => {
            setFormData(prev => ({
                ...prev,
                weeklyAvailability: {
                    ...prev.weeklyAvailability,
                    [day]: {
                        ...prev.weeklyAvailability[day],
                        [sport]: typeof value === 'string' && sport !== 'comment' ? parseInt(value) || 0 : value
                    }
                }
            }));
        };
        
    return (
        <>
        <Card className="p-6 bg-slate-900/50 border-slate-800">
                <SectionHeader
                    icon={Calendar}
                    title="Disponibilités & Volume"
                    color="text-purple-400"
                    rightContent={<>{getTotalHours()}h</>}
                />
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-700">
                                <th className="text-left pb-3 font-medium w-24">Jour</th>
                                {formData.activeSports.swimming && <th className="pb-3 font-medium text-cyan-400"><Waves size={16} className="inline mr-1" />Swim (min)</th>}
                                {formData.activeSports.cycling && <th className="pb-3 font-medium text-orange-400"><Bike size={16} className="inline mr-1" />Bike (min)</th>}
                                {formData.activeSports.running && <th className="pb-3 font-medium text-emerald-400"><Footprints size={16} className="inline mr-1" />Run (min)</th>}
                                <th className="text-left pb-3 font-medium pl-4">Commentaire (Club, contrainte...)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {Object.keys(formData.weeklyAvailability).map((day) => (
                                <tr key={day} className="group hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 text-slate-300 font-medium">{day}</td>

                                    {/* Inputs Natation */}
                                    {formData.activeSports.swimming && (
                                        <td className="py-2 text-center">
                                            <input
                                                type="number" step="15"
                                                value={formData.weeklyAvailability[day].swimming || ''}
                                                onChange={(e) => handleAvailabilityChange(day, 'swimming', e.target.value)}
                                                placeholder="-"
                                                className="w-16 h-8 bg-slate-900 border border-slate-700 rounded text-center text-white focus:border-cyan-500 outline-none"
                                            />
                                        </td>
                                    )}

                                    {/* Inputs Vélo */}
                                    {formData.activeSports.cycling && (
                                        <td className="py-2 text-center">
                                            <input
                                                type="number" step="30"
                                                value={formData.weeklyAvailability[day].cycling || ''}
                                                onChange={(e) => handleAvailabilityChange(day, 'cycling', e.target.value)}
                                                placeholder="-"
                                                className="w-16 h-8 bg-slate-900 border border-slate-700 rounded text-center text-white focus:border-orange-500 outline-none"
                                            />
                                        </td>
                                    )}

                                    {/* Inputs Run */}
                                    {formData.activeSports.running && (
                                        <td className="py-2 text-center">
                                            <input
                                                type="number" step="10"
                                                value={formData.weeklyAvailability[day].running || ''}
                                                onChange={(e) => handleAvailabilityChange(day, 'running', e.target.value)}
                                                placeholder="-"
                                                className="w-16 h-8 bg-slate-900 border border-slate-700 rounded text-center text-white focus:border-emerald-500 outline-none"
                                            />
                                        </td>
                                    )}

                                    <td className="py-2 pl-4">
                                        <input
                                            type="text"
                                            value={formData.weeklyAvailability[day].comment}
                                            onChange={(e) => handleAvailabilityChange(day, 'comment', e.target.value)}
                                            placeholder="Ex: Club..."
                                            className="w-full h-8 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 outline-none text-slate-400 focus:text-white transition-all"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    );
}