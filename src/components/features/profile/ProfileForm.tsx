import { Card, Button } from "@/components/ui";
import { Profile } from "@/lib/data/type";
import { User, Clock, Calculator, Target, Save } from "lucide-react";
import { useState } from "react";

interface ProfileFormProps {
    initialProfileData: Profile | null;
    isSettings?: boolean;
    onSave: (data: Profile) => Promise<void>;
    onSuccess: (view: 'dashboard' | 'settings') => void;
    onCancel: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ initialProfileData, isSettings = false, onSave, onSuccess, onCancel }) => {
    const defaultData: Profile = {
        name: '',
        ftp: 200,
        weight: 70,
        experience: 'Intermédiaire',
        goal: 'Améliorer mon endurance',
        objectiveDate: '',
        weaknesses: 'Grimpeur',
        // targetWeeklyHours: 6, // SUPPRIMÉ : Calculé dynamiquement maintenant
        weeklyAvailability: {
            'Lundi': 60, 'Mardi': 60, 'Mercredi': 90, 'Jeudi': 60, 'Vendredi': 60, 'Samedi': 180, 'Dimanche': 120
        }
    };

    const [formData, setFormData] = useState<Profile>(initialProfileData || defaultData);
    const [isSaving, setIsSaving] = useState(false);

    const handleAvailabilityChange = (day: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            weeklyAvailability: {
                ...prev.weeklyAvailability,
                [day]: parseInt(value)
            }
        }));
    };

    const totalWeeklyMinutes = Object.values(formData.weeklyAvailability).reduce((acc, val) => acc + val, 0);
    const totalWeeklyHours = Math.floor(totalWeeklyMinutes / 60);
    const totalWeeklyMinutesRemainder = totalWeeklyMinutes % 60;

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await onSave(formData);
            onSuccess('dashboard');
        } catch (e) {
            console.error("Erreur de sauvegarde:", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`space-y-6 ${isSettings ? 'pb-20' : ''}`}>
            {!isSettings && (
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-white mb-2">Configuration CycloIA</h1>
                    <p className="text-slate-400">Pour un coaching de précision (Blocs 3+1, Affûtage, etc.)</p>
                </div>
            )}

            <Card>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <User className="mr-2 text-blue-400" size={20} /> Profil Cycliste
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Nom</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">FTP (Watts)</label>
                        <input
                            type="number"
                            value={formData.ftp}
                            onChange={e => setFormData({ ...formData, ftp: parseInt(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Poids (kg)</label>
                        <input
                            type="number"
                            value={formData.weight}
                            onChange={e => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-white mb-4 flex items-center border-t border-slate-700 pt-6">
                    <Clock className="mr-2 text-yellow-400" size={20} /> Disponibilités Hebdomadaires
                </h3>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4 mb-6">
                    {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
                        <div key={day} className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-300 w-24">{day}</label>
                            <div className="flex-1 mx-4">
                                <input
                                    type="range"
                                    min="0" max="300" step="30"
                                    value={formData.weeklyAvailability[day] || 0}
                                    onChange={(e) => handleAvailabilityChange(day, e.target.value)}
                                    className="w-full h-2 bg-blue-600/30 rounded-lg appearance-none cursor-pointer"
                                    style={{ background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formData.weeklyAvailability[day] || 0) / 300) * 100}%, #475569 ${((formData.weeklyAvailability[day] || 0) / 300) * 100}%, #475569 100%)` }}
                                />
                            </div>
                            <span className={`text-xs font-bold w-16 text-right ${formData.weeklyAvailability[day] === 0 ? 'text-slate-600' : 'text-blue-400'}`}>
                                {formData.weeklyAvailability[day] === 0 ? 'Repos' : `${Math.floor(formData.weeklyAvailability[day] / 60)}h${String(formData.weeklyAvailability[day] % 60).padStart(2, '0')}`}
                            </span>
                        </div>
                    ))}

                    <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
                        <div className="flex items-center text-slate-300">
                            <Calculator size={18} className="mr-2 text-blue-400" />
                            <span className="font-medium text-sm">Volume Total Possible :</span>
                        </div>
                        <span className="text-xl font-bold text-white">
                            {totalWeeklyHours}h<span className="text-sm text-slate-400">{totalWeeklyMinutesRemainder > 0 ? totalWeeklyMinutesRemainder : '00'}</span>
                        </span>
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-white mb-4 flex items-center border-t border-slate-700 pt-6">
                    <Target size={20} className="mr-2 text-red-400" /> Objectif & IA
                </h3>
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Type d&apos;objectif</label>
                            <select
                                value={formData.goal}
                                onChange={e => setFormData({ ...formData, goal: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option>Améliorer mon endurance</option>
                                <option>Gran Fondo / Cyclosportive</option>
                                <option>Course sur route (Compétition)</option>
                                <option>Contre-la-montre</option>
                                <option>Gravel / Ultra-distance</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Date (Optionnel)</label>
                            <input
                                type="date"
                                value={formData.objectiveDate}
                                onChange={e => setFormData({ ...formData, objectiveDate: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Points Faibles / Commentaires IA</label>
                        <textarea
                            value={formData.weaknesses}
                            onChange={e => setFormData({ ...formData, weaknesses: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-between gap-4">
                    {isSettings && <Button onClick={onCancel} variant="secondary" className="flex-1" disabled={isSaving}>Annuler</Button>}
                    <Button onClick={handleSubmit} className="flex-1" icon={Save} disabled={isSaving}>
                        {isSaving ? "Sauvegarde..." : (isSettings ? "Sauvegarder les modifications" : "Valider et Accéder au Coach")}
                    </Button>
                </div>
            </Card>
        </div>
    );
};