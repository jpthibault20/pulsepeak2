export const Badge: React.FC<{ type: string }> = ({ type }) => {
    const styles: { [key: string]: string } = {
        Endurance: "bg-green-500/20 text-green-400 border-green-500/30",
        HIIT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        Threshold: "bg-red-500/20 text-red-400 border-red-500/30",
        Recovery: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        Tempo: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        Rest: "bg-slate-600/20 text-slate-400 border-slate-600/30",
        VO2max: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        PMA: "bg-pink-500/20 text-pink-400 border-pink-500/30",
        Fartlek: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
        Test: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    };

    const defaultStyle = "bg-slate-700 text-slate-300";

    return (
        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${styles[type] || defaultStyle}`}>
            {type}
        </span>
    );
};