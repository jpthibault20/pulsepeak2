import React from 'react';
import { Loader2 } from 'lucide-react'; // Icône de chargement standard

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon'; // Ajout des tailles
    icon?: React.ElementType;
    isLoading?: boolean; // Ajout de l'état de chargement
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    isLoading = false,
    icon: Icon,
    ...props
}, ref) => {

    // DESIGN: Base styles
    // - inline-flex et items-center : Pour centrer parfaitement icône et texte
    // - active:scale-95 : Le petit effet "clic" satisfaisant sur mobile
    // - disabled:opacity-50 : Feedback visuel immédiat si désactivé
    const baseStyles = "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900";

    // DESIGN: Variantes de couleurs
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 border border-transparent",
        secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100 border border-transparent",
        outline: "bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white",
        danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20",
        success: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20",
        ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
    };

    // DESIGN: Tailles adaptées au tactile
    const sizes = {
        sm: "h-9 px-3 text-xs",           // Petit (pour les listes, actions secondaires)
        md: "h-11 px-4 text-sm",          // Standard (hauteur 44px recommandée pour le tactile)
        lg: "h-12 px-6 text-base",        // Grand (pour les appels à l'action principaux)
        icon: "h-10 w-10 p-0",            // Carré (pour les boutons avec juste une icône)
    };

    return (
        <button
            ref={ref}
            disabled={disabled || isLoading}
            className={`
                ${baseStyles} 
                ${variants[variant]} 
                ${sizes[size]} 
                ${className}
            `}
            {...props}
        >
            {/* Gestion du Loading : On remplace l'icône par un spinner */}
            {isLoading ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
            ) : Icon ? (
                <Icon size={18} className={children ? "mr-2" : ""} />
            ) : null}

            {children}
        </button>
    );
});

// Nécessaire pour l'affichage dans les devtools React avec forwardRef
Button.displayName = "Button";