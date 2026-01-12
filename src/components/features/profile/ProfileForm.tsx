/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    User, Activity, Target, Save, Zap, Heart, Timer,
    Waves, Bike, Footprints, MessageSquare, Calendar,
    Check, Link2, X, Send, Calculator, TrendingUp
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
// On suppose que ces fonctions existent dans votre projet comme avant
import { calculateFtp, validatePowerTests } from '@/lib/ftp-calculator';

// --- TYPES & INTERFACES ---
type SportKey = keyof TriProfile['activeSports'];

export interface AvailabilitySlot {
    swim: number; bike: number; run: number; comment: string;
}

export interface ZoneRange { min: number; max: number; }
export interface Zones { z1: ZoneRange; z2: ZoneRange; z3: ZoneRange; z4: ZoneRange; z5: ZoneRange; z6: ZoneRange; z7: ZoneRange; }

export interface TriProfile {
    // Base
    firstName: string; lastName: string; email: string; weight: number; birthDate: string;
    runnerType: 'Sprinter' | 'Endurance' | 'Hybride' | 'Débutant';

    // App
    activeSports: { swim: boolean; bike: boolean; run: boolean; };
    stravaConnected: boolean;

    // Disponibilités
    weeklyAvailability: Record<string, AvailabilitySlot>;

    // Performance & Zones
    ftp: number;
    lthr: number;
    zones?: Zones; // Les zones calculées
    seasonData?: any; // wPrime etc.

    // Données brutes pour calcul
    powerTests: { p5min: number; p8min: number; p15min: number; p20min: number };

    // IA Context
    goal: string;
    weaknesses: string;
}

// --- SOUS-COMPOSANT : CHAT WIDGET ---
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

// --- COMPOSANT PRINCIPAL ---

