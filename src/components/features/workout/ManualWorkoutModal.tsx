import { Card, Button } from "@/components/ui";
import { Workout } from "@/lib/data/type";
import { Plus, Calendar, Activity, Timer, TrendingUp, AlignLeft } from "lucide-react";
import { useState } from "react";

interface ManualWorkoutModalProps {
    date: Date;
    onClose: () => void;
    onSave: (workout: Workout) => Promise<void>;
}

export const ManualWorkoutModal: React.FC<ManualWorkoutModalProps> = ({ date, onClose, onSave }) => {
    const [title, setTitle] = useState('Sortie Libre');
    const [type, setType] = useState('Endurance');
    const [duration, setDuration] = useState(60); // Par défaut 1h c'est plus logique que 0
    const [distance, setDistance] = useState(0);
    const [tss, setTss] = useState(0);
    const [mode, setMode] = useState<'Outdoor' | 'Indoor'>('Outdoor');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const newWorkout: Workout = {
                date: dateStr,
                title,
                type,
                duration,
                distance,
                tss,
                mode,
                status: 'completed',
                description_outdoor: mode === 'Outdoor' ? description : 'Non spécifié',
                description_indoor: mode === 'Indoor' ? description : 'Non spécifié',
                completedData: {
                    actualDuration: duration,
                    distance: distance,
                    rpe: 5,
                    avgPower: 0,
                    notes: description
                }
            };

            await onSave(newWorkout);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        // DESIGN: z-50 est le standard Tailwind pour les modales.
        // backdrop-blur-sm pour l'effet moderne.
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">

            {/* DESIGN: max-h-[90vh] et overflow-y-auto permettent de scroller dans la modale si l'écran est petit (mode paysage mobile) */}
            <Card className="w-full max-w-lg animate-in zoom-in-95 duration-200 border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">

                <div className="mb-6 border-b border-slate-800 pb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus className="text-blue-500" size={24} />
                        Ajouter une activité
                    </h2>
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                        <Calendar size={14} />
                        {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Titre */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                            <Activity size={14} className="text-slate-500" />
                            Titre de la séance
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                            placeholder="Ex: Sortie longue dimanche"
                        />
                    </div>

                    {/* Grid Type & Mode */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Type d&apos;effort</label>
                            <div className="relative">
                                <select
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                    className="w-full h-11 appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    {['Endurance', 'Tempo', 'Threshold', 'HIIT', 'VO2max', 'Recovery', 'PMA', 'Force', 'Sprint'].map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                {/* Custom arrow for select */}
                                <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Environnement</label>
                            <div className="relative">
                                <select
                                    value={mode}
                                    onChange={e => setMode(e.target.value as 'Outdoor' | 'Indoor')}
                                    className="w-full h-11 appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="Outdoor">Extérieur (Route/Gravel)</option>
                                    <option value="Indoor">Intérieur (Home Trainer)</option>
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grid Durée & Distance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                                <Timer size={14} className="text-slate-500" /> Durée (min)
                            </label>
                            <input
                                type="number"
                                value={duration}
                                onChange={e => setDuration(parseInt(e.target.value) || 0)}
                                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                                <TrendingUp size={14} className="text-slate-500" /> Distance (km)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={distance}
                                onChange={e => setDistance(parseFloat(e.target.value) || 0)}
                                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                            />
                        </div>
                    </div>

                    {/* TSS (Input pleine largeur pour le distinguer) */}
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Charge (TSS Estimé)</label>
                        <input
                            type="number"
                            value={tss}
                            onChange={e => setTss(parseInt(e.target.value) || 0)}
                            className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                            placeholder="Ex: 50"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Laissez 0 si inconnu. Une heure endurance ≈ 40-50 TSS.</p>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-1.5">
                            <AlignLeft size={14} className="text-slate-500" /> Description / Notes
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Détails de la sortie, météo, sensations..."
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 pt-4 border-t border-slate-800">
                    <Button
                        variant="ghost"
                        className="flex-1 h-12 sm:h-10 text-slate-400 hover:text-white"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1 h-12 sm:h-10 shadow-lg shadow-blue-900/20"
                        onClick={handleSave}
                        disabled={isSaving}
                        icon={isSaving ? undefined : Plus}
                    >
                        {isSaving ? "Ajout..." : "Ajouter la séance"}
                    </Button>
                </div>
            </Card>
        </div>
    );
};