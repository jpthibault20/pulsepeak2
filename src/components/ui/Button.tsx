
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
    icon?: React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    variant = 'primary',
    className = '',
    disabled = false,
    icon: Icon,
    ...props
}) => {
    const baseStyles = "flex items-center justify-center px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",
        secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100",
        outline: "border border-slate-600 text-slate-300 hover:bg-slate-800",
        danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20",
        success: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20",
        ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {Icon && <Icon size={18} className="mr-2" />}
            {children}
        </button>
    );
};