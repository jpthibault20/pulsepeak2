/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    User, Clock, Activity, Target, Save, Zap, Heart, Timer,
    Waves, Bike, Footprints, MessageSquare, Calendar, ChevronDown, Check, Link2, AlertCircle,
    X,
    Send,
    LucideIcon
} from 'lucide-react';
import { Card, Button } from '@/components/ui'; // Assure-toi que ces imports existent ou utilise des div/button standards
import { calculateFtp, validatePowerTests } from '@/lib/ftp-calculator'; // Ta lib existante
import { Profile } from '@/lib/data/type';

// --- TYPES ÉTENDUS POUR LE TRIATHLON ---
export interface AvailabilitySlot {
    swim: number; // minutes
    bike: number;
    run: number;
    comment: string;
}

export interface ZoneData {
    min: number;
    max: number;
}



// --- SOUS-COMPOSANTS UI (Pour la lisibilité) ---
const SectionHeader = ({ icon: Icon, title, color = "text-white", rightContent }: { icon: LucideIcon; title: string; color?: string; rightContent?: React.ReactNode; }) => (
    <h3 className={`text-lg font-semibold ${color} mb-4 flex items-center justify-between border-b border-slate-800 pb-2`}>
        <span className="flex items-center">
            <Icon className="mr-2" size={20} />
            {title}
        </span>
        {rightContent && (
            <span className="text-xl text-white">
                {rightContent}
            </span>
        )}
    </h3>
);

const ChatWidget = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
        { role: 'ai', text: 'Bonjour ! Je suis votre coach Triathlon IA. Besoin d\'aide pour configurer vos zones ou votre emploi du temps ?' }
    ]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll vers le bas
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        const newMsg = { role: 'user' as const, text: input };
        setMessages([...messages, newMsg]);
        setInput('');

        // Simulation réponse IA
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'ai',
                text: "C'est noté. Je prends en compte cette information pour adapter votre plan d'entraînement."
            }]);
        }, 1000);
    };
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-20 right-4 md:right-10 w-[90vw] md:w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* Header Chat */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-bold text-white">Coach IA</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-slate-800 bg-slate-900 rounded-b-xl flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Posez une question..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={handleSend} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors">
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

function safeValue<T>(value: T | null | undefined, fallback: T): T {
    return value !== null && value !== undefined ? value : fallback;
}

