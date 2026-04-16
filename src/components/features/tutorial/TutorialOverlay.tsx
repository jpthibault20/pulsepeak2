'use client';

import React, { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
    Sparkles,
    ChevronRight,
    ChevronLeft,
    X,
    Bike,
    Footprints,
    Waves,
    Trophy,
    Target,
    BrainCircuit,
    CalendarDays,
    Plus,
    CheckCircle2,
    SlidersHorizontal,
    Bot,
    Clock,
    Zap,
    MousePointerClick,
    Link,
    History,
    AlertTriangle,
    UserRound,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TutorialStep {
    accentColor: string;
    tag: string;
    title: string;
    description: string;
    visual: React.ReactNode;
    instructions: { icon: React.ElementType; text: string }[];
}

interface TutorialOverlayProps {
    onComplete: () => void;
}

// ─── localStorage key ────────────────────────────────────────────────────────

const TUTORIAL_DONE_KEY = 'pulsepeak_tutorial_done';

export function hasTutorialBeenCompleted(): boolean {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(TUTORIAL_DONE_KEY) === 'true';
}

export function markTutorialCompleted(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TUTORIAL_DONE_KEY, 'true');
}

export function resetTutorial(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TUTORIAL_DONE_KEY);
}

// ─── Visual: Welcome ────────────────────────────────────────────────────────

const WelcomeVisual = () => (
    <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
                <Bike size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
                <Footprints size={24} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center">
                <Waves size={24} className="text-cyan-600 dark:text-cyan-400" />
            </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Ce guide vous accompagne pas à pas pour prendre en main l&apos;application.
        </p>
    </div>
);

// ─── Visual: Strava ──────────────────────────────────────────────────────────

