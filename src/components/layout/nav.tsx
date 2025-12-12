import React from 'react';
import {
    LayoutDashboard,
    BarChart2,
    Settings,
    ChevronLeft,
    LucideIcon,
} from 'lucide-react';
import Image from 'next/image'; // Importation du composant Image de Next.js

// Définition des vues acceptées
type View = 'dashboard' | 'settings' | 'stats' | 'workout-detail' | 'onboarding' | 'loading';

interface NavProps {
    onViewChange: (view: View) => void;
    currentView: string;
    appName?: string;
    showBack?: boolean;
    onBack?: () => void;
}

export const Nav: React.FC<NavProps> = ({
    onViewChange,
    currentView,
    appName = "PulsePeak",
    showBack = false,
    onBack
}) => {
    return (
        <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">

                {/* CÔTÉ GAUCHE : Logo OU Bouton Retour */}
                <div className="flex items-center">
                    {showBack && onBack ? (
                        // Mode Retour (pour Stats / Settings)
                        <button
                            onClick={onBack}
                            className="flex items-center text-slate-400 hover:text-white transition-colors group"
                        >
                            <div className="bg-slate-800 p-1 rounded-full mr-2 group-hover:bg-slate-700 transition-colors">
                                <ChevronLeft size={20} />
                            </div>
                            <span className="font-medium">Retour</span>
                        </button>
                    ) : (
                        // Mode Logo (Dashboard)
                        <div
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => onViewChange('dashboard')}
                        >
                            <div className="">
                                {/* Utilisation du composant Image de Next.js */}
                                <Image
                                    src="/image_0.png" // Assurez-vous que le nom du fichier dans /public est correct
                                    alt="PulsePeak Logo"
                                    // MODIFICATION : Augmentation des props width/height intrinsèques (24 -> 32)
                                    width={32}
                                    height={32}
                                    // MODIFICATION : Augmentation des classes Tailwind (w-5 h-5 -> w-8 h-8) soit 32px
                                    className="w-8 h-8 object-contain"
                                />
                            </div>
                            <span className="text-xl font-bold bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                {appName}
                            </span>
                        </div>
                    )}
                </div>

                {/* CÔTÉ DROIT : Liens de Navigation */}
                <div className="flex items-center gap-2 md:gap-4">
                    <NavButton
                        active={currentView === 'dashboard'}
                        onClick={() => onViewChange('dashboard')}
                        icon={LayoutDashboard}
                        label="Agenda"
                    />
                    <NavButton
                        active={currentView === 'stats'}
                        onClick={() => onViewChange('stats')}
                        icon={BarChart2}
                        label="Stats"
                    />
                    <NavButton
                        active={currentView === 'settings'}
                        onClick={() => onViewChange('settings')}
                        icon={Settings}
                        label="Réglages"
                    />
                </div>
            </div>
        </nav>
    );
};

// --- CORRECTION DU TYPE ICI ---
interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: LucideIcon; // Utilisation du type précis au lieu de 'any'
    label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${active
            ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
    >
        <Icon size={18} />
        <span className="hidden md:inline text-sm font-medium">{label}</span>
    </button>
);

export default Nav;