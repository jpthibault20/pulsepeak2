'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen:    boolean;
    onClose:   () => void;
    title?:    string;
    children:  React.ReactNode;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    className = 'max-w-lg',
}) => {
    // Nécessaire pour éviter un rendu SSR de document.body
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

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

    if (!isOpen || !mounted) return null;

    // Le portal rend directement dans document.body — aucun stacking context parent
    // (backdrop-blur, transform, etc.) ne peut plus piéger le positionnement fixed.
    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className={`w-full ${className} max-h-[90dvh] flex flex-col animate-in zoom-in-95 duration-200`}
                onClick={e => e.stopPropagation()}
            >
                {/* Fond explicitement opaque — pas de /60 ni backdrop-blur interne */}
                <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">

                    {/* En-tête fixe */}
                    <div className="flex justify-between items-center px-5 py-4 border-b border-slate-800 shrink-0">
                        {title && (
                            <h2 className="text-lg font-bold text-white truncate pr-4">{title}</h2>
                        )}
                        <button
                            onClick={onClose}
                            className="ml-auto text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 shrink-0"
                            aria-label="Fermer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Corps défilant */}
                    <div className="px-5 py-5 overflow-y-auto flex-1 text-slate-300">
                        {children}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
};
