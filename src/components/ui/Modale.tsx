import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Card } from './Card';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    className = 'max-w-lg' // J'ai un peu élargi le défaut pour être confortable
}) => {

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        // z-50 est le standard Tailwind pour passer au-dessus de tout
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all"
            onClick={onClose}
        >
            {/* DESIGN:
               - max-h-[90dvh] : Utilise la hauteur dynamique (viewport height) pour éviter les soucis sur mobile
               - flex flex-col : Essentiel pour le sticky header
            */}
            <div
                className={`w-full ${className} max-h-[90dvh] flex flex-col animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* On utilise noPadding pour gérer nous-mêmes l'espacement Header vs Body */}
                <Card className="flex flex-col h-full overflow-hidden shadow-2xl border-slate-700" noPadding>

                    {/* EN-TÊTE FIXE */}
                    <div className="flex justify-between items-center p-4 md:p-5 border-b border-slate-800 bg-slate-900/50 shrink-0">
                        {title && <h2 className="text-lg md:text-xl font-bold text-white truncate pr-4">{title}</h2>}

                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800 shrink-0"
                            aria-label="Fermer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* CORPS DÉFILANT */}
                    {/* overflow-y-auto : C'est ici que le scroll se fait */}
                    <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar">
                        <div className="text-slate-300">
                            {children}
                        </div>
                    </div>

                </Card>
            </div>
        </div>
    );
};