import { Dumbbell, BarChart2, Settings } from "lucide-react";

interface NavProps {
    onViewChange: (view: 'dashboard' | 'settings' | 'stats') => void;
    currentView: string;
}
export const Nav: React.FC<NavProps> = ({ onViewChange, currentView }) => (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewChange('dashboard')}>
                <div className="bg-linear-to-tr from-blue-600 to-cyan-500 p-2 rounded-lg">
                    <Dumbbell size={20} className="text-white" />
                </div>
                <span className="font-bold text-xl text-white tracking-tight">Cyclo<span className="text-blue-400">IA</span></span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={() => onViewChange('stats')}
                    className={`p-2 rounded-full transition-colors ${currentView === 'stats' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Statistiques"
                >
                    <BarChart2 size={20} />
                </button>
                <button
                    onClick={() => onViewChange('settings')}
                    className={`p-2 rounded-full transition-colors ${currentView === 'settings' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Paramètres & Profil"
                >
                    <Settings size={20} />
                </button>
            </div>
        </div>
    </nav>
);