interface ProfileFormProps {
    initialData?: Partial<TriProfile>;
    onSave: (data: TriProfile) => Promise<void>;
    onCancel: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ initialData, onSave, onCancel }) => {

    // -- STATE INITIAL --
    const defaultData: TriProfile = {
        firstName: '', lastName: '', email: '', weight: 70, birthDate: '',
        runnerType: 'Endurance',
        activeSports: { swim: true, bike: true, run: true },
        stravaConnected: false,
        weeklyAvailability: {
            'Lundi': { swim: 0, bike: 0, run: 0, comment: '' },
            'Mardi': { swim: 60, bike: 0, run: 45, comment: '' },
            'Mercredi': { swim: 0, bike: 90, run: 0, comment: '' },
            'Jeudi': { swim: 60, bike: 0, run: 45, comment: '' },
            'Vendredi': { swim: 0, bike: 0, run: 0, comment: 'Repos' },
            'Samedi': { swim: 0, bike: 180, run: 0, comment: 'Sortie longue' },
            'Dimanche': { swim: 0, bike: 0, run: 90, comment: '' },
        },
        ftp: 200, lthr: 170,
        powerTests: { p5min: 0, p8min: 0, p15min: 0, p20min: 0 },
        goal: 'Terminer un Ironman 70.3',
        weaknesses: ''
    };

    const [formData, setFormData] = useState<TriProfile>({ ...defaultData, ...initialData });
    const [activeZoneTab, setActiveZoneTab] = useState<'power' | 'hr' | 'pace'>('power');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // -- LOGIQUE CALCUL ZONES (Code original adapté) --
    const handleCalculateZones = () => {
        try {
            const tests = formData.powerTests;
            // Validation basique
            if (!tests.p20min && !tests.p5min) {
                alert('Veuillez entrer au moins une valeur (20min ou 5min).');
                return;
            }

            // Appel à la librairie (simulation si la lib n'est pas présente)
            // const result = calculateFtp(tests); 

            // MOCK du résultat pour l'exemple UI (à remplacer par le vrai appel calculateFtp(tests))
            // Ici je reproduis la logique pour que l'UI fonctionne
            const estimatedFtp = tests.p20min ? Math.floor(tests.p20min * 0.95) : Math.floor(tests.p5min * 0.85);
            const zonesCalc: Zones = {
                z1: { min: 0, max: Math.floor(estimatedFtp * 0.55) },
                z2: { min: Math.floor(estimatedFtp * 0.56), max: Math.floor(estimatedFtp * 0.75) },
                z3: { min: Math.floor(estimatedFtp * 0.76), max: Math.floor(estimatedFtp * 0.90) },
                z4: { min: Math.floor(estimatedFtp * 0.91), max: Math.floor(estimatedFtp * 1.05) },
                z5: { min: Math.floor(estimatedFtp * 1.06), max: Math.floor(estimatedFtp * 1.20) },
                z6: { min: Math.floor(estimatedFtp * 1.21), max: Math.floor(estimatedFtp * 1.50) },
                z7: { min: Math.floor(estimatedFtp * 1.51), max: 9999 },
            };

            setFormData((prev) => ({
                ...prev,
                ftp: estimatedFtp,
                zones: zonesCalc,
                // seasonData: result.seasonData 
            }));

        } catch (error) {
            console.error('Erreur calcul', error);
        }
    };

    // -- HANDLERS GENERIQUES --
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

    // Remplacez votre ancienne fonction toggleSport par celle-ci :
    const toggleSport = (sport: SportKey) => {
        setFormData(prev => ({
            ...prev,
            activeSports: {
                ...prev.activeSports,
                [sport]: !prev.activeSports[sport]
            }
        }));
    };

    // -- RENDER --
    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24 relative">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Profil Athlète</h1>
                    <p className="text-slate-400 mt-1">Configuration physiologique & Préférences</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`${isChatOpen ? 'bg-blue-600/20 text-blue-400 border-blue-500' : 'bg-slate-800 text-slate-300'} gap-2`}
                >
                    <MessageSquare size={18} /> {isChatOpen ? 'Masquer le Coach' : 'Discuter avec le Coach IA'}
                </Button>
            </div>

            {/* BLOC 1: INFOS & STRAVA */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-6 bg-slate-900/50 border-slate-800">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center border-b border-slate-800 pb-2">
                        <User className="mr-2 text-blue-400" size={20} /> Identité
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="Prénom" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="input-triathlon" />
                        <input type="text" placeholder="Nom" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="input-triathlon" />
                        <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="input-triathlon md:col-span-2" />
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <input type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: +e.target.value })} className="input-triathlon" />
                                <span className="absolute right-3 top-2.5 text-slate-500 text-sm">kg</span>
                            </div>
                            <input type="date" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} className="input-triathlon flex-1" />
                        </div>
                    </div>
                </Card>

                <div className="space-y-4">
                    {/* Strava Widget */}
                    <Card className={`p-4 border transition-all ${formData.stravaConnected ? 'bg-green-950/20 border-green-900' : 'bg-slate-900/50 border-slate-800'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 font-bold text-white">
                                <span className="text-[#FC4C02]">STRAVA</span> Connect
                            </div>
                            {formData.stravaConnected && <Check size={16} className="text-green-500" />}
                        </div>
                        {formData.stravaConnected ? (
                            <div className="text-xs text-green-400">Compte synchronisé avec succès.</div>
                        ) : (
                            <button onClick={() => setFormData({ ...formData, stravaConnected: true })} className="w-full py-2 bg-[#FC4C02] hover:bg-[#E34402] text-white text-sm font-bold rounded flex items-center justify-center gap-2 transition-transform active:scale-95">
                                <Link2 size={16} /> Connecter
                            </button>
                        )}
                    </Card>

                    {/* Sélecteur Sports */}
                    <Card className="p-4 bg-slate-900/50 border-slate-800">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Sports Pratiqués</h4>
                        <div className="space-y-2">
                            {/* On définit la liste avec un typage strict pour 'key' */}
                            {[
                                { key: 'swim' as SportKey, icon: Waves, label: 'Natation', color: 'text-cyan-400' },
                                { key: 'bike' as SportKey, icon: Bike, label: 'Vélo', color: 'text-orange-400' },
                                { key: 'run' as SportKey, icon: Footprints, label: 'Course à pied', color: 'text-emerald-400' }
                            ].map((sport) => (
                                <div
                                    key={sport.key}
                                    // Plus besoin de 'as any' ici, car sport.key est typé correctement
                                    onClick={() => toggleSport(sport.key)}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer border ${formData.activeSports[sport.key] ? 'bg-slate-800 border-slate-600' : 'border-transparent opacity-50'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <sport.icon size={16} className={sport.color} />
                                        <span className="text-sm text-slate-200">{sport.label}</span>
                                    </div>
                                    {/* Ici aussi, l'accès est sécurisé */}
                                    {formData.activeSports[sport.key] && (
                                        <div className={`w-2 h-2 rounded-full ${sport.color.replace('text', 'bg')}`} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* BLOC 2 : ZONES PHYSIOLOGIQUES */}
            <Card className="p-0 bg-slate-900/50 border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        <Zap className="mr-2 text-yellow-400" size={20} /> Zones & Puissance
                    </h3>
                    <div className="flex bg-slate-800 rounded-lg p-1">
                        <button onClick={() => setActiveZoneTab('power')} className={`px-3 py-1 text-xs rounded-md transition-all ${activeZoneTab === 'power' ? 'bg-slate-600 text-white shadow' : 'text-slate-400'}`}>Puissance</button>
                        <button onClick={() => setActiveZoneTab('hr')} className={`px-3 py-1 text-xs rounded-md transition-all ${activeZoneTab === 'hr' ? 'bg-slate-600 text-white shadow' : 'text-slate-400'}`}>Cardio</button>
                    </div>
                </div>

                <div className="p-6">
                    {activeZoneTab === 'power' && (
                        <div className="animate-in fade-in slide-in-from-left-4">
                            {/* Inputs des tests */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                {[
                                    { label: '5 min (PMA)', key: 'p5min' },
                                    { label: '8 min', key: 'p8min' },
                                    { label: '15 min', key: 'p15min' },
                                    { label: '20 min (FTP)', key: 'p20min', highlight: true }
                                ].map((test: any) => (
                                    <div key={test.key}>
                                        <label className="block text-xs text-slate-400 mb-1 text-center">{test.label}</label>
                                        <input
                                            type="number"
                                            value={formData.powerTests[test.key as keyof typeof formData.powerTests] || ''}
                                            onChange={e => setFormData({ ...formData, powerTests: { ...formData.powerTests, [test.key]: parseInt(e.target.value) } })}
                                            className={`w-full h-10 bg-slate-800 border rounded p-2 text-white text-center focus:border-blue-500 outline-none ${test.highlight ? 'border-blue-500/50' : 'border-slate-600'}`}
                                            placeholder="Watts"
                                        />
                                    </div>
                                ))}
                            </div>

                            <Button variant="secondary" onClick={handleCalculateZones} className="w-full mb-6" icon={Calculator}>
                                Calculer FTP & Zones
                            </Button>

                            {/* AFFICHAGE DES ZONES (Grille) */}
                            {formData.zones && (
                                <div className="space-y-4 pt-4 border-t border-slate-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">FTP Calculée: <span className="text-xl font-bold text-white">{formData.ftp}W</span></span>
                                        <span className="text-slate-300">Ratio: <span className="text-emerald-400 font-mono">{(formData.ftp / formData.weight).toFixed(2)} W/kg</span></span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center">
                                        {[
                                            { l: 'Z1', n: 'Récup', val: formData.zones.z1, c: 'border-gray-500 text-gray-300' },
                                            { l: 'Z2', n: 'Endur.', val: formData.zones.z2, c: 'border-green-500 text-green-400' },
                                            { l: 'Z3', n: 'Tempo', val: formData.zones.z3, c: 'border-blue-500 text-blue-400' },
                                            { l: 'Z4', n: 'Seuil', val: formData.zones.z4, c: 'border-yellow-500 text-yellow-400' },
                                            { l: 'Z5', n: 'PMA', val: formData.zones.z5, c: 'border-orange-500 text-orange-400' },
                                            { l: 'Z6', n: 'Anaé.', val: formData.zones.z6, c: 'border-red-500 text-red-400' },
                                            { l: 'Z7', n: 'Neuro', val: formData.zones.z7, c: 'border-purple-500 text-purple-400' },
                                        ].map((z, idx) => (
                                            <div key={z.l} className={`bg-slate-800/40 p-2 rounded border-t-2 flex flex-col justify-center min-h-[60px] ${z.c} ${idx === 6 ? 'col-span-2 sm:col-span-1' : ''}`}>
                                                <div className="font-bold text-xs">{z.l}</div>
                                                <div className="text-[10px] uppercase opacity-70">{z.n}</div>
                                                <div className="text-[10px] font-mono text-white mt-1">
                                                    {z.l === 'Z1' ? `<${z.val.max}` : z.l === 'Z7' ? `>${z.val.min}` : `${z.val.min}-${z.val.max}`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeZoneTab === 'hr' && (
                        <div className="text-center py-8 animate-in fade-in">
                            <Heart size={40} className="mx-auto text-red-500 mb-2 opacity-80" />
                            <p className="text-slate-400 mb-4">Saisissez votre Fréquence Cardiaque au Seuil (LTHR)</p>
                            <input
                                type="number"
                                value={formData.lthr}
                                onChange={e => setFormData({ ...formData, lthr: parseInt(e.target.value) })}
                                className="bg-slate-800 text-white text-2xl font-bold w-32 text-center rounded-lg py-2 border border-slate-600 focus:border-red-500 outline-none"
                            />
                            <span className="ml-2 text-slate-500">bpm</span>
                        </div>
                    )}
                </div>
            </Card>

            {/* BLOC 3: DISPO SEMAINE */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center border-b border-slate-800 pb-2">
                    <Calendar className="mr-2 text-purple-400" size={20} /> Emploi du Temps
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-700 text-left">
                                <th className="pb-2 w-20">Jour</th>
                                {formData.activeSports.swim && <th className="pb-2 text-center text-cyan-400">Swim (min)</th>}
                                {formData.activeSports.bike && <th className="pb-2 text-center text-orange-400">Bike (min)</th>}
                                {formData.activeSports.run && <th className="pb-2 text-center text-emerald-400">Run (min)</th>}
                                <th className="pb-2 pl-4">Note / Club</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {Object.keys(formData.weeklyAvailability).map(day => (
                                <tr key={day} className="hover:bg-slate-800/30">
                                    <td className="py-3 font-medium text-slate-300">{day}</td>
                                    {formData.activeSports.swim && (
                                        <td className="p-1"><input type="number" step="15" className="w-full bg-slate-900 border border-slate-700 rounded text-center text-white h-8" value={formData.weeklyAvailability[day].swim || ''} onChange={e => handleAvailabilityChange(day, 'swim', e.target.value)} /></td>
                                    )}
                                    {formData.activeSports.bike && (
                                        <td className="p-1"><input type="number" step="30" className="w-full bg-slate-900 border border-slate-700 rounded text-center text-white h-8" value={formData.weeklyAvailability[day].bike || ''} onChange={e => handleAvailabilityChange(day, 'bike', e.target.value)} /></td>
                                    )}
                                    {formData.activeSports.run && (
                                        <td className="p-1"><input type="number" step="10" className="w-full bg-slate-900 border border-slate-700 rounded text-center text-white h-8" value={formData.weeklyAvailability[day].run || ''} onChange={e => handleAvailabilityChange(day, 'run', e.target.value)} /></td>
                                    )}
                                    <td className="p-1 pl-4">
                                        <input type="text" className="w-full bg-transparent border-b border-transparent focus:border-purple-500 outline-none text-slate-400 h-8" placeholder="..." value={formData.weeklyAvailability[day].comment} onChange={e => handleAvailabilityChange(day, 'comment', e.target.value)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* FOOTER ACTIONS */}
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
                <Button variant="secondary" onClick={onCancel}>Annuler</Button>
                <Button onClick={async () => { setIsSaving(true); await onSave(formData); setIsSaving(false); }} icon={Save} disabled={isSaving}>
                    {isSaving ? 'Sauvegarde...' : 'Valider le Profil'}
                </Button>
            </div>

            {/* CHAT WIDGET OVERLAY */}
            <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

            {/* STYLES UTILS */}
            <style jsx global>{`
        .input-triathlon {
          width: 100%; height: 44px;
          background-color: #0f172a; border: 1px solid #334155;
          border-radius: 0.5rem; padding: 0 1rem; color: white;
          outline: none; transition: all 0.2s;
        }
        .input-triathlon:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
      `}</style>
        </div>
    );
};