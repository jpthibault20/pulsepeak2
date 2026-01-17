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
                        className="input-triathlon md:col-span-2"
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

            <style jsx global>{`
        .input-triathlon {
          width: 100%;
          height: 44px;
          background-color: #0f172a; /* slate-900 */
          border: 1px solid #334155; /* slate-700 */
          border-radius: 0.5rem;
          padding: 0 1rem;
          color: white;
          outline: none;
          transition: all 0.2s;
        }
        .input-triathlon:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }
      `}</style>
        </>
    );
}