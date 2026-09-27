import { useState } from "react";
import { Check, Package, DollarSign, Calendar, Users, Upload, X } from "lucide-react";
import ModalCard from "../ui/ModalCard";
import { InputField, SelectField } from "../ui/FormField";
import { createPack } from "../../services/programService";
import { uploadMemberPhoto } from "../../services/cloudinaryService";

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
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { window.alert("L'image dépasse 5MB. Choisissez une image plus légère."); return; }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadMemberPhoto(file);
      setPhoto(url);
    } catch {}
    finally { setUploading(false); }
  };

  const submit = () => {
    if (!name.trim()) return;
    const s = loadStore();
    const priceNum = Number(price) || 0;
    s.packs.push({ id: `p_${Date.now()}`, name: name.trim(), price: priceNum, duration, max_beneficiaries: Math.min(3, Math.max(1, maxB)), activities: [], status, photo: photo || "" });
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    createPack({ name: name.trim(), price: priceNum, duration, max_beneficiaries: Math.min(3, Math.max(1, maxB)), activities: [], status, photo: photo || "" }).catch(e => console.error("createPack", e));
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
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-[#EA5800]" />
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Photo du pack (optionnelle)</h3>
          </div>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-[#475569] rounded-xl hover:border-[#EA5800]/50 transition-colors min-h-[110px] min-w-[110px]">
              {uploading ? (
                <div className="w-6 h-6 border-2 border-[#EA5800] border-t-transparent rounded-full animate-spin" />
              ) : preview || photo ? (
                <img src={preview || photo} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-2"><Upload className="w-4 h-4 text-[#94A3B0]" /></div>
                  <span className="text-xs text-white/70">Parcourir...</span>
                  <span className="text-[10px] text-white/40">PNG, JPG, WEBP</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={pickPhoto} className="hidden" disabled={uploading} />
            </label>
            <div className="w-20 h-20 rounded-full bg-[#475569] flex items-center justify-center">
              {preview || photo ? <img src={preview || photo} alt="Preview" className="w-full h-full rounded-full object-cover" /> : <Package className="w-10 h-10 text-white/30" />}
            </div>
          </div>
          <p className="text-[11px] text-white/40 mt-2">Cliquez sur « Parcourir... » pour choisir la photo du pack.</p>
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