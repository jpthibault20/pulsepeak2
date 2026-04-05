'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { ProgressModal, type ProgressState, type ProgressModalConfig } from './ProgressModal';

// ─── Types (rétrocompatibles) ────────────────────────────────────────────────

export interface WeekGenProgressState extends ProgressState {
    weekLabel: string;
}

interface WeekGenerationProgressModalProps {
    state:      WeekGenProgressState;
    onMinimize: () => void;
    onRestore:  () => void;
    onClose:    () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeekGenerationProgressModal({
    state,
    onMinimize,
    onRestore,
    onClose,
}: WeekGenerationProgressModalProps) {
    const config: ProgressModalConfig = {
        icon:             <Zap size={18} className="text-blue-600 dark:text-blue-400" />,
        label:            state.weekLabel,
        titleLoading:     'Génération en cours…',
        titleDone:        'Semaine générée !',
        titleError:       'Erreur de génération',
        subtitleLoading:  'Veuillez patienter ~10 secondes',
        subtitleDone:     'Vos séances sont prêtes',
        miniLabelLoading: 'Génération…',
        miniLabelDone:    'Semaine prête !',
        durationMs:       12_000,
        stages: [
            { label: 'Analyse du contexte',              progressAt: 8 },
            { label: 'Vérification des disponibilités',  progressAt: 30 },
            { label: 'Génération des séances',           progressAt: 55 },
            { label: 'Ajustement de la charge',          progressAt: 80 },
            { label: 'Sauvegarde',                       progressAt: 95 },
        ],
    };

    return (
        <ProgressModal
            state={state}
            config={config}
            onMinimize={onMinimize}
            onRestore={onRestore}
            onClose={onClose}
        />
    );
}
