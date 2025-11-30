export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 ${className}`}>
        {children}
    </div>
);