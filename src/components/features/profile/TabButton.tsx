import { LucideIcon } from "lucide-react";

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    label: string;
    icon: LucideIcon;
}

export const TabButton = ({ active, onClick, label, icon: Icon }: TabButtonProps) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${active
            ? 'bg-slate-800 text-blue-400 border-t-2 border-blue-400'
            : 'bg-slate-900/50 text-slate-400 hover:text-slate-200'
            }`}
    >
        <Icon size={16} /> {label}
    </button>
);