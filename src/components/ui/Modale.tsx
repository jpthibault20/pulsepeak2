'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Card } from './Card'; // Import du composant Card situé dans le même dossier

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string; // Pour surcharger la largeur si besoin (ex: max-w-lg)
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    className = 'max-w-md'
}) => {

    // Gestion de la touche "Échap" pour fermer la modale
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            // Empêche le défilement de la page principale quand la modale est ouverte
            document.body.style.overflow = 'hidden';
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            // Rétablit le défilement à la fermeture
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all"
            onClick={onClose} // Ferme la modale si on clique sur l'arrière-plan grisé
        >
            {/* Conteneur de la modale : on arrête la propagation du clic ici pour éviter de fermer en cliquant DANS la boîte */}
            <div
                className={`w-full ${className} animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                <Card className="relative shadow-2xl border-slate-700">
                    {/* En-tête avec Titre et Bouton de fermeture */}
                    <div className="flex justify-between items-start mb-4">
                        {title && <h2 className="text-xl font-bold text-white">{title}</h2>}

                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"
                            aria-label="Fermer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Contenu principal de la modale */}
                    <div className="text-slate-300">
                        {children}
                    </div>
                </Card>
            </div>
        </div>
    );
};