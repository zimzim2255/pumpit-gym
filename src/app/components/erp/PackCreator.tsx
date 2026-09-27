import { useState } from "react";
import { Check, Package, DollarSign, Calendar, Users, X } from "lucide-react";
import ModalCard from "../ui/ModalCard";
import { InputField, SelectField } from "../ui/FormField";
import { createPack } from "../../services/programService";

const STORE_KEY = "gym_programme_data";
function loadStore(): any {
  try { const r = localStorage.getItem(STORE_KEY); if (r) return JSON.parse(r); } catch {}
  return { activities: [], groups: [], trainers: [], cours: [], packs: [] };
}
const DURATIONS = ["1 mois", "3 mois", "6 mois", "12 mois"];

interface PackCreatorProps { onClose: () => void; onCreated?: () => void; }

export default function PackCreator({ onClose, onCreated }: PackCreatorProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("12 mois");
  const [maxB, setMaxB] = useState(3);
  const [status, setStatus] = useState("Actif");

  const submit = () => {
    if (!name.trim()) return;
    const s = loadStore();
    const priceNum = Number(price) || 0;
    s.packs.push({ id: `p_${Date.now()}`, name: name.trim(), price: priceNum, duration, max_beneficiaries: Math.min(3, Math.max(1, maxB)), activities: [], status });
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    createPack({ name: name.trim(), price: priceNum, duration, max_beneficiaries: Math.min(3, Math.max(1, maxB)), activities: [], status }).catch(e => console.error("createPack", e));
    onCreated?.(); onClose();
  };

  return (
    <ModalCard title="Créer un pack familial" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nom du pack" icon={Package} value={name} onChange={v => setName(v as string)} placeholder="Ex: Pack familial" required />
          <InputField label="Prix (DH)" icon={DollarSign} value={price} onChange={v => setPrice(v as string)} placeholder="Ex: 499" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Durée" icon={Calendar} value={duration} onChange={v => setDuration(v)} options={DURATIONS.map(d => ({ value: d, label: d }))} />
          <SelectField label="Bénéficiaires max" icon={Users} value={String(maxB)} onChange={v => setMaxB(Number(v))} options={[1, 2, 3].map(n => ({ value: String(n), label: String(n) }))} />
        </div>
        <p className="text-[11px] text-white/50">Le pack couvre jusqu'à 3 bénéficiaires ; chacun conserve son propre accès, présence et tarif.</p>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
        <button onClick={submit} className="px-4 py-2 text-sm rounded bg-[#EA5800] text-white font-medium inline-flex items-center gap-2"><Check className="w-4 h-4" /> Créer le pack</button>
      </div>
    </ModalCard>
  );
}