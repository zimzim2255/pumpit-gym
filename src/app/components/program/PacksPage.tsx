import { useState, useEffect } from "react";
import { Plus, Trash2, Settings2, Package, DollarSign, Calendar, Users } from "lucide-react";
import PackCreator from "../erp/PackCreator";
import { loadAll, deletePack, updatePack } from "../../services/programService";
import ModalCard from "../ui/ModalCard";
import { InputField, SelectField } from "../ui/FormField";

const STORE_KEY = "gym_programme_data";
function loadStore(): any {
  try { const r = localStorage.getItem(STORE_KEY); if (r) return JSON.parse(r); } catch {}
  return { activities: [], groups: [], trainers: [], cours: [], packs: [] };
}
function actName(id: string): string {
  return loadStore().activities.find((a: any) => a.id === id)?.name || id;
}
const DURATIONS = ["1 mois", "3 mois", "6 mois", "12 mois"];

export default function PacksPage() {
  const [packs, setPacks] = useState<any[]>([]);
  const [tab, setTab] = useState<"familial" | "plus1">("familial");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePlus1, setShowCreatePlus1] = useState(false);
  const [editPack, setEditPack] = useState<any>(null);
  const [editActs, setEditActs] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editDuration, setEditDuration] = useState("12 mois");
  const [editMaxB, setEditMaxB] = useState(3);
  const [editStatus, setEditStatus] = useState("Actif");
  const allActs = (loadStore().activities || []) as any[];
  const isPlus1 = (p: any) => (p.pack_type || "familial") === "plus1";
  const viewPacks = packs.filter(p => (tab === "plus1") === isPlus1(p));
  const countFamilial = packs.filter(p => !isPlus1(p)).length;
  const countPlus1 = packs.filter(p => isPlus1(p)).length;
  const refresh = () => loadAll().then(db => { setPacks(db.packs || []); try { const s = loadStore(); s.packs = db.packs || []; s.activities = db.activities || s.activities; localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {} }).catch(() => setPacks([]));
  useEffect(() => { refresh(); }, []);

  const del = (id: string) => { deletePack(id).then(() => refresh()); };
  const openEdit = (p: any) => { setEditPack(p); setEditActs((p.activities || []).slice()); setEditName(p.name || ""); setEditPrice(Number(p.price) || 0); setEditDuration(p.duration || "12 mois"); setEditMaxB(Number(p.max_beneficiaries) || 3); setEditStatus(p.status || "Actif"); };
  const toggleEditAct = (id: string) => setEditActs(editActs.includes(id) ? editActs.filter(x => x !== id) : [...editActs, id]);
  const saveEdit = () => {
    if (!editPack) return;
    const priceNum = editPrice || 0;
    const finalMax = (editPack.pack_type || "familial") === "plus1" ? 1 : Math.min(3, Math.max(1, editMaxB));
    updatePack({
      id: editPack.id, name: editName.trim(), price: priceNum, status: editStatus,
      photo: editPack.photo, max_beneficiaries: finalMax, duration: editDuration,
      activities: editActs,
    }).then(() => {
      try { const s = loadStore(); s.packs = (s.packs || []).map((x: any) => x.id === editPack.id ? { ...x, name: editName.trim(), price: priceNum, status: editStatus, duration: editDuration, max_beneficiaries: finalMax, activities: editActs } : x); localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
      setEditPack(null); refresh();
    }).catch(e => console.error("updatePack", e));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-white">Packs & Tarifs</h1>
        <button onClick={() => { if (tab === "plus1") setShowCreatePlus1(true); else setShowCreate(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-[#EA5800] hover:bg-[#d94118] text-white"><Plus className="w-3.5 h-3.5" /> {tab === "plus1" ? "Créer un pack +1" : "Créer un pack familial"}</button>
      </div>

      <div className="flex gap-2 bg-white/5 rounded-lg p-1">
        <button onClick={() => setTab("familial")} className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md ${tab === "familial" ? "bg-[#EA5800] text-white" : "text-white/50 hover:bg-white/10"}`}>Pack Familial <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/40 text-[10px] font-mono">{countFamilial}</span></button>
        <button onClick={() => setTab("plus1")} className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md ${tab === "plus1" ? "bg-[#EA5800] text-white" : "text-white/50 hover:bg-white/10"}`}>Pack +1 <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/40 text-[10px] font-mono">{countPlus1}</span></button>
      </div>

      <div className="bg-card border border-white/5 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">Pack</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">Prix</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">Durée</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">Bénéficiaires max</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">Activités</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">Statut</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {viewPacks.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-white/20 text-sm">Aucun pack {tab === "plus1" ? "+1" : "familial"}. Cliquez sur « {tab === "plus1" ? "Créer un pack +1" : "Créer un pack familial"} ».</td></tr>
            ) : viewPacks.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-3 py-3"><div className="flex items-center gap-2">{p.photo ? <img src={p.photo} alt={p.name} className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg bg-[#EA5800]/20 flex items-center justify-center text-sm font-bold text-[#EA5800]">{p.name?.charAt?.(0) || "P"}</div>}<span className="font-medium text-white">{p.name}</span>{(p.pack_type || "familial") === "plus1" ? <span className="px-1.5 py-0.5 rounded bg-[#EA5800]/15 text-[#EA5800] text-[10px] font-semibold">+1</span> : <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 text-[10px]">Familial</span>}</div></td>
                <td className="px-3 py-3 font-mono text-xs text-[#EA5800]">{p.price || 0} DH</td>
                <td className="px-3 py-3 text-white/60">{p.duration || "—"}</td>
                <td className="px-3 py-3 text-white/60">{p.max_beneficiaries || 3}</td>
                <td className="px-3 py-3 text-white/60">{(p.activities || []).map(actName).join(", ") || "—"}</td>
                <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-medium">{p.status || "Actif"}</span></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white" title="Modifier"><Settings2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(p.id)} className="p-1.5 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <PackCreator onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refresh(); }} />}
      {showCreatePlus1 && <PackCreator type="plus1" onClose={() => setShowCreatePlus1(false)} onCreated={() => { setShowCreatePlus1(false); refresh(); }} />}

      {editPack && (
        <ModalCard title={`Modifier le pack — ${editName}`} onClose={() => setEditPack(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Nom du pack" icon={Package} value={editName} onChange={v => setEditName(v as string)} placeholder="Ex: Pack familial" required />
              <InputField label="Prix (DH)" icon={DollarSign} type="number" value={editPrice} onChange={v => setEditPrice(Number(v) || 0)} placeholder="Ex: 499" min={0} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Durée" icon={Calendar} value={editDuration} onChange={v => setEditDuration(v)} options={[...(DURATIONS.includes(editDuration) ? [] : [{ value: editDuration, label: editDuration }]), ...DURATIONS.map(d => ({ value: d, label: d }))]} />
              {(editPack.pack_type || "familial") === "plus1" ? (
                <div>
                  <label className="block text-xs text-[#94A3B0] mb-1.5 font-medium">Bénéficiaires</label>
                  <div className="px-3 py-3 rounded-lg bg-white/5 text-sm text-white/70">1 (pack +1)</div>
                </div>
              ) : (
                <InputField label="Bénéficiaires max" icon={Users} type="number" value={editMaxB} onChange={v => setEditMaxB(Number(v) || 1)} placeholder="3" min={1} />
              )}
            </div>
            <SelectField label="Statut" icon={Package} value={editStatus} onChange={v => setEditStatus(v)} options={[{ value: "Actif", label: "Actif" }, { value: "Inactif", label: "Inactif" }]} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-[#EA5800]" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Activités incluses</h3>
              </div>
              <p className="text-[11px] text-white/40 mb-2">Cochez les activités disponibles pour ce pack dans « Créer un abonnement » → section 3. Laissez vide pour tout afficher.</p>
              {allActs.length === 0 ? (
                <p className="text-[11px] text-white/40 italic">Aucune activité disponible. Créez d'abord des activités dans « Programme & Encadrement ».</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-white/10 rounded divide-y divide-white/5">
                  {allActs.map(a => {
                    const checked = editActs.includes(a.id);
                    return (
                      <button key={a.id} type="button" onClick={() => toggleEditAct(a.id)} className="w-full text-left px-2 py-1.5 text-[12px] flex items-center justify-between hover:bg-white/5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-4 h-4 rounded border shrink-0 inline-flex items-center justify-center ${checked ? "bg-[#EA5800] border-[#EA5800]" : "border-white/25"}`}>{checked ? <span className="text-white text-[10px]">x</span> : null}</span>
                          <span className="font-medium truncate text-white/90">{a.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setEditPack(null)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
            <button onClick={saveEdit} className="px-4 py-2 text-sm rounded bg-[#EA5800] text-white font-medium">Enregistrer</button>
          </div>
        </ModalCard>
      )}
    </div>
  );
}