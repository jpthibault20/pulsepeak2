import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean; // Option pour désactiver le padding par défaut
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    noPadding = false,
    ...props // Permet de passer onClick, id, etc.
}) => (
    <div
        className={`
            bg-slate-900/60 backdrop-blur-md 
            border border-slate-800 
            rounded-xl md:rounded-2xl 
            shadow-sm
            ${noPadding ? 'p-0' : 'p-4 md:p-6'} /* Padding adaptatif mobile/desktop */
            ${className}
        `}
        {...props}
    >
        {children}
    </div>
);