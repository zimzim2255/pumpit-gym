import { useState, useEffect } from "react";
import { Search, Shield, Plus, Calendar, CalendarX2, UserRound, Check } from "lucide-react";
import ModalCard from "../ui/ModalCard";
import { InputField, SelectField } from "../ui/FormField";
import { getAllInsurance, addInsurance } from "../../services/programService";

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";
async function memberList(): Promise<{ id: string; name: string; phone?: string }[]> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/member-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ type: "list" }),
    });
    if (res.ok) return ((await res.json()).members || []).map((m: any) => ({ id: m.id, name: m.name || "", phone: m.phone || "" }));
  } catch {}
  return [];
}
function todayYmd(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parseStart(days: number): string { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
// Stored dates are DD/MM/YYYY; compare in YYYY-MM-DD for correct ordering.
function normDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return s;
  return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}
export default function InsurancePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [search, setSearch] = useState("");
  const [dStart, setDStart] = useState("");
  const [dEnd, setDEnd] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const refresh = () => getAllInsurance().then(r => setRows(r?.insurance || [])).catch(() => {});
  useEffect(() => { refresh(); memberList().then(m => setMembers(m)); }, []);
  const filtered = rows.filter(r => {
    const nm = r.member?.toLowerCase() || "";
    if (search.trim() && !nm.includes(search.toLowerCase())) return false;
    if (dStart && r.start && normDate(r.start) < dStart) return false;
    if (dEnd && r.end && normDate(r.end) > dEnd) return false;
    return true;
  });
  const memberOptions = members.map(m => ({ value: m.id, label: `${m.name}${m.phone ? ` — ${m.phone}` : ""}` }));
  const submitAdd = () => {
    if (!memberId) { window.alert("Choisissez un adhérent"); return; }
    const s = start || todayYmd();
    const e = end || parseStart(365);
    addInsurance({ memberId, paidAmount: Number(amount) || 300, start: s, end: e })
      .then(() => { setShowAdd(false); setMemberId(""); setAmount(""); setStart(""); setEnd(""); refresh(); });
  };
return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Assurance des adhérents</h1>
          <p className="text-xs text-white/30 font-mono">{rows.length} assurance(s)</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#EA5800] text-white text-sm font-medium transition-all"><Plus className="w-3.5 h-3.5" /> Ajouter une assurance</button>
      </div>

      <div className="bg-[#0B0F17]/60 border border-white/5 rounded-lg">
        <div className="px-4 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom..." className="w-full pl-8 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
          </div>
          <label className="text-xs text-white/50 flex flex-col min-w-[150px]">
            <span className="mb-0.5">Date début &ge;</span>
            <input type="date" value={dStart} onChange={e => setDStart(e.target.value)} className="px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white" />
          </label>
          <label className="text-xs text-white/50 flex flex-col min-w-[150px]">
            <span className="mb-0.5">Date fin &le;</span>
            <input type="date" value={dEnd} onChange={e => setDEnd(e.target.value)} className="px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white" />
          </label>
          {(search || dStart || dEnd) && <button onClick={() => { setSearch(""); setDStart(""); setDEnd(""); }} className="text-xs text-[#EA5800] hover:underline">Réinitialiser</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/3">
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Adhérent</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Téléphone</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Montant (DH)</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Date début</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Date fin</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-white/20 text-sm">Aucune assurance trouvée.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id || r.memberId} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-[#EA5800]/20 flex items-center justify-center text-sm font-bold text-[#EA5800]">{(r.member || "?")?.charAt?.(0)?.toUpperCase?.() || "?"}</div><span className="font-medium text-white">{r.member || r.memberId}</span></div></td>
                  <td className="px-3 py-3 font-mono text-xs text-white/50">{r.phone || "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[#EA5800]">{r.amount || 0} DH</td>
                  <td className="px-3 py-3 text-white/70">{r.start || "—"}</td>
                  <td className="px-3 py-3 text-white/70">{r.end || "—"}</td>
                  <td className="px-3 py-3">{isActive(r) ? <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-medium">Active</span> : <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-medium">Expirée</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <ModalCard title="Ajouter une assurance" onClose={() => setShowAdd(false)} wide>
          <div className="space-y-4">
            <SelectField label="Adhérent" icon={UserRound} value={memberId} onChange={v => setMemberId(v as string)} options={memberOptions} placeholder="Choisir un adhérent..." />
            <InputField label="Montant (DH)" icon={Shield} value={amount} onChange={v => setAmount(v as string)} placeholder="Ex: 300" />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Date début (JJ/MM/AAAA)" icon={Calendar} value={start} onChange={v => setStart(v as string)} placeholder="Aujourd'hui" />
              <InputField label="Date fin (JJ/MM/AAAA)" icon={CalendarX2} value={end} onChange={v => setEnd(v as string)} placeholder="+365 jours" />
            </div>
            <p className="text-[11px] text-white/50">Laissez vide pour utiliser les dates par défaut (aujourd'hui → +365 jours).</p>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
            <button onClick={submitAdd} className="px-4 py-2 text-sm rounded bg-[#EA5800] text-white font-medium inline-flex items-center gap-2"><Check className="w-4 h-4" /> Enregistrer</button>
          </div>
        </ModalCard>
      )}
    </div>
  );
}
  const isActive = (r: any) => { const d = new Date(); const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return r.end && normDate(r.end) >= ymd; };