const StravaVisual = () => (
    <div className="space-y-3 w-full max-w-[280px] mx-auto">
        {/* Strava connect mock */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/20">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
                <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
            </div>
            <div>
                <div className="text-sm font-bold text-orange-700 dark:text-orange-300">Connecter Strava</div>
                <div className="text-[11px] text-orange-600/70 dark:text-orange-400/70">Compte gratuit ou payant</div>
            </div>
            <div className="ml-auto">
                <Link size={16} className="text-orange-400 dark:text-orange-500" />
            </div>
        </div>

        {/* What gets imported */}
        <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">Données importées automatiquement</div>
            {[
                { icon: History, label: 'Historique complet', desc: 'Toutes vos activités passées' },
                { icon: Zap, label: 'Métriques de performance', desc: 'Puissance, FC, allure, TSS' },
                { icon: BrainCircuit, label: 'Charge d\'entraînement', desc: 'CTL & ATL calculés automatiquement' },
            ].map(({ icon: Icon, label, desc }, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <Icon size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    <div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5">— {desc}</span>
                    </div>
                </div>
            ))}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                Sans historique, l&apos;IA ne peut pas calibrer l&apos;intensité — le plan sera générique au lieu d&apos;être adapté à votre niveau.
            </span>
        </div>
    </div>
);

// ─── Visual: Objectif ────────────────────────────────────────────────────────

const ObjectiveVisual = () => (
    <div className="space-y-2.5 w-full max-w-[280px] mx-auto">
        {/* Primary */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/20">
            <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                <Trophy size={16} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Principal</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">Ironman 70.3 Nice</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">14 sept. — Triathlon</div>
            </div>
        </div>
        {/* Secondary */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                <Target size={14} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Secondaire</div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">10K de printemps</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">25 mai — Course à pied</div>
            </div>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                <Target size={14} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Secondaire</div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">Granfondo Alpes</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">12 juil. — Vélo</div>
            </div>
        </div>
    </div>
);

// ─── Visual: Plan Generation ────────────────────────────────────────────────

const PlanGenVisual = () => (
    <div className="space-y-3 w-full max-w-[280px] mx-auto">
        {/* Mode tabs */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-xs font-semibold text-blue-600 dark:text-blue-400">
                <SlidersHorizontal size={12} />
                Bloc
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500">
                <Trophy size={12} />
                Vers objectif
            </div>
        </div>
        {/* Focus badges */}
        <div className="flex flex-wrap gap-1.5">
            {['Endurance', 'PMA', 'Seuil', 'Fartlek', 'Sweet Spot'].map((f, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${i === 0
                    ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                    {f}
                </span>
            ))}
        </div>
        {/* Result preview */}
        <div className="space-y-1.5 pt-1">
            {[
                { label: 'S1 — Charge', w: 'w-3/5', color: 'bg-blue-400 dark:bg-blue-500' },
                { label: 'S2 — Charge', w: 'w-4/5', color: 'bg-blue-500 dark:bg-blue-400' },
                { label: 'S3 — Surcharge', w: 'w-full', color: 'bg-purple-500 dark:bg-purple-400' },
                { label: 'S4 — Récupération', w: 'w-2/5', color: 'bg-slate-300 dark:bg-slate-600' },
            ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 w-28 shrink-0">{s.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className={`h-full rounded-full ${s.color} ${s.w}`} />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ─── Visual: Week by week ───────────────────────────────────────────────────

const WeekByWeekVisual = () => (
    <div className="space-y-2.5 w-full max-w-[280px] mx-auto">
        {/* Week card mock */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Semaine du 7 avril</div>
                <span className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-500/15 text-[10px] font-bold text-orange-600 dark:text-orange-400">Charge</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Zap size={10} className="text-amber-500" /> 320 / 380 TSS</span>
                <span className="flex items-center gap-1"><Clock size={10} /> 6h / 7h30</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full w-[84%] rounded-full bg-blue-500 dark:bg-blue-400" />
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">4/5 séances complétées</div>
        </div>

        {/* Day slots */}
        <div className="grid grid-cols-7 gap-1">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => {
                const workouts: Record<number, { color: string; done: boolean }> = {
                    0: { color: 'bg-blue-400', done: true },
                    1: { color: 'bg-orange-400', done: true },
                    3: { color: 'bg-blue-400', done: true },
                    4: { color: 'bg-orange-400', done: true },
                    5: { color: 'bg-blue-400', done: false },
                };
                const w = workouts[i];
                return (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">{d}</span>
                        <div className={`w-full aspect-square rounded-lg flex items-center justify-center ${w ? 'bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700' : ''
                            }`}>
                            {w ? (
                                <div className="flex flex-col items-center gap-0.5">
                                    <div className={`w-2 h-2 rounded-full ${w.color}`} />
                                    {w.done && <CheckCircle2 size={7} className="text-emerald-500" />}
                                </div>
                            ) : (
                                <span className="text-[9px] text-slate-300 dark:text-slate-600">—</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>

        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20">
            <Plus size={12} className="text-blue-500 shrink-0" />
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                Survolez une semaine et cliquez + pour générer ses séances
            </span>
        </div>
    </div>
);

// ─── Visual: Workout management ─────────────────────────────────────────────

const WorkoutVisual = () => (
    <div className="space-y-2.5 w-full max-w-[280px] mx-auto">
        {/* Workout card */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-8 rounded-full bg-blue-500" />
                <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Endurance Z2</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Bike size={10} className="text-blue-500" /> Vélo
                        <span>·</span>
                        <Clock size={10} /> 1h30
                        <span>·</span>
                        <Zap size={10} className="text-amber-500" /> 95 TSS
                    </div>
                </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg p-2 font-mono leading-relaxed">
                20min échauffement Z1<br />
                50min Z2 cadence 85-90<br />
                20min retour au calme
            </div>
        </div>

        {/* Action buttons mock */}
        <div className="flex gap-2">
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold">
                <CheckCircle2 size={13} />
                Marquer fait
            </div>
            <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <CalendarDays size={13} />
                Déplacer
            </div>
        </div>

        {/* Feedback hint */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20">
            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                Après &quot;fait&quot;, renseignez votre ressenti et vos données
            </span>
        </div>
    </div>
);

// ─── Visual: Day actions ────────────────────────────────────────────────────

const DayActionsVisual = () => (
    <div className="space-y-2 w-full max-w-[260px] mx-auto">
        {[
            { icon: CalendarDays, label: 'Planifier une séance', desc: 'L\'IA génère le contenu', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
            { icon: Footprints, label: 'Ajouter une activité', desc: 'Entrée manuelle (hors Strava)', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { icon: Trophy, label: 'Ajouter un objectif', desc: 'Course ou événement cible', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
        ].map(({ icon: Icon, label, desc, color, bg }, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${bg} border border-slate-200/40 dark:border-slate-700/30`}>
                <Icon size={18} className={`${color} shrink-0`} />
                <div>
                    <div className={`text-sm font-semibold ${color}`}>{label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{desc}</div>
                </div>
            </div>
        ))}
    </div>
);

// ─── Visual: Coach IA ───────────────────────────────────────────────────────

const CoachVisual = () => (
    <div className="w-full max-w-[280px] mx-auto space-y-2.5">
        <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                Tu as l&apos;air fatigué cette semaine. Je te conseille de réduire le volume de 20% et de privilégier l&apos;endurance basse.
            </div>
        </div>
        <div className="flex gap-2 justify-end">
            <div className="bg-indigo-500 dark:bg-indigo-600 rounded-2xl rounded-tr-md px-3.5 py-2.5 text-xs text-white">
                Est-ce que je peux quand même faire ma sortie longue samedi ?
            </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20">
            <Bot size={12} className="text-indigo-500 shrink-0" />
            <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">
                Il connaît votre profil et votre historique de séances
            </span>
        </div>
    </div>
);

// ─── Tutorial steps ──────────────────────────────────────────────────────────

const STEPS: TutorialStep[] = [
    {
        accentColor: 'blue',
        tag: 'Bienvenue',
        title: 'Apprenez à utiliser PulsePeak',
        description: 'En quelques étapes, vous allez découvrir comment créer vos objectifs, générer un plan d\'entraînement et gérer vos séances au quotidien.',
        visual: <WelcomeVisual />,
        instructions: [
            { icon: Target, text: 'Définir vos objectifs de course' },
            { icon: BrainCircuit, text: 'Générer un plan adapté par l\'IA' },
            { icon: CalendarDays, text: 'Gérer vos séances semaine par semaine' },
            { icon: Bot, text: 'Poser vos questions au Coach IA' },
        ],
    },
    {
        accentColor: 'orange',
        tag: 'Étape 1 — Indispensable',
        title: 'Connectez Strava',
        description: 'Votre historique d\'entraînement est la clé de la personnalisation. Sans lui, l\'IA génère un plan générique. Avec lui, chaque séance est calibrée sur votre niveau réel.',
        visual: <StravaVisual />,
        instructions: [
            { icon: UserRound, text: 'Allez dans Profil → Sports → "Connecter Strava" — un compte gratuit suffit' },
            { icon: History, text: 'Vos activités passées sont importées automatiquement et mises à jour à chaque connexion' },
            { icon: BrainCircuit, text: 'L\'IA utilise cet historique pour déterminer votre charge actuelle (CTL/ATL) et calibrer les intensités' },
            { icon: AlertTriangle, text: 'Faites-le avant de générer votre premier plan pour un résultat vraiment personnalisé' },
        ],
    },
    {
        accentColor: 'rose',
        tag: 'Étape 2',
        title: 'Définissez vos objectifs',
        description: 'Commencez par ajouter vos courses et événements. Cliquez sur le + d\'un jour dans le calendrier, puis "Ajouter un objectif".',
        visual: <ObjectiveVisual />,
        instructions: [
            { icon: Trophy, text: 'Objectif principal : votre course cible, le plan sera construit vers cette date' },
            { icon: Target, text: 'Objectifs secondaires : étapes intermédiaires, l\'IA prévoit un affûtage pour chacun' },
            { icon: MousePointerClick, text: 'Cliquez sur le + d\'un jour → "Ajouter un objectif" → choisissez la priorité' },
        ],
    },
    {
        accentColor: 'blue',
        tag: 'Étape 3',
        title: 'Générez votre plan',
        description: 'Depuis l\'agenda, cliquez sur "Calculer un nouveau plan". Deux modes sont disponibles :',
        visual: <PlanGenVisual />,
        instructions: [
            { icon: SlidersHorizontal, text: 'Mode Bloc : choisissez un thème (Endurance, PMA, Seuil…) et une durée de 1 à 8 semaines' },
            { icon: Trophy, text: 'Mode Objectif : l\'IA crée un plan complet jusqu\'à votre course principale, avec les secondaires intégrés' },
            { icon: BrainCircuit, text: 'L\'IA analyse votre historique, votre niveau et vos disponibilités pour calibrer le plan' },
        ],
    },
    {
        accentColor: 'purple',
        tag: 'Étape 4',
        title: 'Fonctionnement semaine par semaine',
        description: 'Le plan crée un cadre (type de semaine, TSS cible). Les séances détaillées se génèrent semaine par semaine pour s\'adapter à vos retours.',
        visual: <WeekByWeekVisual />,
        instructions: [
            { icon: Plus, text: 'Survolez le résumé de semaine → cliquez + → ajustez vos disponibilités → "Générer la semaine"' },
            { icon: Sparkles, text: 'Activez le mode libre (icône étoile) pour laisser l\'IA choisir les sports et les durées' },
            { icon: Clock, text: 'Chaque semaine affiche le TSS réalisé vs planifié, les heures et les séances complétées' },
        ],
    },
    {
        accentColor: 'green',
        tag: 'Étape 5',
        title: 'Gérez vos séances',
        description: 'Cliquez sur une séance dans le calendrier pour voir le détail : structure, zones, durée. Vous pouvez ensuite agir dessus.',
        visual: <WorkoutVisual />,
        instructions: [
            { icon: CheckCircle2, text: '"Marquer fait" : renseignez RPE, durée réelle, notes — ces données améliorent les futurs plans' },
            { icon: CalendarDays, text: '"Déplacer" : décalez une séance à un autre jour si votre planning change' },
            { icon: BrainCircuit, text: '"Régénérer IA" : demandez une nouvelle version avec des instructions (ex: "plus court", "sans intervalles")' },
        ],
    },
    {
        accentColor: 'emerald',
        tag: 'Étape 6',
        title: 'Ajoutez des séances manuellement',
        description: 'En plus du plan IA, vous pouvez ajouter des séances à tout moment en cliquant sur le + d\'un jour.',
        visual: <DayActionsVisual />,
        instructions: [
            { icon: CalendarDays, text: '"Planifier une séance" : choisissez sport, durée et thème, l\'IA génère le contenu' },
            { icon: Footprints, text: '"Ajouter une activité" : saisissez manuellement une séance réalisée (hors Strava)' },
            { icon: Sparkles, text: 'Strava se synchronise automatiquement — vos activités apparaissent dans le calendrier' },
        ],
    },
    {
        accentColor: 'indigo',
        tag: 'Étape 7',
        title: 'Votre Coach IA',
        description: 'Accessible depuis la barre de navigation, le Coach IA répond à toutes vos questions.',
        visual: <CoachVisual />,
        instructions: [
            { icon: Bot, text: 'Posez des questions libres : nutrition, récupération, technique, adaptation du plan…' },
            { icon: Sparkles, text: 'Il a accès à votre profil et vos séances récentes pour personnaliser ses réponses' },
            { icon: MousePointerClick, text: 'Cliquez sur "Coach" dans la barre de navigation pour y accéder' },
        ],
    },
];

// ─── Color mapping ───────────────────────────────────────────────────────────

const ACCENT: Record<string, {
    bar: string;
    tagBg: string;
    tagText: string;
    dot: string;
    btn: string;
    btnHover: string;
    glow: string;
    instructionDot: string;
}> = {
    orange: {
        bar: 'bg-orange-500', tagBg: 'bg-orange-100 dark:bg-orange-500/15', tagText: 'text-orange-600 dark:text-orange-400',
        dot: 'bg-orange-500 dark:bg-orange-400', btn: 'bg-orange-600', btnHover: 'hover:bg-orange-500', glow: 'shadow-orange-500/20',
        instructionDot: 'bg-orange-400 dark:bg-orange-500',
    },
    blue: {
        bar: 'bg-blue-500', tagBg: 'bg-blue-100 dark:bg-blue-500/15', tagText: 'text-blue-600 dark:text-blue-400',
        dot: 'bg-blue-500 dark:bg-blue-400', btn: 'bg-blue-600', btnHover: 'hover:bg-blue-500', glow: 'shadow-blue-500/20',
        instructionDot: 'bg-blue-400 dark:bg-blue-500',
    },
    rose: {
        bar: 'bg-rose-500', tagBg: 'bg-rose-100 dark:bg-rose-500/15', tagText: 'text-rose-600 dark:text-rose-400',
        dot: 'bg-rose-500 dark:bg-rose-400', btn: 'bg-rose-600', btnHover: 'hover:bg-rose-500', glow: 'shadow-rose-500/20',
        instructionDot: 'bg-rose-400 dark:bg-rose-500',
    },
    purple: {
        bar: 'bg-purple-500', tagBg: 'bg-purple-100 dark:bg-purple-500/15', tagText: 'text-purple-600 dark:text-purple-400',
        dot: 'bg-purple-500 dark:bg-purple-400', btn: 'bg-purple-600', btnHover: 'hover:bg-purple-500', glow: 'shadow-purple-500/20',
        instructionDot: 'bg-purple-400 dark:bg-purple-500',
    },
    green: {
        bar: 'bg-green-500', tagBg: 'bg-green-100 dark:bg-green-500/15', tagText: 'text-green-600 dark:text-green-400',
        dot: 'bg-green-500 dark:bg-green-400', btn: 'bg-green-600', btnHover: 'hover:bg-green-500', glow: 'shadow-green-500/20',
        instructionDot: 'bg-green-400 dark:bg-green-500',
    },
    emerald: {
        bar: 'bg-emerald-500', tagBg: 'bg-emerald-100 dark:bg-emerald-500/15', tagText: 'text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500 dark:bg-emerald-400', btn: 'bg-emerald-600', btnHover: 'hover:bg-emerald-500', glow: 'shadow-emerald-500/20',
        instructionDot: 'bg-emerald-400 dark:bg-emerald-500',
    },
    indigo: {
        bar: 'bg-indigo-500', tagBg: 'bg-indigo-100 dark:bg-indigo-500/15', tagText: 'text-indigo-600 dark:text-indigo-400',
        dot: 'bg-indigo-500 dark:bg-indigo-400', btn: 'bg-indigo-600', btnHover: 'hover:bg-indigo-500', glow: 'shadow-indigo-500/20',
        instructionDot: 'bg-indigo-400 dark:bg-indigo-500',
    },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [direction, setDirection] = useState<'next' | 'prev'>('next');
    const [isAnimating, setIsAnimating] = useState(false);
    const mounted = useSyncExternalStore(() => () => { }, () => true, () => false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const step = STEPS[currentStep];
    const a = ACCENT[step.accentColor] || ACCENT.blue;
    const isLast = currentStep === STEPS.length - 1;
    const isFirst = currentStep === 0;

    const goTo = useCallback((next: number, dir: 'next' | 'prev') => {
        if (isAnimating) return;
        setIsAnimating(true);
        setDirection(dir);
        setTimeout(() => {
            setCurrentStep(next);
            setIsAnimating(false);
            scrollRef.current?.scrollTo({ top: 0 });
        }, 200);
    }, [isAnimating]);

    const handleNext = useCallback(() => {
        if (isLast) {
            markTutorialCompleted();
            onComplete();
        } else {
            goTo(currentStep + 1, 'next');
        }
    }, [isLast, currentStep, onComplete, goTo]);

    const handlePrev = useCallback(() => {
        if (!isFirst) goTo(currentStep - 1, 'prev');
    }, [isFirst, currentStep, goTo]);

    const handleSkip = useCallback(() => {
        markTutorialCompleted();
        onComplete();
    }, [onComplete]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') handleSkip();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleNext, handlePrev, handleSkip]);

    if (!mounted) return null;

    const animClass = isAnimating
        ? (direction === 'next' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4')
        : 'opacity-100 translate-x-0';

    return createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-900/70 dark:bg-slate-950/85 backdrop-blur-sm">
            <div className="relative w-full max-w-md mx-3 sm:mx-4">

                {/* Skip */}
                <button
                    onClick={handleSkip}
                    className="absolute -top-12 right-0 flex items-center gap-1.5 text-sm text-white/60 hover:text-white/90 transition-colors"
                >
                    Passer
                    <X size={16} />
                </button>

                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xl shadow-black/20 overflow-hidden max-h-[90dvh] flex flex-col">

                    {/* Scrollable content */}
                    <div ref={scrollRef} className="overflow-y-auto flex-1">
                        <div className={`transition-all duration-200 ease-out ${animClass}`}>

                            {/* Accent bar */}
                            <div className={`h-1 ${a.bar}`} />

                            {/* Header */}
                            <div className="px-6 pt-6 pb-1">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${a.tagBg} ${a.tagText}`}>
                                    {step.tag}
                                </span>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-3">
                                    {step.title}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                                    {step.description}
                                </p>
                            </div>

                            {/* Visual */}
                            <div className="px-6 py-4">
                                <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30 p-4">
                                    {step.visual}
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="px-6 pb-4">
                                <div className="space-y-2.5">
                                    {step.instructions.map((inst, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <div className={`w-7 h-7 rounded-lg ${a.tagBg} flex items-center justify-center shrink-0 mt-0.5`}>
                                                <inst.icon size={14} className={a.tagText} />
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                                                {inst.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer — fixed */}
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                        {/* Progress */}
                        <div className="flex justify-center gap-2 mb-4">
                            {STEPS.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => i !== currentStep && goTo(i, i > currentStep ? 'next' : 'prev')}
                                    className={`h-2 rounded-full transition-all duration-300 ${i === currentStep ? `w-6 ${a.dot}`
                                        : i < currentStep ? `w-2 ${a.dot} opacity-40`
                                            : 'w-2 bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    aria-label={`Étape ${i + 1}`}
                                />
                            ))}
                        </div>

                        {/* Nav buttons */}
                        <div className="flex items-center gap-3">
                            {!isFirst ? (
                                <button
                                    onClick={handlePrev}
                                    className="flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                    <ChevronLeft size={16} />
                                    Retour
                                </button>
                            ) : <div />}

                            <button
                                onClick={handleNext}
                                className={`ml-auto flex items-center gap-2 px-6 h-11 rounded-xl text-sm font-semibold text-white ${a.btn} ${a.btnHover} shadow-lg ${a.glow} transition-all duration-200 active:scale-[0.98]`}
                            >
                                {isLast ? 'C\'est parti !' : 'Suivant'}
                                {!isLast && <ChevronRight size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
};