const TabButton = ({ active, onClick, label, icon: Icon }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${active
            ? 'bg-slate-800 text-blue-400 border-t-2 border-blue-400'
            : 'bg-slate-900/50 text-slate-400 hover:text-slate-200'
            }`}
    >
        <Icon size={16} /> {label}
    </button>
);

// --- COMPOSANT PRINCIPAL ---

interface ProfileFormProps {
    initialData: Partial<Profile>;
    onSave: (data: Profile) => Promise<void>;
    onSuccess?: () => void;
    onCancel: () => void;
    isSettings?: boolean;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ initialData, onSave, onSuccess, onCancel, isSettings }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    // État initial par défaut
    const defaultData: Profile = {
        firstName: 'etst', lastName: '', email: '', weight: 70, birthDate: '',
        activeSports: { swim: true, bike: true, run: true },
        aiPersonality: 'Analytique',
        strava: { accessToken: '', refreshToken: '', expiresAt: 0, athleteId: 0 },
        weeklyAvailability: {
            'Lundi': { swim: 0, bike: 0, run: 0, comment: '' },
            'Mardi': { swim: 60, bike: 0, run: 45, comment: '' },
            'Mercredi': { swim: 0, bike: 90, run: 0, comment: '' },
            'Jeudi': { swim: 60, bike: 0, run: 45, comment: '' },
            'Vendredi': { swim: 0, bike: 0, run: 0, comment: 'Repos' },
            'Samedi': { swim: 0, bike: 180, run: 0, comment: 'Sortie longue' },
            'Dimanche': { swim: 0, bike: 0, run: 90, comment: '' },
        },
        ftp: 200, lthr: 170, vma: 15,
        powerTests: { p5min: 0, p8min: 0, p15min: 0, p20min: 0 },
        recentRaceTime: { distance: '10km', time: '00:00:00' },
        goal: 'Terminer un Ironman 70.3',
        weaknesses: '',
        experience: 'Débutant',
        objectiveDate: '',
    };

    const initialFormData = useMemo<Profile>(() => {
        // ✅ Si initialData est null, retourner defaultData directement
        if (!initialData) return defaultData;

        return {
            // Champs string
            firstName: safeValue(initialData.firstName, defaultData.firstName),
            lastName: safeValue(initialData.lastName, defaultData.lastName),
            email: safeValue(initialData.email, defaultData.email),
            birthDate: safeValue(initialData.birthDate, defaultData.birthDate),
            aiPersonality: safeValue(initialData.aiPersonality, defaultData.aiPersonality),

            // Champs number
            weight: safeValue(initialData.weight, defaultData.weight),
            ftp: safeValue(initialData.ftp, defaultData.ftp),
            lthr: safeValue(initialData.lthr, defaultData.lthr),
            vma: safeValue(initialData.vma, defaultData.vma),
            recentRaceTime: {
                distance: safeValue(initialData.recentRaceTime?.distance, defaultData.recentRaceTime.distance),
                time: safeValue(initialData.recentRaceTime?.time, defaultData.recentRaceTime.time),
            },

            // Enums
            experience: safeValue(initialData.experience, defaultData.experience),

            // PowerTests avec gestion de null
            powerTests: {
                p5min: safeValue(
                    initialData.powerTests?.p5min,
                    defaultData.powerTests!.p5min
                ),
                p8min: safeValue(
                    initialData.powerTests?.p8min,
                    defaultData.powerTests!.p8min
                ),
                p15min: safeValue(
                    initialData.powerTests?.p15min,
                    defaultData.powerTests!.p15min
                ),
                p20min: safeValue(
                    initialData.powerTests?.p20min,
                    defaultData.powerTests!.p20min
                ),
            },

            // WeeklyAvailability
            weeklyAvailability: (
                Object.keys(defaultData.weeklyAvailability) as Array<keyof typeof defaultData.weeklyAvailability>
            ).reduce((acc, day) => ({
                ...acc,
                [day]: {
                    swim: safeValue(
                        initialData.weeklyAvailability?.[day]?.swim,
                        defaultData.weeklyAvailability[day].swim
                    ),
                    bike: safeValue(
                        initialData.weeklyAvailability?.[day]?.bike,
                        defaultData.weeklyAvailability[day].bike
                    ),
                    run: safeValue(
                        initialData.weeklyAvailability?.[day]?.run,
                        defaultData.weeklyAvailability[day].run
                    ),
                    comment: safeValue(
                        initialData.weeklyAvailability?.[day]?.comment,
                        defaultData.weeklyAvailability[day].comment
                    ),
                }
            }), {} as Profile['weeklyAvailability']),

            // ActiveSports
            activeSports: {
                swim: safeValue(
                    initialData.activeSports?.swim,
                    defaultData.activeSports.swim
                ),
                bike: safeValue(
                    initialData.activeSports?.bike,
                    defaultData.activeSports.bike
                ),
                run: safeValue(
                    initialData.activeSports?.run,
                    defaultData.activeSports.run
                ),
            },



            // Autres champs
            goal: safeValue(initialData.goal, defaultData.goal),

            weaknesses: safeValue(initialData.weaknesses, defaultData.weaknesses),

            strava: safeValue(initialData.strava, defaultData.strava),

            objectiveDate: safeValue(initialData.objectiveDate, defaultData.objectiveDate)
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    const [formData, setFormData] = useState<Profile>(initialFormData);
    console.log(initialData);
    const [activeZoneTab, setActiveZoneTab] = useState<'power' | 'hr' | 'pace'>('power');
    const [isSaving, setIsSaving] = useState(false);

    // Calcul dynamique des totaux
    const getTotalHours = () => {
        let totalMin = 0;
        Object.values(formData.weeklyAvailability).forEach(slot => {
            if (formData.activeSports.swim) totalMin += slot.swim;
            if (formData.activeSports.run) totalMin += slot.run;
            if (formData.activeSports.bike) totalMin += slot.bike;
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

    const toggleSport = (sport: keyof typeof formData.activeSports) => {
        setFormData(prev => ({
            ...prev,
            activeSports: { ...prev.activeSports, [sport]: !prev.activeSports[sport] }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try { await onSave(formData); }
        catch (e) { console.error(e); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

            {/* HEADER */}
            <div className="text-center md:text-left md:flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Profil Athlète</h1>
                    <p className="text-slate-400 text-sm mt-1">Configurez vos paramètres physiologiques et vos préférences IA.</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`${isChatOpen ? 'bg-blue-600/20 text-blue-400 border-blue-500' : 'bg-slate-800 text-slate-300'} gap-2`}
                >
                    <MessageSquare size={18} /> {isChatOpen ? 'Masquer le Coach' : 'Coach IA'}
                </Button>
            </div>

            {/* 1. INFOS DE BASE & CONNEXIONS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Colonne Gauche : Identité */}
                <Card className="md:col-span-2 p-6 bg-slate-900/50 border-slate-800">
                    <SectionHeader icon={User} title="Informations Personnelles" color="text-blue-400" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            placeholder="Prénom"
                            value={formData.firstName}
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                            className="input-triathlon"
                        />
                        <input
                            placeholder="Nom"
                            value={formData.lastName}
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                            className="input-triathlon"
                        />
                        <input
                            type="email" placeholder="Email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="input-triathlon"
                        />
                        <input
                            type="date"
                            value={formData.birthDate}
                            onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                            className="input-triathlon flex-1"
                        />
                        <div className="flex-1 relative">
                            <input
                                type="number" placeholder="Poids"
                                value={formData.weight}
                                onChange={e => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                                className="input-triathlon"
                            />
                            <span className="absolute right-3 top-2.5 text-slate-500 text-sm">kg</span>
                        </div>
                    </div>
                </Card>

                {/* Colonne Droite : Sports & Strava */}
                <div className="space-y-6">
                    <Card className="p-6 bg-slate-900/50 border-slate-800">
                        <SectionHeader icon={Activity} title="Disciplines" />
                        <div className="space-y-3">
                            {[
                                { key: 'swim', label: 'Natation', icon: Waves, color: 'text-cyan-400', bg: 'bg-cyan-950/30 border-cyan-800' },
                                { key: 'bike', label: 'Cyclisme', icon: Bike, color: 'text-orange-400', bg: 'bg-orange-950/30 border-orange-800' },
                                { key: 'run', label: 'Running', icon: Footprints, color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800' },
                            ].map((sport) => (
                                <div
                                    key={sport.key}
                                    onClick={() => toggleSport(sport.key as any)}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${formData.activeSports[sport.key as keyof typeof formData.activeSports]
                                        ? `${sport.bg} border-opacity-50`
                                        : 'bg-slate-900 border-slate-800 opacity-60 grayscale'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <sport.icon className={sport.color} size={20} />
                                        <span className="text-slate-200 font-medium">{sport.label}</span>
                                    </div>
                                    {formData.activeSports[sport.key as keyof typeof formData.activeSports] && <Check size={16} className={sport.color} />}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-4 bg-slate-900/50 border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#FC4C02] opacity-10 rounded-bl-full pointer-events-none" />
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-[#FC4C02] rounded flex items-center justify-center text-white font-bold">S</div>
                            <div className="text-sm font-semibold text-white">Compte Strava</div>
                        </div>
                        {formData.strava?.athleteId ? (
                            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-950/30 p-2 rounded border border-green-900">
                                <Check size={14} /> Connecté
                            </div>
                        ) : (
                            <Button className="w-full bg-[#FC4C02] hover:bg-[#E34402] text-white h-9 text-sm" icon={Link2}>
                                Lier mon compte
                            </Button>
                        )}
                    </Card>
                </div>
            </div>

            {/* 2. DISPONIBILITÉS (MATRICE) */}
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
                                {formData.activeSports.swim && <th className="pb-3 font-medium text-cyan-400"><Waves size={16} className="inline mr-1" />Swim (min)</th>}
                                {formData.activeSports.bike && <th className="pb-3 font-medium text-orange-400"><Bike size={16} className="inline mr-1" />Bike (min)</th>}
                                {formData.activeSports.run && <th className="pb-3 font-medium text-emerald-400"><Footprints size={16} className="inline mr-1" />Run (min)</th>}
                                <th className="text-left pb-3 font-medium pl-4">Commentaire (Club, contrainte...)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {Object.keys(formData.weeklyAvailability).map((day) => (
                                <tr key={day} className="group hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 text-slate-300 font-medium">{day}</td>

                                    {/* Inputs Natation */}
                                    {formData.activeSports.swim && (
                                        <td className="py-2 text-center">
                                            <input
                                                type="number" step="15"
                                                value={formData.weeklyAvailability[day].swim || ''}
                                                onChange={(e) => handleAvailabilityChange(day, 'swim', e.target.value)}
                                                placeholder="-"
                                                className="w-16 h-8 bg-slate-900 border border-slate-700 rounded text-center text-white focus:border-cyan-500 outline-none"
                                            />
                                        </td>
                                    )}

                                    {/* Inputs Vélo */}
                                    {formData.activeSports.bike && (
                                        <td className="py-2 text-center">
                                            <input
                                                type="number" step="30"
                                                value={formData.weeklyAvailability[day].bike || ''}
                                                onChange={(e) => handleAvailabilityChange(day, 'bike', e.target.value)}
                                                placeholder="-"
                                                className="w-16 h-8 bg-slate-900 border border-slate-700 rounded text-center text-white focus:border-orange-500 outline-none"
                                            />
                                        </td>
                                    )}

                                    {/* Inputs Run */}
                                    {formData.activeSports.run && (
                                        <td className="py-2 text-center">
                                            <input
                                                type="number" step="10"
                                                value={formData.weeklyAvailability[day].run || ''}
                                                onChange={(e) => handleAvailabilityChange(day, 'run', e.target.value)}
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

            {/* 3. ZONES & TESTS (TABS) */}
            <Card className="p-0 bg-slate-900/50 border-slate-800 overflow-hidden">
                <div className="p-6 pb-0">
                    <SectionHeader icon={Zap} title="Physiologie & Zones" color="text-yellow-400" />
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-700 px-6 gap-2">
                    <TabButton
                        active={activeZoneTab === 'power'}
                        onClick={() => setActiveZoneTab('power')}
                        label="Puissance (Watt)"
                        icon={Zap}
                    />
                    <TabButton
                        active={activeZoneTab === 'hr'}
                        onClick={() => setActiveZoneTab('hr')}
                        label="Cardio (FC)"
                        icon={Heart}
                    />
                    <TabButton
                        active={activeZoneTab === 'pace'}
                        onClick={() => setActiveZoneTab('pace')}
                        label="Allure (Pace)"
                        icon={Timer}
                    />
                </div>

                <div className="p-6 bg-slate-900/80 min-h-[250px]">
                    {activeZoneTab === 'power' && (
                        <div className="animate-in fade-in slide-in-from-left-4">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-slate-400">Basé sur votre FTP vélo.</p>
                                <div className="text-orange-400 font-mono text-xl font-bold">{formData.ftp} W <span className="text-xs text-slate-500 font-normal">FTP</span></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                {/* Inputs simplifiés pour l'exemple */}
                                <div>
                                    <label className="text-xs text-slate-500">Test 5 min (Watts)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formData.powerTests?.p5min ?? ''}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            powerTests: {
                                                p8min: 0,
                                                p15min: 0,
                                                p20min: 0,
                                                ...prev.powerTests, // ✅ Garde les valeurs existantes
                                                p5min: parseInt(e.target.value, 10) || 0, // ✅ Override p5min
                                            }
                                        }))}
                                        className="input-triathlon mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Test 20 min (Watts)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formData.powerTests?.p20min ?? ''}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            powerTests: {
                                                p8min: 0,
                                                p15min: 0,
                                                p5min: 0,
                                                ...prev.powerTests, // ✅ Garde les valeurs existantes
                                                p20min: parseInt(e.target.value, 10) || 0,
                                            }
                                        }))}
                                        className="input-triathlon mt-1"
                                    />                                </div>
                            </div>
                            <Button variant="secondary" className="w-full" icon={Activity}>Recalculer mes zones de puissance</Button>
                        </div>
                    )}

                    {activeZoneTab === 'hr' && (
                        <div className="animate-in fade-in slide-in-from-left-4 space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                                <Heart className="text-red-500" />
                                <div>
                                    <h4 className="text-red-200 font-medium">Seuil Anaérobie (LTHR)</h4>
                                    <p className="text-xs text-red-400/70">Essentiel pour calibrer l&apos;effort sur les 3 sports.</p>
                                </div>
                                <input
                                    type="number"
                                    value={formData.lthr}
                                    onChange={e => setFormData({ ...formData, lthr: parseInt(e.target.value) })}
                                    className="ml-auto w-20 h-10 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold text-lg"
                                />
                                <span className="text-slate-500 text-sm">bpm</span>
                            </div>
                            <div className="grid grid-cols-5 gap-1 mt-4">
                                {[50, 60, 70, 80, 90].map((pct, i) => (
                                    <div key={i} className="h-2 rounded bg-slate-700 overflow-hidden">
                                        <div className={`h-full bg-red-500`} style={{ width: `${i * 20 + 20}%`, opacity: (i + 1) * 0.2 }} />
                                    </div>
                                ))}
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-2">Zone 2 estimée : {Math.round(formData.lthr * 0.65)} - {Math.round(formData.lthr * 0.80)} bpm</p>
                        </div>
                    )}

                    {activeZoneTab === 'pace' && (
                        <div className="animate-in fade-in slide-in-from-left-4 text-center py-8">
                            <Timer size={40} className="mx-auto text-emerald-500 mb-3 opacity-50" />
                            <p className="text-slate-300">Entrez votre temps de référence récent</p>
                            <div className="flex justify-center gap-4 mt-4 max-w-sm mx-auto">
                                <select className="bg-slate-800 border-slate-700 text-white rounded px-3 py-2 outline-none">
                                    <option>5 km</option>
                                    <option>10 km</option>
                                    <option>Semi</option>
                                </select>
                                <input type="text" placeholder="00:45:00" className="bg-slate-800 border-slate-700 text-white rounded px-3 py-2 outline-none w-32 text-center" />
                            </div>
                        </div>
                    )}
                </div>
            </Card>
            {/* 4. IA & OBJECTIFS */}
            <Card className="p-6 bg-slate-900/50 border-slate-800 border-t-4 border-t-purple-500">
                <SectionHeader icon={MessageSquare} title="Configuration du Coach IA" color="text-purple-400" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Objectif Principal</label>
                            <input
                                value={formData.goal}
                                onChange={e => setFormData({ ...formData, goal: e.target.value })}
                                className="input-triathlon"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Style de Coaching</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Strict', 'Encourageant', 'Analytique'].map(style => (
                                    <button
                                        key={style}
                                        onClick={() => setFormData({ ...formData, aiPersonality: style as any })}
                                        className={`text-xs py-2 px-1 rounded border transition-all ${formData.aiPersonality === style
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20'
                                            : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Points faibles / Notes pour l&apos;IA</label>
                        <textarea
                            value={formData.weaknesses}
                            onChange={e => setFormData({ ...formData, weaknesses: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-purple-500 outline-none h-32 resize-none text-sm"
                            placeholder="Ex: Je nage comme une enclume, j'ai peur des descentes en vélo..."
                        />
                    </div>
                </div>
            </Card>

            {/* ACTIONS FOOTER (Sticky mobile) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex justify-end gap-3 z-50 md:static md:bg-transparent md:border-none md:p-0">
                <Button variant="secondary" onClick={onCancel} className="bg-slate-800 text-white hover:bg-slate-700">
                    Annuler
                </Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 w-full md:w-auto" icon={Save}>
                    {isSaving ? 'Enregistrement...' : 'Valider le profil'}
                </Button>
            </div>

            <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

            <style jsx global>{`
        .input-triathlon {
          width: 100%;
          height: 44px;
          background-color: #0f172a; /* slate-900 */
          border: 1px solid #334155; /* slate-700 */
          border-radius: 0.5rem;
          padding: 0 1rem;
          color: white;
          outline: none;
          transition: all 0.2s;
        }
        .input-triathlon:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
      `}</style>
        </div>
    );
};