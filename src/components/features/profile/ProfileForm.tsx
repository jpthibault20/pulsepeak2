'use client';

import React, { useState } from 'react';
import {
    User, Clock, Calculator, Target, Save, Zap, TrendingUp, ChevronDown
} from 'lucide-react';
import { Profile, PowerZones } from '@/lib/data/type';
import { Card, Button } from '@/components/ui';

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
        sports: ['cycling'],
        ftp: 200,
        weight: 70,
        experience: 'Intermédiaire',
        goal: 'Améliorer mon endurance',
        objectiveDate: '',
        weaknesses: 'Grimpeur',
        weeklyAvailability: { 'Lundi': 60, 'Mardi': 60, 'Mercredi': 90, 'Jeudi': 60, 'Vendredi': 60, 'Samedi': 180, 'Dimanche': 120 },
        powerTests: { p5min: 0, p8min: 0, p15min: 0, p20min: 0 }
    };

    const [formData, setFormData] = useState<Profile>(initialProfileData || defaultData);
    const [isSaving, setIsSaving] = useState(false);

    const handleAvailabilityChange = (day: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            weeklyAvailability: { ...prev.weeklyAvailability, [day]: parseInt(value) }
        }));
    };

    const handleTestChange = (key: 'p5min' | 'p8min' | 'p15min' | 'p20min', value: string) => {
        setFormData(prev => {
            const current = prev.powerTests ?? { p5min: 0, p8min: 0, p15min: 0, p20min: 0 };
            const updated = { ...current, [key]: parseInt(value) || 0 };
            return { ...prev, powerTests: updated };
        });
    };

    // --- LOGIQUE METIER CONSERVÉE ---
    const calculateZones = () => {
        const p5 = formData.powerTests?.p5min || 0;
        const p8 = formData.powerTests?.p8min || 0;
        const p15 = formData.powerTests?.p15min || 0;
        const p20 = formData.powerTests?.p20min || 0;

        let estimatedFtp = 0;
        let wPrime = 0;
        let sourceUsed = '';
        let methodUsed = '';
        const testsUsed: string[] = [];

        const dataPoints: { t: number, w: number, p: number }[] = [];
        if (p5 > 0) { dataPoints.push({ t: 5 * 60, w: p5 * 5 * 60, p: p5 }); testsUsed.push('5min'); }
        if (p8 > 0) { dataPoints.push({ t: 8 * 60, w: p8 * 8 * 60, p: p8 }); testsUsed.push('8min'); }
        if (p15 > 0) { dataPoints.push({ t: 15 * 60, w: p15 * 15 * 60, p: p15 }); testsUsed.push('15min'); }
        if (p20 > 0) { dataPoints.push({ t: 20 * 60, w: p20 * 20 * 60, p: p20 }); testsUsed.push('20min'); }

        if (dataPoints.length >= 2) {
            let sumT = 0, sumW = 0, sumTW = 0, sumT2 = 0;
            const n = dataPoints.length;
            dataPoints.forEach(pt => {
                sumT += pt.t;
                sumW += pt.w;
                sumTW += pt.t * pt.w;
                sumT2 += pt.t * pt.t;
            });
            const slope = (n * sumTW - sumT * sumW) / (n * sumT2 - sumT * sumT);
            const intercept = (sumW - slope * sumT) / n;
            estimatedFtp = Math.round(slope);
            wPrime = Math.round(intercept);
            sourceUsed = `Modèle Puissance Critique (${testsUsed.join('+')})`;
            methodUsed = 'Critical Power Regression';
        } else {
            if (p20 > 0) { estimatedFtp = Math.round(p20 * 0.95); sourceUsed = '95% du CP20'; }
            else if (p15 > 0) { estimatedFtp = Math.round(p15 * 0.93); sourceUsed = '93% du CP15'; }
            else if (p8 > 0) { estimatedFtp = Math.round(p8 * 0.90); sourceUsed = '90% du CP8'; }
            else if (p5 > 0) { estimatedFtp = Math.round(p5 * 0.82); sourceUsed = '82% du CP5 (Estimatif)'; }
            else { alert("Veuillez entrer au moins une valeur de test."); return; }
            methodUsed = 'Single Test Estimation';
        }

        const newZones: PowerZones = {
            z1: { min: 0, max: Math.round(estimatedFtp * 0.55) },
            z2: { min: Math.round(estimatedFtp * 0.56), max: Math.round(estimatedFtp * 0.75) },
            z3: { min: Math.round(estimatedFtp * 0.76), max: Math.round(estimatedFtp * 0.90) },
            z4: { min: Math.round(estimatedFtp * 0.91), max: Math.round(estimatedFtp * 1.05) },
            z5: { min: Math.round(estimatedFtp * 1.06), max: Math.round(estimatedFtp * 1.20) },
            z6: { min: Math.round(estimatedFtp * 1.21), max: p5 > 0 ? p5 : Math.round(estimatedFtp * 1.50) },
            z7: { min: (p5 > 0 ? p5 : Math.round(estimatedFtp * 1.50)) + 1, max: 2000 }
        };

        // Mise à jour du state avec les données de saison
        setFormData(prev => ({
            ...prev,
            ftp: estimatedFtp,
            zones: newZones,
            seasonData: {
                calculatedAt: new Date().toISOString(),
                wPrime: wPrime,
                criticalPower: estimatedFtp,
                method: methodUsed,
                sourceTests: testsUsed
            }
        }));

        console.log(`Zones calculées via ${sourceUsed}. FTP: ${estimatedFtp}W, W': ${wPrime}J`);
    };
    // -----------------------------

    const totalWeeklyMinutes = Object.values(formData.weeklyAvailability).reduce((acc, val) => acc + val, 0);
    const totalWeeklyHours = Math.floor(totalWeeklyMinutes / 60);
    const totalWeeklyMinutesRemainder = totalWeeklyMinutes % 60;

    const handleSubmit = async () => {
        setIsSaving(true);
        try { await onSave(formData); onSuccess('dashboard'); }
        catch (e) { console.error("Erreur:", e); }
        finally { setIsSaving(false); }
    };

    return (
        <div className={`space-y-6 ${isSettings ? 'pb-24' : ''} animate-in fade-in duration-500`}>
            {!isSettings && (
                <div className="text-center mb-6 md:mb-10 px-4">
                    <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">Configuration CycloIA</h1>
                    <p className="text-sm md:text-base text-slate-400">Profil physiologique & Zones de puissance</p>
                </div>
            )}

            <Card className="p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <User className="mr-2 text-blue-400" size={20} /> Profil & Tests
                </h3>

                {/* Basic Info Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Nom</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            // DESIGN: h-11 pour touch target
                            className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Votre nom"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Poids (kg)</label>
                        <input
                            type="number"
                            value={formData.weight}
                            onChange={e => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                            className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* SECTION TESTS DE PUISSANCE */}
                <div className="bg-slate-900/50 p-3 md:p-4 rounded-xl border border-slate-700 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Zap size={16} className="text-yellow-500" /> Tests de Puissance (Watts Moyens)
                        </h4>
                        {formData.ftp > 0 && <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">FTP: {formData.ftp}W</span>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                        {[
                            { label: '5 min (PMA)', key: 'p5min' as const },
                            { label: '8 min', key: 'p8min' as const },
                            { label: '15 min', key: 'p15min' as const },
                            { label: '20 min (FTP)', key: 'p20min' as const, highlight: true }
                        ].map((test) => (
                            <div key={test.key}>
                                <label className="block text-xs text-slate-400 mb-1 text-center">{test.label}</label>
                                <input
                                    type="number"
                                    value={formData.powerTests?.[test.key] || ''}
                                    onChange={e => handleTestChange(test.key, e.target.value)}
                                    className={`
                            w-full h-10 md:h-9 bg-slate-800 border border-slate-600 rounded p-2 text-white text-center focus:border-blue-500 outline-none
                            ${test.highlight ? 'border-l-2 border-l-blue-500 font-semibold' : ''}
                        `}
                                    placeholder="---"
                                />
                            </div>
                        ))}
                    </div>

                    <Button variant="secondary" onClick={calculateZones} className="w-full py-3 md:py-2 text-sm mb-4 h-auto" icon={Calculator}>
                        Calculer FTP & Zones
                    </Button>

                    {/* Affichage des zones calculées */}
                    {formData.zones && (
                        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-slate-700">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <span className="text-sm text-slate-300">Nouvelle FTP: <span className="font-bold text-white text-lg">{formData.ftp} W</span></span>
                                <span className="text-sm text-slate-300">Ratio: <span className="font-bold text-emerald-400">{formData.weight ? (formData.ftp / formData.weight).toFixed(2) : '-'} W/kg</span></span>
                            </div>

                            {formData.seasonData?.wPrime && formData.seasonData.wPrime > 0 && (
                                <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded mb-2 text-xs text-slate-400 border border-slate-600/30">
                                    <TrendingUp size={12} className="text-orange-400" />
                                    <span>W&apos; (Anaérobie): <span className="text-orange-300 font-mono">{formData.seasonData.wPrime} J</span></span>
                                </div>
                            )}

                            {/* DESIGN RESPONSIVE: Grille de Zones 
                  - Mobile: grid-cols-2 (lisible)
                  - Tablette (sm): grid-cols-4
                  - Desktop (md): grid-cols-7 (aligné)
              */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center">
                                {[
                                    { label: 'Z1', name: 'Récup', val: formData.zones.z1, color: 'border-gray-400 text-gray-300' },
                                    { label: 'Z2', name: 'Endur.', val: formData.zones.z2, color: 'border-green-500 text-green-400' },
                                    { label: 'Z3', name: 'Tempo', val: formData.zones.z3, color: 'border-blue-500 text-blue-400' },
                                    { label: 'Z4', name: 'Seuil', val: formData.zones.z4, color: 'border-yellow-500 text-yellow-400' },
                                    { label: 'Z5', name: 'PMA', val: formData.zones.z5, color: 'border-orange-500 text-orange-400' },
                                    { label: 'Z6', name: 'Anaé.', val: formData.zones.z6, color: 'border-red-500 text-red-400' },
                                    { label: 'Z7', name: 'Neuro', val: formData.zones.z7, color: 'border-purple-500 text-purple-400' },
                                ].map((zone, idx) => (
                                    <div key={zone.label} className={`
                    bg-slate-800/40 p-2 rounded border-t-2 flex flex-col justify-center min-h-[60px]
                    ${zone.color.split(' ')[0]}
                    ${/* La dernière case prend toute la largeur sur mobile impair pour éviter le trou */ idx === 6 ? 'col-span-2 sm:col-span-1' : ''}
                  `}>
                                        <div className="flex justify-between items-center md:block">
                                            <div className={`font-bold text-xs ${zone.color.split(' ')[1]}`}>{zone.label}</div>
                                            <div className="text-[10px] text-slate-500 uppercase md:mb-1">{zone.name}</div>
                                        </div>
                                        <div className="text-[10px] font-mono text-white mt-1 md:mt-0">
                                            {zone.label === 'Z1' ? `<${zone.val.max}` : zone.label === 'Z7' ? `>${zone.val.min}` : `${zone.val.min}-${zone.val.max}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <h3 className="text-lg font-semibold text-white mb-4 flex items-center border-t border-slate-700 pt-6">
                    <Clock className="mr-2 text-yellow-400" size={20} /> Disponibilités
                </h3>

                {/* SECTION DISPONIBILITÉS */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-5 md:space-y-4 mb-6">
                    {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
                        // DESIGN: Flex-col sur mobile pour que le slider ait toute la largeur
                        <div key={day} className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-0">
                            {/* Ligne Label + Valeur (Mobile uniquement) */}
                            <div className="flex justify-between md:w-24 md:block mb-1 md:mb-0">
                                <label className="text-sm font-medium text-slate-300">{day}</label>
                                <span className={`md:hidden text-xs font-bold ${formData.weeklyAvailability[day] === 0 ? 'text-slate-600' : 'text-blue-400'}`}>
                                    {formData.weeklyAvailability[day] === 0 ? 'Repos' : `${Math.floor(formData.weeklyAvailability[day] / 60)}h${String(formData.weeklyAvailability[day] % 60).padStart(2, '0')}`}
                                </span>
                            </div>

                            <div className="flex-1 md:mx-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="300"
                                    step="30"
                                    value={formData.weeklyAvailability[day] || 0}
                                    onChange={(e) => handleAvailabilityChange(day, e.target.value)}
                                    // DESIGN: h-6 pour une zone de touche confortable
                                    className="w-full h-4 md:h-2 bg-blue-600/30 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    style={{ background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formData.weeklyAvailability[day] || 0) / 300) * 100}%, #1e293b ${((formData.weeklyAvailability[day] || 0) / 300) * 100}%, #1e293b 100%)` }}
                                />
                            </div>

                            {/* Valeur Desktop uniquement */}
                            <span className={`hidden md:block text-xs font-bold w-16 text-right ${formData.weeklyAvailability[day] === 0 ? 'text-slate-600' : 'text-blue-400'}`}>
                                {formData.weeklyAvailability[day] === 0 ? 'Repos' : `${Math.floor(formData.weeklyAvailability[day] / 60)}h${String(formData.weeklyAvailability[day] % 60).padStart(2, '0')}`}
                            </span>
                        </div>
                    ))}

                    <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between bg-slate-800/50 p-3 rounded-lg gap-2">
                        <div className="flex items-center text-slate-300">
                            <Calculator size={18} className="mr-2 text-blue-400" />
                            <span className="font-medium text-sm">Volume Hebdo Total :</span>
                        </div>
                        <span className="text-xl font-bold text-white">{totalWeeklyHours}h<span className="text-sm text-slate-400">{totalWeeklyMinutesRemainder > 0 ? totalWeeklyMinutesRemainder : '00'}</span></span>
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-white mb-4 flex items-center border-t border-slate-700 pt-6">
                    <Target size={20} className="mr-2 text-red-400" /> Objectif & IA
                </h3>

                {/* SECTION OBJECTIFS */}
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Type d&apos;objectif</label>
                            <div className="relative">
                                <select
                                    value={formData.goal}
                                    onChange={e => setFormData({ ...formData, goal: e.target.value })}
                                    className="w-full h-11 appearance-none bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option>Améliorer mon endurance</option>
                                    <option>Gran Fondo / Cyclosportive</option>
                                    <option>Course sur route (Compétition)</option>
                                    <option>Contre-la-montre</option>
                                    <option>Gravel / Ultra-distance</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" size={16} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Date (Optionnel)</label>
                            <input
                                type="date"
                                value={formData.objectiveDate}
                                onChange={e => setFormData({ ...formData, objectiveDate: e.target.value })}
                                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Points Faibles / Commentaires IA</label>
                        <textarea
                            value={formData.weaknesses}
                            onChange={e => setFormData({ ...formData, weaknesses: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                            placeholder="Ex: Je suis mauvais en montée, je veux préparer l'Etape du Tour..."
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex flex-col-reverse sm:flex-row justify-between gap-3 md:gap-4">
                    {isSettings && (
                        <Button onClick={onCancel} variant="secondary" className="flex-1 h-12 md:h-10" disabled={isSaving}>
                            Annuler
                        </Button>
                    )}
                    <Button onClick={handleSubmit} className="flex-1 h-12 md:h-10 shadow-lg shadow-blue-900/20" icon={Save} disabled={isSaving}>
                        {isSaving ? "Sauvegarde..." : (isSettings ? "Sauvegarder" : "Valider et Accéder au Coach")}
                    </Button>
                </div>
            </Card>
        </div>
    );
};