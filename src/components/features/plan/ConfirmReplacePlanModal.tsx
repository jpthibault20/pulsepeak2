'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modale';
import { Button } from '@/components/ui/Button';

interface ConfirmReplacePlanModalProps {
    isOpen:          boolean;
    activePlanName:  string;
    onConfirm:       () => void;
    onCancel:        () => void;
}

/**
 * Demande à l'utilisateur de confirmer qu'il souhaite remplacer son plan en
 * cours par un nouveau plan / bloc. Le plan actif est définitivement perdu
 * du point de vue de l'utilisateur — on évite donc tout vocabulaire qui
 * suggérerait une possibilité de récupération.
 */
export const ConfirmReplacePlanModal: React.FC<ConfirmReplacePlanModalProps> = ({
    isOpen,
    activePlanName,
    onConfirm,
    onCancel,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title="Remplacer le plan en cours ?" className="max-w-md">
            <div className="space-y-5">
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-lg flex gap-3 items-start">
                    <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
                    <p className="text-amber-700 dark:text-amber-200/80 text-sm leading-relaxed">
                        Tu as déjà un plan actif&nbsp;:{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">{activePlanName}</span>.
                        <br />
                        Continuer va le remplacer par le nouveau plan. Cette action est définitive.
                    </p>
                </div>

                <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <Button
                        variant="outline"
                        className="flex-1 h-11"
                        onClick={onCancel}
                    >
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1 h-11 font-semibold bg-rose-600 hover:bg-rose-500 border-rose-500 shadow-lg shadow-rose-500/20"
                        onClick={onConfirm}
                    >
                        Remplacer
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
