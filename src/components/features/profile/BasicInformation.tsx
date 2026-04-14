import { Card } from "@/components/ui/Card";
import { User, Ruler, GraduationCap } from "lucide-react";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { Profile } from "@/lib/data/DatabaseTypes";

interface BasicInformationProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>;
}

const EXPERIENCE_LEVELS = [
    { value: 'Débutant', label: 'Débutant', desc: '< 1 an' },
    { value: 'Intermédiaire', label: 'Intermédiaire', desc: '1–4 ans' },
    { value: 'Avancé', label: 'Avancé', desc: '5+ ans' },
] as const;

function Field({
    label, hint, cls, children
}: { label: string; hint?: string; cls?: string; children: React.ReactNode }) {
    return (
        <div className={`space-y-1.5 ${cls ?? ''}`}>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {label}
                {hint && <span className="normal-case ml-1 font-normal text-slate-500 dark:text-slate-600">({hint})</span>}
            </label>
            {children}
        </div>
    );
}

const inputCls = `
    w-full h-11 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5
    text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-sm
    focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20
    hover:border-slate-400 dark:hover:border-slate-600 transition-colors
`.trim();

export const BasicInformation: React.FC<BasicInformationProps> = ({ formData, setFormData }) => {

    const [now] = useState<number>(() => Date.now());
    const age = useMemo(() => {
        if (!formData.birthDate) return null;
        return Math.floor((now - new Date(formData.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
    }, [formData.birthDate, now]);

    return (
        <div className="space-y-4">

            {/* Identité */}
            <Card className="p-5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                        <User size={14} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Informations personnelles</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Prénom">
                        <input
                            className={inputCls}
                            placeholder="Thomas"
                            value={formData.firstName}
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                        />
                    </Field>

                    <Field label="Nom">
                        <input
                            className={inputCls}
                            placeholder="Dupont"
                            value={formData.lastName}
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        />
                    </Field>

                    <Field label="Email" hint="non modifiable ici" cls="sm:col-span-2">
                        <input
                            type="email"
                            className={`${inputCls} opacity-60 cursor-not-allowed`}
                            value={formData.email}
                            readOnly
                        />
                    </Field>
                </div>
            </Card>

            {/* Données physiques */}
            <Card className="p-5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                        <Ruler size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Données physiques</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Taille" hint="cm">
                        <div className="relative">
                            <input
                                type="number"
                                className={inputCls}
                                placeholder="175"
                                value={formData.height ?? ''}
                                onChange={e => setFormData(prev => ({
                                    ...prev,
                                    height: e.target.value === '' ? undefined : parseInt(e.target.value) || 0
                                }))}
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 text-xs pointer-events-none">cm</span>
                        </div>
                    </Field>

                    <Field label="Poids" hint="kg">
                        <div className="relative">
                            <input
                                type="number"
                                className={inputCls}
                                placeholder="70"
                                value={formData.weight ?? ''}
                                onChange={e => setFormData(prev => ({
                                    ...prev,
                                    weight: e.target.value === '' ? undefined : parseInt(e.target.value) || 0
                                }))}
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 text-xs pointer-events-none">kg</span>
                        </div>
                    </Field>

                    <Field label="Date de naissance" cls="col-span-2">
                        <input
                            type="date"
                            className={inputCls}
                            style={{ colorScheme: 'dark' }}
                            value={formData.birthDate ?? ''}
                            onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                        />
                        {age !== null && (
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 ml-0.5">{age} ans</p>
                        )}
                    </Field>
                </div>
            </Card>

            {/* Expérience */}
            <Card className="p-5 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
                        <GraduationCap size={14} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Niveau d&apos;expérience</h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {EXPERIENCE_LEVELS.map(lvl => {
                        const active = formData.experience === lvl.value;
                        return (
                            <button
                                key={lvl.value}
                                onClick={() => setFormData({ ...formData, experience: lvl.value })}
                                className={`
                                    p-3 rounded-xl border text-left transition-all
                                    ${active
                                        ? 'bg-purple-600/15 border-purple-500/50 shadow-sm shadow-purple-900/20'
                                        : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                                    }
                                `}
                            >
                                <p className={`text-sm font-semibold ${active ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {lvl.label}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{lvl.desc}</p>
                                {active && (
                                    <div className="mt-2 w-4 h-0.5 rounded-full bg-purple-500" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
};
