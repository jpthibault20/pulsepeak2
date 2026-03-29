import React from 'react';
import {
    LayoutDashboard,
    BarChart2,
    LucideIcon,
    UserRound,
    Bot,
} from 'lucide-react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeProvider';

export type View = 'dashboard' | 'settings' | 'stats' | 'workout-detail' | 'onboarding' | 'loading' | 'chat';

interface NavProps {
    onViewChange: (view: View) => void;
    currentView:  string;
    appName?:     string;
}

export const Nav: React.FC<NavProps> = ({
    onViewChange,
    currentView,
    appName = "PulsePeak",
}) => {
    const isActive = (v: View) => currentView === v;

    return (
        <>
            {/* ══════════════════════════════════════════════
                TOP BAR  —  sticky, desktop + mobile header
            ══════════════════════════════════════════════ */}
            <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.06] shadow-sm shadow-slate-900/5 dark:shadow-none">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

                    {/* ── Left: logo (toujours visible) ── */}
                    <button
                        onClick={() => onViewChange('dashboard')}
                        className="flex items-center gap-2.5"
                    >
                        <div className="relative w-7 h-7">
                            <Image
                                src="/logoWhite.png"
                                alt="PulsePeak"
                                width={28}
                                height={28}
                                className="object-contain invert dark:invert-0"
                            />
                        </div>
                        <span className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                            {appName}
                        </span>
                    </button>

                    {/* ── Right: desktop nav + theme toggle ── */}
                    <div className="hidden md:flex items-center gap-1">
                        <DesktopItem active={isActive('dashboard')} onClick={() => onViewChange('dashboard')} icon={LayoutDashboard} label="Agenda"   />
                        <DesktopItem active={isActive('stats')}     onClick={() => onViewChange('stats')}     icon={BarChart2}      label="Stats"    />
                        <DesktopItem active={isActive('settings')}  onClick={() => onViewChange('settings')}  icon={UserRound}      label="Profil"   />
                        <DesktopItem active={isActive('chat')}      onClick={() => onViewChange('chat')}      icon={Bot}            label="Coach IA" />
                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <ThemeToggle />
                    </div>

                    {/* Mobile: theme toggle visible */}
                    <div className="md:hidden">
                        <ThemeToggle />
                    </div>
                </div>
            </nav>

            {/* ══════════════════════════════════════════════
                BOTTOM BAR  —  mobile only, floating pill
            ══════════════════════════════════════════════ */}
            <div className="md:hidden fixed bottom-3 left-3 right-3 z-50">
                {/* Pill container */}
                <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-lg shadow-slate-900/10 dark:shadow-black/60 h-16 flex items-center px-1">

                    <MobileItem active={isActive('dashboard')} onClick={() => onViewChange('dashboard')} icon={LayoutDashboard} label="Agenda"   />
                    <MobileItem active={isActive('stats')}     onClick={() => onViewChange('stats')}     icon={BarChart2}      label="Stats"    />
                    <MobileItem active={isActive('chat')}      onClick={() => onViewChange('chat')}      icon={Bot}            label="Coach IA" />
                    <MobileItem active={isActive('settings')}  onClick={() => onViewChange('settings')}  icon={UserRound}      label="Profil"   />
                </div>
            </div>
        </>
    );
};

// ─── Desktop nav item ─────────────────────────────────────────────────────────

interface ItemProps {
    active:  boolean;
    onClick: () => void;
    icon:    LucideIcon;
    label:   string;
}

const DesktopItem: React.FC<ItemProps> = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`
            relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
            transition-all duration-200
            ${active
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
            }
        `}
    >
        <Icon size={16} strokeWidth={active ? 2.5 : 2} />
        {label}
    </button>
);

// ─── Mobile nav item ──────────────────────────────────────────────────────────

const MobileItem: React.FC<ItemProps> = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className="flex-1 flex flex-col items-center justify-center gap-[3px] h-full"
    >
        <Icon
            size={active ? 22 : 20}
            strokeWidth={active ? 2.5 : 2}
            className={`transition-all duration-200 ${active ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}
        />
        <span className={`text-[10px] font-medium transition-colors duration-200 ${active ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500 dark:text-slate-600'}`}>
            {label}
        </span>
        {active && (
            <span className="w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-500" />
        )}
    </button>
);

export default Nav;
