import React from 'react';
import {
    LayoutDashboard,
    BarChart2,
    ChevronLeft,
    LucideIcon,
    UserRound,
    Bot,
} from 'lucide-react';
import Image from 'next/image';

// Définition des vues acceptées
export type View = 'dashboard' | 'settings' | 'stats' | 'workout-detail' | 'onboarding' | 'loading';

interface NavProps {
    onViewChange:  (view: View) => void;
    currentView:   string;
    appName?:      string;
    showBack?:     boolean;
    onBack?:       () => void;
    onOpenChat?:   () => void;
}

export const Nav: React.FC<NavProps> = ({
    onViewChange,
    currentView,
    appName = "PulsePeak",
    showBack = false,
    onBack,
    onOpenChat,
}) => {

    const isActive = (viewName: View) => currentView === viewName;

    return (
        <>
            {/* ── TOP BAR (Desktop & Mobile header) ── */}
            <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between">

                    {/* GAUCHE : Logo ou Retour */}
                    <div className="flex items-center">
                        {showBack && onBack ? (
                            <button
                                onClick={onBack}
                                className="flex items-center text-slate-400 hover:text-white transition-colors group"
                            >
                                <div className="bg-slate-800 p-1 rounded-full mr-2 group-hover:bg-slate-700 transition-colors">
                                    <ChevronLeft size={20} />
                                </div>
                                <span className="font-medium text-sm md:text-base">Retour</span>
                            </button>
                        ) : (
                            <div
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => onViewChange('dashboard')}
                            >
                                <div className="relative w-8 h-8">
                                    <Image
                                        src="/logoWhite.png"
                                        alt="PulsePeak Logo"
                                        width={32}
                                        height={32}
                                        className="object-contain"
                                    />
                                </div>
                                <span className="text-xl font-bold bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                    {appName}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* DROITE : Navigation DESKTOP */}
                    <div className="hidden md:flex items-center gap-4">
                        <NavButton
                            active={isActive('dashboard')}
                            onClick={() => onViewChange('dashboard')}
                            icon={LayoutDashboard}
                            label="Agenda"
                        />
                        <NavButton
                            active={isActive('stats')}
                            onClick={() => onViewChange('stats')}
                            icon={BarChart2}
                            label="Stats"
                        />
                        <NavButton
                            active={isActive('settings')}
                            onClick={() => onViewChange('settings')}
                            icon={UserRound}
                            label="Profil"
                        />
                        {onOpenChat && (
                            <button
                                onClick={onOpenChat}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-800/50"
                            >
                                <Bot size={18} />
                                <span className="text-sm font-medium">Coach IA</span>
                            </button>
                        )}
                    </div>

                    {/* Spacer mobile */}
                    <div className="md:hidden w-8" />
                </div>
            </nav>

            {/* ── BOTTOM BAR (Mobile Only) ── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 pb-safe-area">
                <div className="flex justify-around items-center h-16">
                    <MobileNavButton
                        active={isActive('dashboard')}
                        onClick={() => onViewChange('dashboard')}
                        icon={LayoutDashboard}
                        label="Agenda"
                    />
                    <MobileNavButton
                        active={isActive('stats')}
                        onClick={() => onViewChange('stats')}
                        icon={BarChart2}
                        label="Stats"
                    />
                    {onOpenChat && (
                        <MobileNavButton
                            active={false}
                            onClick={onOpenChat}
                            icon={Bot}
                            label="Coach IA"
                            highlight
                        />
                    )}
                    <MobileNavButton
                        active={isActive('settings')}
                        onClick={() => onViewChange('settings')}
                        icon={UserRound}
                        label="Profil"
                    />
                </div>
            </div>
        </>
    );
};

// ─── Bouton Desktop ───────────────────────────────────────────────────────────

interface NavButtonProps {
    active:    boolean;
    onClick:   () => void;
    icon:      LucideIcon;
    label:     string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
            active
                ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
    >
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
    </button>
);

// ─── Bouton Mobile ────────────────────────────────────────────────────────────

interface MobileNavButtonProps extends NavButtonProps {
    highlight?: boolean;
}

const MobileNavButton: React.FC<MobileNavButtonProps> = ({
    active, onClick, icon: Icon, label, highlight = false
}) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
            highlight
                ? 'text-blue-400'
                : active
                    ? 'text-blue-400'
                    : 'text-slate-500 hover:text-slate-300'
        }`}
    >
        <div className={`mb-1 transition-transform duration-200 ${active ? '-translate-y-1' : ''}`}>
            {highlight && !active ? (
                <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center -mt-2">
                        <Icon size={18} strokeWidth={2} />
                    </div>
                </div>
            ) : (
                <Icon size={active ? 24 : 22} strokeWidth={active ? 2.5 : 2} />
            )}
        </div>
        <span className={`text-[10px] font-medium transition-opacity duration-200 ${active || highlight ? 'opacity-100' : 'opacity-70'} ${highlight && !active ? 'mt-0.5' : ''}`}>
            {label}
        </span>
    </button>
);

export default Nav;
