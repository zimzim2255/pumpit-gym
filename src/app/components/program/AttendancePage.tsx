import { useState, useEffect } from "react";
import { Search, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { getAttendance } from "../../services/programService";
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";
async function memberList(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/member-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ type: "list" }),
    });
    if (res.ok) return ((await res.json()).members || []).map((m: any) => ({ id: m.id, name: m.name || "" }));
  } catch {}
  return [];
}
export default function AttendancePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [searchMember, setSearchMember] = useState("");
  const [memberId, setMemberId] = useState("");
  const [trainer, setTrainer] = useState("");
  const [loading, setLoading] = useState(false);
  const load = (mId = memberId, tr = trainer) => {
    setLoading(true);
    getAttendance({ memberId: mId || undefined, trainerId: tr || undefined })
      .then(r => { setRows(r?.attendance || []); setTotals(r?.totals || []); })
      .catch(() => { setRows([]); setTotals([]); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const trainerList = [...new Set(rows.map(r => r.trainer).filter(Boolean))].sort();
  const memberFiltered = members.filter(m => !searchMember || m.name.toLowerCase().includes(searchMember.toLowerCase()));
  const filtered = rows.filter(r => (!memberId || r.memberId === memberId) && (!trainer || r.trainer === trainer));
  const presentRows = filtered.filter(r => r.status === "Présent");
  const absentRows = filtered.filter(r => r.status === "Absent");
  const presentDays = presentRows.length, absentDays = absentRows.length, totalDays = filtered.length;
  const commissionTotal = presentRows.reduce((s, r) => s + Number(r.pay || 0), 0);
  const summary = (label: string, value: string, sub: string, cls: string) => (
    <div className={`rounded-lg border border-white/5 p-3 ${cls}`}>
      <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-white/40">{sub}</div>
    </div>
  );
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Suivi présence & commissions</h1>
          <p className="text-xs text-white/30 font-mono">Présence par entraîneur depuis les accès à la porte</p>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#EA5800] text-white text-sm font-medium" disabled={loading}><RefreshCw className="w-3.5 h-3.5" /> Actualiser</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary("Jours prévus", String(totalDays), "au total", "bg-white/5")}
        {summary("Présent", String(presentDays), "entrées autorisées", "bg-emerald-500/10")}
        {summary("Absent", String(absentDays), "sans passage au doigt", "bg-red-500/10")}
        {summary("Commission entraîneurs", `${commissionTotal.toLocaleString()} DH`, "Payée seulement les jours présents", "bg-[#EA5800]/10")}
      </div>
      <div className="bg-[#0B0F17]/60 border border-white/5 rounded-lg">
        <div className="px-4 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input value={searchMember} onChange={e => setSearchMember(e.target.value)} placeholder="Filtrer par adhérent..." className="w-full pl-8 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40" />
          </div>
          <select value={memberId} onChange={e => { const v = e.target.value; setMemberId(v); load(v, trainer); }} className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/70 min-w-[180px]">
            <option value="">Tous les adhérents</option>
            {memberFiltered.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={trainer} onChange={e => { const v = e.target.value; setTrainer(v); load(memberId, v); }} className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/70 min-w-[180px]">
            <option value="">Tous les entraîneurs</option>
            {trainerList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(memberId || trainer) && <button onClick={() => { setMemberId(""); setTrainer(""); load("", ""); }} className="text-xs text-[#EA5800] hover:underline">Réinitialiser</button>}
        </div>
        {trainer && (
          <div className="px-4 py-2 border-b border-white/5 text-sm text-white/70">
            <span className="text-white/40">Commission {trainer}: </span>
            <span className="font-mono font-bold text-emerald-400">{presentRows.filter(r => r.trainer === trainer).reduce((s, r) => s + Number(r.pay || 0), 0).toLocaleString()} DH</span>
            <span className="text-white/40">  •  {presentRows.filter(r => r.trainer === trainer).length} jour(s) présent / {absentRows.filter(r => r.trainer === trainer).length} absent(s)</span>
          </div>
        )}
<div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/3">
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Adhérent</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Jour</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Cours</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Horaire</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Entraîneur</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Commission</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-white/30 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-white/20 text-sm">{loading ? "Chargement..." : "Aucune donnée. Aucun abonnement avec cours assigné."}</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={`${r.memberId}-${r.date}-${i}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-[#EA5800]/20 flex items-center justify-center text-sm font-bold text-[#EA5800]">{(r.member || "?")?.charAt?.(0)?.toUpperCase?.() || "?"}</div><span className="font-medium text-white">{r.member}</span></div></td>
                  <td className="px-3 py-3 font-mono text-xs text-white/70">{r.dateDisp}</td>
                  <td className="px-3 py-3 text-white/70">{r.day}</td>
                  <td className="px-3 py-3 text-white/80">{r.cours}</td>
                  <td className="px-3 py-3 font-mono text-xs text-white/60">{r.start_time}–{r.end_time}</td>
                  <td className="px-3 py-3 text-white/80">{r.trainer}</td>
                  <td className="px-3 py-3 font-mono text-xs text-white/60">{r.pay ? `${r.pay} DH` : "—"}</td>
                  <td className="px-3 py-3">{r.status === "Présent"
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Présent</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-medium"><XCircle className="w-3 h-3" /> Absent</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}