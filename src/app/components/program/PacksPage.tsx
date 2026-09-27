import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import PackCreator from "../erp/PackCreator";
import { loadAll, deletePack } from "../../services/programService";

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
  const [showCreate, setShowCreate] = useState(false);
  const refresh = () => loadAll().then(db => { setPacks(db.packs || []); try { const s = loadStore(); s.packs = db.packs || []; s.activities = db.activities || s.activities; localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {} }).catch(() => setPacks([]));
  useEffect(() => { refresh(); }, []);

  const del = (id: string) => { deletePack(id).then(() => refresh()); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-white">Packs & Tarifs</h1>
          <span className="px-2 py-0.5 rounded bg-white/5 text-white/40 text-xs font-mono">{packs.length}</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-[#EA5800] hover:bg-[#d94118] text-white"><Plus className="w-3.5 h-3.5" /> Créer un pack familial</button>
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
            {packs.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-white/20 text-sm">Aucun pack. Cliquez sur « Créer un pack familial ».</td></tr>
            ) : packs.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-3 py-3 font-medium text-white">{p.name}</td>
                <td className="px-3 py-3 font-mono text-xs text-[#EA5800]">{p.price || 0} DH</td>
                <td className="px-3 py-3 text-white/60">{p.duration || "—"}</td>
                <td className="px-3 py-3 text-white/60">{p.max_beneficiaries || 3}</td>
                <td className="px-3 py-3 text-white/60">{(p.activities || []).map(actName).join(", ") || "—"}</td>
                <td className="px-3 py-3"><span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-medium">{p.status || "Actif"}</span></td>
                <td className="px-3 py-3">
                  <button onClick={() => del(p.id)} className="p-1.5 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <PackCreator onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refresh(); }} />}
    </div>
  );
}