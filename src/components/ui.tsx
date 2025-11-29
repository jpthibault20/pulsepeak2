'use client';

import React, { useState, useMemo } from 'react';
import {
    User, Settings, Activity, Clock, Zap, Home, Mountain,
    ChevronLeft, ChevronRight, CheckCircle, XCircle,
    BrainCircuit, Plus, Save, Info, Dumbbell, BarChart2, CalendarDays, Target,
    TrendingUp, MapPin, Calculator, RefreshCw
} from 'lucide-react';
import { Profile, Workout } from '@/lib/data/type';

// --- Helper pour la date
const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// --- Composants de Base ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
    icon?: React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    variant = 'primary',
    className = '',
    disabled = false,
    icon: Icon,
    ...props
}) => {
    const baseStyles = "flex items-center justify-center px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",
        secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100",
        outline: "border border-slate-600 text-slate-300 hover:bg-slate-800",
        danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20",
        success: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20",
        ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {Icon && <Icon size={18} className="mr-2" />}
            {children}
        </button>
    );
};

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 ${className}`}>
        {children}
    </div>
);

export const Badge: React.FC<{ type: string }> = ({ type }) => {
    const styles: { [key: string]: string } = {
        Endurance: "bg-green-500/20 text-green-400 border-green-500/30",
        HIIT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        Threshold: "bg-red-500/20 text-red-400 border-red-500/30",
        Recovery: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        Tempo: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        Rest: "bg-slate-600/20 text-slate-400 border-slate-600/30",
        VO2max: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        PMA: "bg-pink-500/20 text-pink-400 border-pink-500/30",
        Fartlek: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
        Test: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    };

    const defaultStyle = "bg-slate-700 text-slate-300";

    return (
        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${styles[type] || defaultStyle}`}>
            {type}
        </span>
    );
};

// --- ManualWorkoutModal (MISE À JOUR) ---

interface ManualWorkoutModalProps {
    date: Date;
    onClose: () => void;
    onSave: (workout: Workout) => Promise<void>;
}

