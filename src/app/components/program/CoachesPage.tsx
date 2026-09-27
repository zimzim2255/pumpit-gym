import { useState, useEffect } from "react";
import { Plus, Trash2, Eye, Pencil, Phone, UserRound, Calendar, Upload } from "lucide-react";
import ModalCard from "../ui/ModalCard";
import { InputField } from "../ui/FormField";
import { loadAll, createTrainer, updateTrainer, deleteTrainer } from "../../services/programService";
import { uploadMemberPhoto } from "../../services/cloudinaryService";
const STORE_KEY = "gym_programme_data";
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";
function loadStore(): any {
  try { const r = localStorage.getItem(STORE_KEY); if (r) return JSON.parse(r); } catch {}
  return { activities: [], groups: [], trainers: [], cours: [], packs: [] };
}
async function subList(): Promise<any[]> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/subscription-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ type: "list" }),
    });
    if (res.ok) return (await res.json()).subscriptions || [];
  } catch {}
  return [];
}
export default function CoachesPage() {
  const [trainers, setTrainers] = useState<any[]>(loadStore().trainers || []);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const buildTrainers = (dbTrainers: any[], sList: any[]) => {
    const byName = new Map<string, any>();
    (dbTrainers || []).forEach(t => byName.set(t.name, t));
    (sList || []).forEach(su => {
      if (su.trainer) byName.set(su.trainer, { ...(byName.get(su.trainer) || { id: `SUB_${su.trainer}`, name: su.trainer, phone: "", specialty: "" }) });
    });
    return [...byName.values()];
  };
  const refresh = (sList?: any[]) => loadAll().then(db => {
    const all = buildTrainers(db.trainers || [], sList || subs);
    setTrainers(all);
    try { const st = loadStore(); st.trainers = all; localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch {}
  }).catch(() => {});
  useEffect(() => {
    loadAll().then(db => {
      subList().then(s => { setSubs(s); refresh([...(db.trainers || []), ...s]); });
    }).catch(() => {
      subList().then(s => { setSubs(s); refresh(s); }).catch(() => {});
    });
  }, []);
  const resetForm = () => { setName(""); setPhone(""); setSpecialty(""); setPhoto(""); setPreview(null); };
  const openEdit = (t: any) => {
    setEditTarget(t);
    setName(t.name || "");
    setPhone(t.phone || "");
    setSpecialty(t.specialty || "");
    setPhoto(t.photo || t.photo_url || "");
    setPreview(null);
  };
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
const create = () => {
    if (!name.trim()) return;
    createTrainer({ name: name.trim(), phone: phone.trim(), specialty: specialty.trim(), photo: photo || undefined })
      .then(() => { setShowCreate(false); resetForm(); refresh(); });
  };
  const saveEdit = () => {
    if (!editTarget || !name.trim()) return;
    const payload = { name: name.trim(), phone: phone.trim(), specialty: specialty.trim(), photo: photo || undefined };
    const existing = trainers.find(t => t.id === editTarget.id);
    if (existing && !existing.id.startsWith("SUB_")) {
      updateTrainer({ id: editTarget.id, ...payload }).then(() => { setEditTarget(null); resetForm(); refresh(); });
    } else {
      createTrainer(payload).then(() => { setEditTarget(null); resetForm(); refresh(); });
    }
  };
  const del = (id: string) => {
    deleteTrainer(id).then(() => refresh());
  };
  const coachSubs = (name: string) => (subs || []).filter(s => s.trainer === name);
  const subCommission = (sub: any) => {
    const cm: Record<string, { percent?: number; amount?: number }> = sub.commissions || {};
    const price = Number(sub.price || 0);
    return Object.values(cm).reduce((sum, c) => {
      const amount = Number(c.amount || 0);
      const byPercent = Number(c.percent || 0) ? Math.round((price * Number(c.percent)) / 100) : 0;
      return sum + (amount || byPercent);
    }, 0);
  };
  const totalOf = (t: any) => coachSubs(t.name).reduce((sum, sub) => sum + subCommission(sub), 0);
  const init = (n: string) => (n || "?").trim().charAt(0).toUpperCase() || "?";
  const avatar = (t: any, size = "w-8 h-8", rounded = "rounded-full") => {
    const src = (t?.photo || t?.photo_url || "").trim();
    if (src) return <img src={src} alt={t.name || ""} className={`${size} ${rounded} object-cover`} />;
    return <div className={`${size} ${rounded} bg-[#EA5800]/20 flex items-center justify-center text-sm font-bold text-[#EA5800]`}>{init(t.name)}</div>;
  };
  const photoField = () => (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Upload className="w-4 h-4 text-[#EA5800]" />
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Photo du coach (optionnelle)</h3>
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
          {preview || photo ? <img src={preview || photo} alt="Preview" className="w-full h-full rounded-full object-cover" /> : <UserRound className="w-10 h-10 text-white/30" />}
        </div>
      </div>
      <p className="text-[11px] text-white/40 mt-2">Cliquez sur « Parcourir... » pour choisir la photo d'identité du coach.</p>
    </div>
  );
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Entraîneurs / Coaches</h1>
          <p className="text-xs text-white/30 font-mono">{trainers.length} entraîneur(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(prev => !prev)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#EA5800] text-white text-sm font-medium transition-all"><Plus className="w-3.5 h-3.5" />{(showCreate ? "Annuler" : "Créer un entraîneur")}</button>
        </div>
      </div>

      {showCreate && (
        <ModalCard title="Créer un entraîneur" onClose={() => setShowCreate(false)}>
          <div className="max-h-[75vh] overflow-y-auto space-y-3">
            <InputField label="Nom" icon={UserRound} value={name} onChange={v => setName(v as string)} placeholder="Nom du coach" />
            <InputField label="Téléphone" icon={Phone} value={phone} onChange={v => setPhone(v as string)} placeholder="Téléphone" />
            <InputField label="Spécialité" icon={Calendar} value={specialty} onChange={v => setSpecialty(v as string)} placeholder="Musculation, MMA, Yoga..." />
            {photoField()}
            <p className="text-[11px] text-white/40">La commission est définie par abonnement, lors de l'assignation du coach à un cours.</p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded border border-white/15 text-white/60">Annuler</button>
            <button onClick={create} className="px-4 py-2 rounded bg-[#EA5800] text-white" disabled={uploading}>Créer</button>
          </div>
        </ModalCard>
)}
{editTarget && (
        <ModalCard title={`Modifier le profil — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <div className="max-h-[75vh] overflow-y-auto space-y-3">
            <InputField label="Nom" icon={UserRound} value={name} onChange={v => setName(v as string)} placeholder="Nom du coach" />
            <InputField label="Téléphone" icon={Phone} value={phone} onChange={v => setPhone(v as string)} placeholder="Téléphone" />
            <InputField label="Spécialité" icon={Calendar} value={specialty} onChange={v => setSpecialty(v as string)} placeholder="Musculation, MMA, Yoga..." />
            {photoField()}
            <p className="text-[11px] text-white/40">Modifiez le profil du coach puis enregistrez.</p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditTarget(null)} className="px-4 py-2 rounded border border-white/15 text-white/60">Annuler</button>
            <button onClick={saveEdit} className="px-4 py-2 rounded bg-[#EA5800] text-white" disabled={uploading}>Enregistrer</button>
          </div>
        </ModalCard>
      )}

      <div className="bg-[#0B0F17]/60 border border-white/5 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/3">
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Coach</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Téléphone</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Spécialité</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Abonnements</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-white/30 uppercase">Total commissions</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-white/30 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {trainers.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-white/20 text-sm">Aucun entraîneur</td></tr>
            ) : trainers.map((t, i) => {
              const cnt = coachSubs(t.name).length;
              const total = totalOf(t);
              return (
                <tr key={t.id || i} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-3"><div className="flex items-center gap-2">{avatar(t)}<span className="font-medium text-white">{t.name}</span></div></td>
                  <td className="px-3 py-3 font-mono text-xs text-white/50">{t.phone || "—"}</td>
                  <td className="px-3 py-3 text-white/70">{t.specialty || "—"}</td>
                  <td className="px-3 py-3 text-white">{cnt}</td>
                  <td className="px-3 py-3 font-mono text-xs font-bold text-emerald-400">{total.toLocaleString()} DH</td>
                  <td className="px-3 py-3"><div className="flex items-center justify-end gap-3">
                    <button onClick={() => setDetail(t)} className="text-white/40 hover:text-white" title="Voir"><Eye className="w-[18px] h-[18px]" /></button>
                    <button onClick={() => openEdit(t)} className="text-white/40 hover:text-[#EA5800]" title="Modifier"><Pencil className="w-[18px] h-[18px]" /></button>
                    <button onClick={() => del(t.id)} className="text-white/40 hover:text-red-400" title="Supprimer"><Trash2 className="w-[18px] h-[18px]" /></button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && (
        <ModalCard title={`Détails — ${detail.name}`} onClose={() => setDetail(null)} wide>
          <div className="max-h-[75vh] overflow-y-auto space-y-4">
            <div className="flex items-center gap-3">
              {avatar(detail, "w-16 h-16", "rounded-xl")}
              <div className="flex-1">
                <div className="text-xs text-white/40">Spécialité</div>
                <div className="text-white/80">{detail.specialty || "—"}</div>
              </div>
            </div>
            <div className="p-3 rounded bg-white/5 flex items-center justify-between">
              <div className="text-right">
                <div className="text-xs text-white/40">Total commissions</div>
                <div className="text-lg font-bold text-emerald-400">{totalOf(detail).toLocaleString()} DH</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Abonnement</th>
                  <th className="px-3 py-2 text-right text-xs text-white/30 uppercase">Commission</th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {coachSubs(detail.name).map((s: any, i: number) => (
                    <tr key={s.id || i} className="border-b border-white/5">
                      <td className="px-3 py-2.5"><span className="font-mono text-xs text-[#EA5800]">{s.id}</span> <span className="text-white/80">— {s.member}</span></td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-400">{subCommission(s)} DH</td>
                    </tr>
                  ))}
                  {coachSubs(detail.name).length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-white/20 text-sm">Aucun abonnement assigné</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </ModalCard>
      )}
    </div>
  );
}