import { Card } from "@/components/ui/Card";
import { SectionHeader } from "./SessionHeader";
import { User } from "lucide-react";
import { Profile } from "@/lib/data/type";
import { Dispatch, SetStateAction } from "react";

interface BasicInformationProps {
    formData: Profile;
    setFormData: Dispatch<SetStateAction<Profile>>
}

export const BasicInformation: React.FC<BasicInformationProps> = ({ formData, setFormData }) => {

    return (
        <>
            {/* Colonne Gauche : Identité */}
            <Card className="md:col-span-2 p-6 bg-slate-900/50 border-slate-800">
                <SectionHeader icon={User} title="Informations Personnelles" color="text-blue-400" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        placeholder="Prénom"
                        value={formData.firstName}
                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                        className="input-triathlon"
                    />
                    <input
                        placeholder="Nom"
                        value={formData.lastName}
                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        className="input-triathlon"
                    />
                    <input
                        type="email" placeholder="Email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="input-triathlon"
                    />
                    <input
                        type="date"
                        value={formData.birthDate}
                        onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                        className="input-triathlon flex-1"
                    />
                    <div className="flex-1 relative">
                        <input
                            type="number" placeholder="Poids"
                            value={formData.weight}
                            onChange={e => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                            className="input-triathlon"
                        />
                        <span className="absolute right-3 top-2.5 text-slate-500 text-sm">kg</span>
                    </div>
                </div>
            </Card>
        </>
    );
}