'use client';

import React, { useState, useMemo } from 'react';
import {
    Save, 
    MessageSquare    } from 'lucide-react';
import { Button } from '@/components/ui'; // Assure-toi que ces imports existent ou utilise des div/button standards
import { Profile } from '@/lib/data/type';
import { BasicInformation } from './BasicInformation';
import { ChatWidget } from './ChatWidget';
import { SportsAndAppLink } from './SportsAndAppLink';
import { Availability } from './Availability';
import { CalibrationTest } from './CalibrationTest';
import { Goals } from './Goals';


function safeValue<T>(value: T | null | undefined, fallback: T): T {
    return value !== null && value !== undefined ? value : fallback;
}


// --- COMPOSANT PRINCIPAL ---

interface ProfileFormProps {
    initialData: Partial<Profile>;
    onSave: (data: Profile) => Promise<void>;
    onCancel: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ initialData, onSave,  onCancel }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);

    // État initial par défaut
    const defaultData: Profile = {
        firstName: 'etst', lastName: '', email: '', weight: 70, birthDate: '',
        activeSports: { swimming: true, cycling: true, running: true },
        aiPersonality: 'Analytique',
        strava: { accessToken: '', refreshToken: '', expiresAt: 0, athleteId: 0 },
        weeklyAvailability: {
            'Lundi': { swimming: 0, cycling: 0, running: 0, comment: '' },
            'Mardi': { swimming: 60, cycling: 0, running: 45, comment: '' },
            'Mercredi': { swimming: 0, cycling: 90, running: 0, comment: '' },
            'Jeudi': { swimming: 60, cycling: 0, running: 45, comment: '' },
            'Vendredi': { swimming: 0, cycling: 0, running: 0, comment: 'Repos' },
            'Samedi': { swimming: 0, cycling: 180, running: 0, comment: 'Sortie longue' },
            'Dimanche': { swimming: 0, cycling: 0, running: 90, comment: '' },
        },
        ftp: 200, lthr: 170, vma: 15,
        powerTests: { p5min: 0, p8min: 0, p15min: 0, p20min: 0 },
        goal: 'Terminer un Ironman 70.3',
        weaknesses: '',
        experience: 'Débutant',
        objectiveDate: '',
    };

    const initialFormData = useMemo<Profile>(() => {
        // ✅ 1. Sécurité de base
        if (!initialData) return defaultData;

        return {
            // --- CHAMPS TEXTE & IDENTITÉ ---
            firstName: safeValue(initialData.firstName, defaultData.firstName),
            lastName: safeValue(initialData.lastName, defaultData.lastName),
            email: safeValue(initialData.email, defaultData.email),
            birthDate: safeValue(initialData.birthDate, defaultData.birthDate),
            weight: safeValue(initialData.weight, defaultData.weight),
            
            // --- CONFIGURATION & ENUMS ---
            aiPersonality: safeValue(initialData.aiPersonality, defaultData.aiPersonality),
            experience: safeValue(initialData.experience, defaultData.experience),
            strava: initialData.strava || undefined, // Optionnel

            // --- PHYSIOLOGIE (RACINE) ---
            // Selon ton interface, ces valeurs restent à la racine
            ftp: safeValue(initialData.ftp, defaultData.ftp),
            lthr: safeValue(initialData.lthr, defaultData.lthr),
            vma: safeValue(initialData.vma, defaultData.vma),

            // --- SOUS-PROFILS (Données complexes & Zones) ---
            // On récupère les objets entiers s'ils existent (pour garder les zones calculées)
            heartRate: initialData.heartRate ? {
                max: initialData.heartRate.max,
                resting: initialData.heartRate.resting,
                zones: initialData.heartRate.zones // IMPORTANT: garde les zones FC
            } : undefined,

            running: initialData.running ? {
                vma: initialData.running.vma, // Peut être redondant avec root.vma mais permet de stocker l'objet
                zones: initialData.running.zones // IMPORTANT: garde les zones Allure
            } : undefined,

            // --- SPORTS ACTIFS ---
            activeSports: {
                swimming: safeValue(initialData.activeSports?.swimming, defaultData.activeSports.swimming),
                cycling: safeValue(initialData.activeSports?.cycling, defaultData.activeSports.cycling),
                running: safeValue(initialData.activeSports?.running, defaultData.activeSports.running),
            },

            // --- OBJECTIFS ---
            goal: safeValue(initialData.goal, defaultData.goal),
            objectiveDate: safeValue(initialData.objectiveDate, defaultData.objectiveDate),
            weaknesses: safeValue(initialData.weaknesses, defaultData.weaknesses),

            // --- POWER DATA (Cyclisme) ---
            zones: initialData.zones || undefined, // Zones de puissance
            seasonData: initialData.seasonData || undefined,
            powerTests: {
                p5min: safeValue(initialData.powerTests?.p5min, defaultData.powerTests!.p5min),
                p8min: safeValue(initialData.powerTests?.p8min, defaultData.powerTests!.p8min),
                p15min: safeValue(initialData.powerTests?.p15min, defaultData.powerTests!.p15min),
                p20min: safeValue(initialData.powerTests?.p20min, defaultData.powerTests!.p20min),
            },

            // --- DISPONIBILITÉS (Fusion profonde) ---
            weeklyAvailability: (
                Object.keys(defaultData.weeklyAvailability) as Array<keyof typeof defaultData.weeklyAvailability>
            ).reduce((acc, day) => ({
                ...acc,
                [day]: {
                    swimming: safeValue(
                        initialData.weeklyAvailability?.[day]?.swimming,
                        defaultData.weeklyAvailability[day].swimming
                    ),
                    cycling: safeValue(
                        initialData.weeklyAvailability?.[day]?.cycling,
                        defaultData.weeklyAvailability[day].cycling
                    ),
                    running: safeValue(
                        initialData.weeklyAvailability?.[day]?.running,
                        defaultData.weeklyAvailability[day].running
                    ),
                    comment: safeValue(
                        initialData.weeklyAvailability?.[day]?.comment,
                        defaultData.weeklyAvailability[day].comment
                    ),
                }
            }), {} as Profile['weeklyAvailability']),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);


    const [formData, setFormData] = useState<Profile>(initialFormData);
    
    const [isSaving, setIsSaving] = useState(false);





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
                <BasicInformation 
                    formData={formData}
                    setFormData={setFormData}
                />

                {/* Colonne Droite : Sports & Strava */}
                <SportsAndAppLink 
                    formData={formData}
                    setFormData={setFormData}
                />
            </div>

            {/* 2. DISPONIBILITÉS (MATRICE) */}
            <Availability
                formData={formData}
                setFormData={setFormData}
            />

            {/* 3. ZONES & TESTS (TABS) */}
            <CalibrationTest 
                formData={formData}
                setFormData={setFormData}
            />

            {/* 4. IA & OBJECTIFS */}
            <Goals
                formData={formData}
                setFormData={setFormData}
            />

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
        </div>
    );
};