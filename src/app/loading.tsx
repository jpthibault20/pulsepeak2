export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Chargement…</p>
            </div>
        </div>
    );
}
