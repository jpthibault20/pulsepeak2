'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { saveThemePreference } from '@/app/actions/schedule';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setThemeFromProfile: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'dark',
    toggleTheme: () => {},
    setThemeFromProfile: () => {},
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('dark');

    useEffect(() => {
        const saved = localStorage.getItem('theme') as Theme | null;
        const initial = saved ?? 'dark';
        setTheme(initial);
        document.documentElement.setAttribute('data-theme', initial);
    }, []);

    const applyTheme = (next: Theme) => {
        setTheme(next);
        localStorage.setItem('theme', next);
        document.documentElement.setAttribute('data-theme', next);
    };

    const toggleTheme = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        saveThemePreference(next).catch(console.error);
    };

    const setThemeFromProfile = (profileTheme: Theme) => {
        applyTheme(profileTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setThemeFromProfile }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function ThemeToggle({ className = '' }: { className?: string }) {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors
                text-slate-500 hover:text-slate-700 hover:bg-slate-100
                dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800
                ${className}`}
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            aria-label="Changer le thème"
        >
            {theme === 'dark'
                ? <Sun size={18} />
                : <Moon size={18} />
            }
        </button>
    );
}
