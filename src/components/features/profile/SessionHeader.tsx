import { LucideIcon } from "lucide-react";

export const SectionHeader = ({ icon: Icon, title, color = "text-white", rightContent }: { icon: LucideIcon; title: string; color?: string; rightContent?: React.ReactNode; }) => (
    <h3 className={`text-lg font-semibold ${color} mb-4 flex items-center justify-between border-b border-slate-800 pb-2`}>
        <span className="flex items-center">
            <Icon className="mr-2" size={20} />
            {title}
        </span>
        {rightContent && (
            <span className="text-xl text-white">
                {rightContent}
            </span>
        )}
    </h3>
);