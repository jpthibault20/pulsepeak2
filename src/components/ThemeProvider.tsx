'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';
import { saveThemePreference } from '@/app/actions/schedule';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setThemeFromProfile: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => {},
    setThemeFromProfile: () => {},
});

export function useTheme() {
    return useContext(ThemeContext);
}

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as Theme | null) ?? 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const initialTheme = useSyncExternalStore(
        () => () => {},
        getInitialTheme,
        () => 'light' as Theme,
    );
    const [theme, setTheme] = useState(initialTheme);

    // Sync DOM attribute on first client render
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const applyTheme = useCallback((next: Theme) => {
        setTheme(next);
        localStorage.setItem('theme', next);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(prev => {
            const next: Theme = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            saveThemePreference(next).catch(console.error);
            return next;
        });
    }, []);

    const setThemeFromProfile = useCallback((profileTheme: Theme) => {
        applyTheme(profileTheme);
    }, [applyTheme]);

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
