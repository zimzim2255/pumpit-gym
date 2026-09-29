import { useState, useEffect } from "react";
import { Plus, Trash2, Settings2 } from "lucide-react";
import PackCreator from "../erp/PackCreator";
import { loadAll, deletePack, updatePack } from "../../services/programService";
import ModalCard from "../ui/ModalCard";

const STORE_KEY = "gym_programme_data";
function loadStore(): any {
  try { const r = localStorage.getItem(STORE_KEY); if (r) return JSON.parse(r); } catch {}
  return { activities: [], groups: [], trainers: [], cours: [], packs: [] };
}
function actName(id: string): string {
  return loadStore().activities.find((a: any) => a.id === id)?.name || id;
}

export default function PacksPage() {
  const [packs, setPacks] = useState<any[]>([]);
  const [tab, setTab] = useState<"familial" | "plus1">("familial");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePlus1, setShowCreatePlus1] = useState(false);
  const [editPack, setEditPack] = useState<any>(null);
  const [editActs, setEditActs] = useState<string[]>([]);
  const allActs = (loadStore().activities || []) as any[];
  const isPlus1 = (p: any) => (p.pack_type || "familial") === "plus1";
  const viewPacks = packs.filter(p => (tab === "plus1") === isPlus1(p));
  const countFamilial = packs.filter(p => !isPlus1(p)).length;
  const countPlus1 = packs.filter(p => isPlus1(p)).length;
  const refresh = () => loadAll().then(db => { setPacks(db.packs || []); try { const s = loadStore(); s.packs = db.packs || []; s.activities = db.activities || s.activities; localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {} }).catch(() => setPacks([]));
  useEffect(() => { refresh(); }, []);

  const del = (id: string) => { deletePack(id).then(() => refresh()); };
  const openEdit = (p: any) => { setEditPack(p); setEditActs((p.activities || []).slice()); };
  const toggleEditAct = (id: string) => setEditActs(editActs.includes(id) ? editActs.filter(x => x !== id) : [...editActs, id]);
  const saveEdit = () => {
    if (!editPack) return;
    updatePack({
      id: editPack.id, name: editPack.name, price: editPack.price, status: editPack.status,
      photo: editPack.photo, max_beneficiaries: editPack.max_beneficiaries, duration: editPack.duration,
      activities: editActs,
    }).then(() => {
      try { const s = loadStore(); s.packs = (s.packs || []).map((x: any) => x.id === editPack.id ? { ...x, activities: editActs } : x); localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
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
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white" title="Injecter des activités"><Settings2 className="w-3.5 h-3.5" /></button>
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
        <ModalCard title={`Injecter des activités — ${editPack.name}`} onClose={() => setEditPack(null)} wide>
          <div className="space-y-4">
            <p className="text-[11px] text-white/50">Seules ces activités s'afficheront dans « Créer un abonnement » → section 3 pour ce pack. Laissez vide pour tout afficher.</p>
            {allActs.length === 0 ? (
              <p className="text-[11px] text-white/40 italic">Aucune activité disponible. Créez d'abord des activités dans « Programme & Encadrement ».</p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-white/10 rounded divide-y divide-white/5">
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
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setEditPack(null)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
            <button onClick={saveEdit} className="px-4 py-2 text-sm rounded bg-[#EA5800] text-white font-medium">Enregistrer</button>
          </div>
        </ModalCard>
      )}
    </div>
  );
}