export const ManualWorkoutModal: React.FC<ManualWorkoutModalProps> = ({ date, onClose, onSave }) => {
    const [title, setTitle] = useState('Sortie Libre');
    const [type, setType] = useState('Endurance');
    const [duration, setDuration] = useState(0);
    const [distance, setDistance] = useState(0); // Nouvel état pour la distance
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
                status: 'completed', // Marqué comme fait
                description_outdoor: mode === 'Outdoor' ? description : 'Non spécifié',
                description_indoor: mode === 'Indoor' ? description : 'Non spécifié',
                completedData: {
                    actualDuration: duration, // On assume que le réalisé = le saisi
                    distance: distance,       // On assume que le réalisé = le saisi
                    rpe: 5,                   // Valeur par défaut neutre
                    avgPower: 0,              // Valeur par défaut (pas de saisie de puissance ici)
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-70 flex items-center justify-center p-4">
            <Card className="max-w-md w-full animate-in zoom-in-95">
                <h2 className="text-xl font-bold text-white mb-4">Ajouter une activité manuelle</h2>
                <p className="text-slate-400 text-sm mb-6">Pour le {date.toLocaleDateString('fr-FR')}</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Titre de la séance</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Type</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                                {['Endurance', 'Tempo', 'Threshold', 'HIIT', 'VO2max', 'Recovery', 'PMA', 'Force', 'Sprint'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Mode</label>
                            <select value={mode} onChange={e => setMode(e.target.value as 'Outdoor' | 'Indoor')} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                                <option value="Outdoor">Extérieur</option>
                                <option value="Indoor">Home Trainer</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Durée (min)</label>
                            <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Distance (km)</label>
                            <input type="number" step="0.1" value={distance} onChange={e => setDistance(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">TSS Estimé</label>
                        <input type="number" value={tss} onChange={e => setTss(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Description / Notes</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white h-20 resize-none" placeholder="Détails de la sortie..." />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>Annuler</Button>
                    <Button variant="primary" className="flex-1" onClick={handleSave} disabled={isSaving} icon={Plus}>Ajouter</Button>
                </div>
            </Card>
        </div>
    );
};

// --- ProfileForm ---

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

// --- GenerationModal ---

interface GenerationModalProps {
    onClose: () => void;
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string | null) => Promise<void>;
    isGenerating: boolean;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({ onClose, onGenerate, isGenerating }) => {
    const [blockFocus, setBlockFocus] = useState('Endurance');
    const [customTheme, setCustomTheme] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });

    const themes = [
        'Endurance', 'PMA', 'Seuil', 'Fartlek',
        'Semaine de Tests (FTP, VO2max)',
        'Sprint', 'Force', 'Cadence', 'Sweet Spot', 'Ascension', 'Personnalisé'
    ];

    const handleGenerate = async () => {
        await onGenerate(blockFocus, blockFocus === 'Personnalisé' ? customTheme : null, startDate);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <Card className="max-w-md w-full animate-in zoom-in-95">
                <h2 className="text-2xl font-bold text-white mb-4">Créer un Nouveau Bloc</h2>
                <p className="text-slate-400 mb-6 text-sm">
                    L&apos;IA va analyser votre historique récent pour calibrer l&apos;intensité et la périodisation (3+1 par défaut).
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Date de début du bloc</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    />

                    <label className="block text-sm font-medium text-slate-300 mb-2">Thème / Focus du bloc</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {themes.map((focus) => (
                            <button
                                key={focus}
                                onClick={() => setBlockFocus(focus)}
                                className={`p-3 rounded-lg text-sm text-left transition-all border truncate ${blockFocus === focus
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                    }`}
                                title={focus}
                            >
                                {focus === 'Semaine de Tests (FTP, VO2max)' ? 'Semaine de Tests' : focus}
                            </button>
                        ))}
                    </div>

                    {blockFocus === 'Personnalisé' && (
                        <div className="animate-in fade-in slide-in-from-top-2 mt-4">
                            <label className="block text-xs text-blue-400 mb-1">Décrivez votre thème</label>
                            <textarea
                                value={customTheme}
                                onChange={(e) => setCustomTheme(e.target.value)}
                                placeholder="Ex: Semaine choc montagne, Vitesse Piste..."
                                className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-3 text-white text-sm h-24 resize-none focus:ring-1 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isGenerating}>Annuler</Button>
                    <Button
                        variant="primary"
                        className="flex-1"
                        icon={BrainCircuit}
                        onClick={handleGenerate}
                        disabled={isGenerating || (blockFocus === 'Personnalisé' && customTheme.length < 3)}
                    >
                        {isGenerating ? "Génération..." : "Générer le Bloc"}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

// --- Nav ---

interface NavProps {
    onViewChange: (view: 'dashboard' | 'settings' | 'stats') => void;
    currentView: string;
}

export const Nav: React.FC<NavProps> = ({ onViewChange, currentView }) => (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewChange('dashboard')}>
                <div className="bg-linear-to-tr from-blue-600 to-cyan-500 p-2 rounded-lg">
                    <Dumbbell size={20} className="text-white" />
                </div>
                <span className="font-bold text-xl text-white tracking-tight">Cyclo<span className="text-blue-400">IA</span></span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={() => onViewChange('stats')}
                    className={`p-2 rounded-full transition-colors ${currentView === 'stats' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Statistiques"
                >
                    <BarChart2 size={20} />
                </button>
                <button
                    onClick={() => onViewChange('settings')}
                    className={`p-2 rounded-full transition-colors ${currentView === 'settings' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Paramètres & Profil"
                >
                    <Settings size={20} />
                </button>
            </div>
        </div>
    </nav>
);

// --- CalendarView ---

interface CalendarViewProps {
    scheduleData: { workouts: { [key: string]: Workout }, summary: string | null };
    onViewWorkout: (workout: Workout) => void;
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string | null) => Promise<void>;
    onAddManualWorkout: (workout: Workout) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ scheduleData, onViewWorkout, onGenerate, onAddManualWorkout }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showGenModal, setShowGenModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [dateForManual, setDateForManual] = useState<Date | null>(null);

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const formatDateKey = (date: Date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getWorkoutForDate = (dateObj: Date | null) => {
        if (!dateObj) return null;
        const dKey = formatDateKey(dateObj);
        return scheduleData.workouts?.[dKey];
    };

    const getModeIcon = (mode: string) => {
        return mode === 'Indoor' ? <Home size={12} className="text-sky-400" /> : <Mountain size={12} className="text-green-400" />;
    };

    const weeks = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        const weekRows: (Date | null)[][] = [];
        let currentWeek: (Date | null)[] = Array(startOffset).fill(null);

        for (let i = 1; i <= daysInMonth; i++) {
            currentWeek.push(new Date(year, month, i));
            if (currentWeek.length === 7) {
                weekRows.push(currentWeek);
                currentWeek = [];
            }
        }
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push(null);
            weekRows.push(currentWeek);
        }
        return weekRows;
    }, [year, month]);

    const getWeekStats = (weekDays: (Date | null)[]) => {
        let plannedTSS = 0;
        let actualDuration = 0;
        let plannedDuration = 0;
        let distance = 0;
        let completed = 0;
        let total = 0;

        weekDays.forEach(date => {
            const workout = getWorkoutForDate(date);
            if (workout) {
                total++;
                plannedTSS += workout.tss || 0;
                plannedDuration += workout.duration || 0;
                if (workout.status === 'completed') {
                    completed++;
                    actualDuration += workout.completedData?.actualDuration
                        ? Number(workout.completedData.actualDuration)
                        : (workout.duration || 0);
                    distance += workout.completedData?.distance
                        ? Number(workout.completedData.distance)
                        : 0;
                }
            }
        });
        return { plannedTSS, plannedDuration, actualDuration, distance, completed, total };
    };

    const handleGeneratePlan = async (blockFocus: string, customTheme: string | null, startDate: string | null) => {
        setIsGenerating(true);
        try {
            await onGenerate(blockFocus, customTheme, startDate);
        } catch (e) {
            console.error("Erreur de génération du plan:", e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleOpenManualModal = (e: React.MouseEvent, date: Date) => {
        e.stopPropagation();
        setDateForManual(date);
        setShowManualModal(true);
    };

    const handleSaveManual = async (workout: Workout) => {
        await onAddManualWorkout(workout);
    };

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Synthèse IA */}
            {scheduleData.summary && (
                <div className="bg-linear-to-r from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl p-4 flex items-start gap-4 shadow-lg">
                    <div className="bg-blue-500/20 p-2 rounded-lg shrink-0">
                        <Info className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-blue-300 font-bold text-sm uppercase tracking-wide mb-1">Stratégie du Bloc Actuel</h3>
                        <p className="text-slate-300 text-sm leading-relaxed italic">
                            &apos;{scheduleData.summary}&apos;
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <button onClick={() => setSelectedDate(new Date(year, month - 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-white min-w-[180px] text-center">
                        {monthNames[month]} {year}
                    </h2>
                    <button onClick={() => setSelectedDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                        <ChevronRight size={24} />
                    </button>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        icon={BrainCircuit}
                        onClick={() => handleGeneratePlan('Objectif Principal', null, null)}
                        disabled={isGenerating}
                        className="text-sm"
                    >
                        Recalculer le Bloc
                    </Button>
                    <Button
                        variant="primary"
                        icon={Plus}
                        onClick={() => setShowGenModal(true)}
                        disabled={isGenerating}
                    >
                        Nouveau Bloc
                    </Button>
                </div>
            </div>

            {isGenerating && (
                <div className="w-full bg-slate-800 rounded-lg p-3 text-center text-blue-400 flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p>Génération en cours...</p>
                </div>
            )}

            {/* Grille Calendrier */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-8 bg-slate-800/50 border-b border-slate-700">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Bilan'].map(d => (
                        <div key={d} className={`py-3 text-center text-sm font-semibold ${d === 'Bilan' ? 'text-blue-400 bg-slate-800/80' : 'text-slate-400'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-8 auto-rows-fr">
                    {weeks.map((week, wIdx) => {
                        const stats = getWeekStats(week);

                        return (
                            <React.Fragment key={wIdx}>
                                {week.map((date, dIdx) => {
                                    const workout = getWorkoutForDate(date);
                                    const isToday = date && formatDateKey(date) === formatDateKey(new Date());

                                    return (
                                        <div
                                            key={dIdx}
                                            onClick={() => date && workout ? onViewWorkout(workout) : null}
                                            className={`
                                                min-h-[100px] md:min-h-[140px] border-b border-r border-slate-800 p-2 relative transition-colors group
                                                ${!date ? 'bg-slate-950' : workout ? 'bg-slate-900 hover:bg-slate-800 cursor-pointer' : 'bg-slate-900/50 hover:bg-slate-800/80'}
                                                ${isToday ? 'ring-1 ring-inset ring-blue-500/50 bg-blue-900/5' : ''}
                                            `}
                                        >
                                            {date && (
                                                <>
                                                    <div className="flex justify-between items-start">
                                                        <span className={`text-sm font-medium ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                                                            {date.getDate()}
                                                        </span>

                                                        {/* BOUTON AJOUT MANUEL */}
                                                        {!workout && (
                                                            <button
                                                                onClick={(e) => handleOpenManualModal(e, date)}
                                                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-opacity p-1"
                                                                title="Ajouter une séance"
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {workout && (
                                                        <div className="mt-2 flex flex-col gap-1.5 animate-in fade-in zoom-in duration-300">
                                                            <div className="flex justify-between items-center">
                                                                <span className={`text-[10px] px-1.5 rounded-sm font-bold uppercase truncate
                                                                    ${workout.type === 'Rest' ? 'text-slate-500' :
                                                                        workout.type === 'HIIT' || workout.type === 'PMA' ? 'text-orange-400 bg-orange-950/30' :
                                                                            workout.type === 'VO2max' ? 'text-purple-400 bg-purple-950/30' :
                                                                                workout.type === 'Test' ? 'text-cyan-400 bg-cyan-950/30' :
                                                                                    'text-blue-300 bg-blue-950/30'}
                                                                `}>
                                                                    {workout.type}
                                                                </span>
                                                                {workout.mode && <div className='p-0.5 rounded-full bg-slate-700'>{getModeIcon(workout.mode)}</div>}
                                                            </div>
                                                            <span className="text-xs text-slate-200 leading-tight line-clamp-2">{workout.title}</span>
                                                            {workout.duration && <span className="text-[10px] text-slate-500">{workout.duration} min</span>}

                                                            {workout.status === 'completed' && <CheckCircle size={14} className="absolute top-2 right-2 text-emerald-500" />}
                                                            {workout.status === 'missed' && <XCircle size={14} className="absolute top-2 right-2 text-red-500" />}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Cellule Bilan de la Semaine */}
                                <div className="min-h-[100px] md:min-h-[140px] border-b border-slate-700 bg-slate-800/40 p-2 flex flex-col justify-center gap-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="flex items-center"><Zap size={12} className="mr-1 text-yellow-500" /> TSS</span>
                                        <span className="font-mono text-white">{stats.plannedTSS}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="flex items-center"><Clock size={12} className="mr-1 text-blue-500" /> Durée</span>
                                        <span className="font-mono text-white">{Math.floor(stats.plannedDuration / 60)}h{stats.plannedDuration % 60 > 0 ? stats.plannedDuration % 60 : ''}</span>
                                    </div>
                                    {(stats.actualDuration > 0 || stats.distance > 0) && (
                                        <div className="mt-1 pt-1 border-t border-slate-700">
                                            <div className="flex items-center justify-between text-xs text-emerald-400">
                                                <span className="flex items-center"><TrendingUp size={12} className="mr-1" /> Réel</span>
                                                <span className="font-mono">{Math.floor(stats.actualDuration / 60)}h</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-emerald-400">
                                                <span className="flex items-center"><MapPin size={12} className="mr-1" /> Dist.</span>
                                                <span className="font-mono">{stats.distance.toFixed(0)}km</span>
                                            </div>
                                        </div>
                                    )}
                                    {stats.total > 0 && (
                                        <div className="mt-1 w-full bg-slate-700 rounded-full h-1.5">
                                            <div
                                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {showGenModal && (
                <GenerationModal
                    onClose={() => setShowGenModal(false)}
                    onGenerate={handleGeneratePlan}
                    isGenerating={isGenerating}
                />
            )}

            {showManualModal && dateForManual && (
                <ManualWorkoutModal
                    date={dateForManual}
                    onClose={() => setShowManualModal(false)}
                    onSave={handleSaveManual}
                />
            )}
        </div>
    );
};

// --- StatsView (COMPOSANT) ---

interface StatsViewProps {
    scheduleData: { workouts: { [key: string]: Workout } };
    profile: Profile;
}

export const StatsView: React.FC<StatsViewProps> = ({ scheduleData, profile }) => {
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
        const stats = new Array(12).fill(0).map(() => ({ plannedTss: 0, actualTss: 0 }));

        allWorkouts.forEach(w => {
            const date = new Date(w.date);
            if (date.getFullYear() === currentYear) {
                const month = date.getMonth();
                stats[month].plannedTss += w.tss || 0;

                if (w.status === 'completed') {
                    const actualTssVal = w.completedData?.actualDuration
                        ? (w.completedData.actualDuration / (w.duration || 1)) * (w.tss || 0)
                        : (w.tss || 0);
                    stats[month].actualTss += actualTssVal;
                }
            }
        });
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
                    <div className="w-4 h-[1px] bg-slate-600"></div>
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
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                    <CalendarDays className="mr-2 text-blue-400" size={20} /> Progression Saisonnière (TSS / Mois)
                </h3>
                <div className="flex items-end justify-between h-48 gap-2">
                    {annualStats.map((m, idx) => {
                        const maxTss = Math.max(...annualStats.map(s => Math.max(s.plannedTss, s.actualTss)), 100);
                        const heightPlanned = Math.max((m.plannedTss / maxTss) * 100, 2);
                        const heightActual = Math.max((m.actualTss / maxTss) * 100, 0);

                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                <div className="w-full bg-slate-800/50 rounded-t-sm relative h-full flex flex-col justify-end">
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

// --- FeedbackForm et WorkoutDetailView (Identiques) ---
const FeedbackForm: React.FC<{
    workout: Workout;
    profile: Profile;
    onSave: (feedback: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => Promise<void>;
    onCancel: () => void;
}> = ({ workout, profile, onSave, onCancel }) => {
    const [rpe, setRpe] = useState(6);
    const [avgPower, setAvgPower] = useState(profile.ftp ? Math.round(profile.ftp * 0.7) : 150);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [actualDuration, setActualDuration] = useState(workout.duration);
    const [distance, setDistance] = useState(0);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ rpe, avgPower, actualDuration, distance, notes });
        } catch (e) {
            console.error("Erreur d'enregistrement du feedback:", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 mt-4 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-emerald-400 font-bold mb-4 flex items-center">
                <CheckCircle size={18} className="mr-2" /> Rapport de séance
            </h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">RPE (1-10)</label>
                    <input
                        type="number" min="1" max="10"
                        value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Puissance Moyenne (W)</label>
                    <input
                        type="number"
                        value={avgPower} onChange={(e) => setAvgPower(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Durée Réelle (min)</label>
                    <input
                        type="number"
                        value={actualDuration} onChange={(e) => setActualDuration(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Distance (km)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={distance} onChange={(e) => setDistance(parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-1">Sensations / Notes</label>
                <textarea
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaires..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm h-20 resize-none"
                />
            </div>
            <div className="flex gap-2">
                <Button variant="ghost" onClick={onCancel} className="flex-1 h-10 py-0 text-sm" disabled={isSaving}>Annuler</Button>
                <Button
                    variant="success"
                    className="flex-1 h-10 py-0 text-sm"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
            </div>
        </div>
    );
};
interface WorkoutDetailViewProps {
    workout: Workout;
    profile: Profile;
    onClose: () => void;
    onUpdate: (dateKey: string, status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => Promise<void>;
    onToggleMode: (dateKey: string) => Promise<void>;
    onMoveWorkout: (originalDateStr: string, newDateStr: string) => Promise<void>;
}

export const WorkoutDetailView: React.FC<WorkoutDetailViewProps> = ({
    workout,
    profile,
    onClose,
    onUpdate,
    onToggleMode,
    onMoveWorkout,
}) => {
    const [isCompleting, setIsCompleting] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [newMoveDate, setNewMoveDate] = useState('');
    const [isMutating, setIsMutating] = useState(false);

    const currentDescription = workout.mode === 'Outdoor'
        ? workout.description_outdoor
        : workout.description_indoor;

    const ModeIcon = workout.mode === 'Outdoor' ? Mountain : Home;

    const handleToggle = async () => {
        setIsMutating(true);
        try {
            await onToggleMode(workout.date);
        } catch (e) {
            console.error("Erreur bascule de mode:", e);
        } finally {
            setIsMutating(false);
        }
    };

    const handleMove = async () => {
        if (!newMoveDate) return;
        setIsMutating(true);
        try {
            await onMoveWorkout(workout.date, newMoveDate);
            onClose(); // Ferme après le déplacement
        } catch (e) {
            console.error("Erreur de déplacement:", e);
        } finally {
            setIsMutating(false);
        }
    };

    const handleStatusUpdate = async (status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, actualDuration: number, distance: number, notes: string }) => {
        setIsMutating(true);
        try {
            await onUpdate(workout.date, status, feedback);
            setIsCompleting(false);
        } catch (e) {
            console.error("Erreur de mise à jour du statut:", e);
        } finally {
            setIsMutating(false);
        }
    };


    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95 duration-300">
            <button
                onClick={onClose}
                className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
            >
                <ChevronLeft size={20} className="mr-1" /> Retour
            </button>

            <Card className="border-t-4 border-t-blue-500 shadow-2xl relative">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge type={workout.type} />
                            <span className="text-slate-500 text-sm flex items-center">
                                <Clock size={14} className="mr-1" /> {workout.duration} min
                            </span>
                            <span className="text-slate-500 text-sm flex items-center">
                                <Zap size={14} className="mr-1" /> TSS: {workout.tss || '-'}
                            </span>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-1">{workout.title}</h1>
                        <p className="text-slate-400 text-sm">{formatDate(workout.date)}</p>
                    </div>

                    {workout.status === 'completed' && workout.completedData && (
                        <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-2 text-right">
                            <div className="text-xs text-emerald-400 font-bold uppercase mb-1">Accompli</div>
                            <div className="text-white text-sm font-mono">{workout.completedData.avgPower}W</div>
                            <div className="text-slate-400 text-xs">RPE: {workout.completedData.rpe}/10</div>
                        </div>
                    )}
                </div>

                {/* Toggle Mode Home Trainer / Extérieur */}
                {workout.type !== 'Rest' && (
                    <div className="flex justify-end mb-4 border-b border-slate-700 pb-4 flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            className={`text-sm p-2 h-auto ${workout.mode === 'Indoor' ? 'border border-sky-500/30 bg-sky-900/20 text-sky-400' : 'text-slate-400'}`}
                            onClick={handleToggle}
                            icon={ModeIcon}
                            disabled={isMutating}
                        >
                            Mode: {workout.mode === 'Outdoor' ? 'Extérieur' : 'Home Trainer'}
                        </Button>
                        <Button variant="ghost" className="text-sm h-8" onClick={() => setIsMoving(!isMoving)} icon={CalendarDays} disabled={isMutating}>
                            Déplacer
                        </Button>
                    </div>
                )}

                {/* Modal de déplacement */}
                {isMoving && (
                    <div className="mb-6 bg-slate-900 border border-slate-700 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-bold text-white mb-2 flex items-center">
                            <CalendarDays size={16} className="mr-2 text-blue-400" /> Déplacer la séance
                        </h4>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-2 text-sm flex-1"
                                onChange={(e) => setNewMoveDate(e.target.value)}
                            />
                            <Button
                                variant="secondary"
                                className="py-1 text-sm"
                                onClick={() => setIsMoving(false)}
                                disabled={isMutating}
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="primary"
                                className="py-1 text-sm"
                                disabled={isMutating || !newMoveDate || newMoveDate === workout.date}
                                onClick={handleMove}
                            >
                                {isMutating ? "Valider" : "Déplacer"}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="bg-slate-900/50 rounded-xl p-6 mb-8 border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Activity size={20} className="mr-2 text-blue-400" />
                        Structure de la séance ({workout.mode})
                    </h3>
                    <div className="prose prose-invert max-w-none text-slate-300 whitespace-pre-line leading-relaxed font-mono text-sm">
                        {currentDescription}
                    </div>
                </div>

                {isCompleting ? (
                    <FeedbackForm
                        workout={workout}
                        profile={profile}
                        onCancel={() => setIsCompleting(false)}
                        onSave={(data) => handleStatusUpdate('completed', data)}
                    />
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-700">
                        {workout.status !== 'completed' && (
                            <Button
                                variant="success"
                                onClick={() => setIsCompleting(true)}
                                className="flex items-center justify-center"
                                disabled={isMutating}
                            >
                                <CheckCircle size={16} className="mr-2" /> J&apos;ai fait la séance
                            </Button>
                        )}

                        {workout.status === 'completed' && (
                            <Button
                                variant="outline"
                                onClick={() => handleStatusUpdate('pending')}
                                disabled={isMutating}
                            >
                                Réinitialiser
                            </Button>
                        )}

                        {/* Bouton Déplacer */}
                        {workout.status !== 'completed' && (
                            <Button
                                variant="secondary"
                                onClick={() => setIsMoving(!isMoving)}
                                className="flex items-center justify-center"
                                icon={CalendarDays}
                                disabled={isMutating}
                            >
                                Déplacer
                            </Button>
                        )}

                        {workout.status !== 'missed' && workout.status !== 'completed' && (
                            <Button
                                variant="danger"
                                onClick={() => handleStatusUpdate('missed')}
                                disabled={isMutating}
                            >
                                <XCircle size={16} className="mr-2" /> Raté
                            </Button>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};

export { ChevronLeft };
