import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Eye, X, Check, FolderPlus, Search, ChevronLeft, ChevronRight, Clock, User, Phone, DollarSign, Percent, Dumbbell, Users, UserRound, Calendar, Package } from "lucide-react";
import ModalCard from "../ui/ModalCard";
import { loadAll, createActivity, createGroup, createCours, updateCours, deleteCours } from "../../services/programService";

const STORE_KEY = "gym_programme_data";
type Row = { id: string; [k: string]: any };
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DURATIONS = ["1 mois", "3 mois", "6 mois", "12 mois"];
const DAY_ORDER: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };
const PAGE = 50;

function emptyStore(): any { return { activities: [], groups: [], trainers: [], cours: [], packs: [] }; }
function loadStore(): any { try { const r = localStorage.getItem(STORE_KEY); if (r) return JSON.parse(r); } catch {} return emptyStore(); }

function displayRows(store: any): Row[] {
  return store.cours.map((c: any) => {
    const act = store.activities.find((a: any) => a.id === c.activity_id);
    return {
      id: c.id,
      type: act?.type || act?.name || "—",
      activite: act?.name || "—",
      groupe: store.groups.find((g: any) => g.id === c.group_id)?.name || c.name || "—",
      jour: c.day || "—",
      horaire: `${c.start_time}–${c.end_time}`,
      coach: store.trainers.find((t: any) => t.id === c.trainer_id)?.name || "—",
      ...c,
    };
  });
}
function byName(arr: any[]): any[] { return [...arr].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))); }
export default function ProgrammeManager() {
  useEffect(() => { loadAll().then(db => { setStore(db); try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {} }).catch(() => {}); }, []);
  const reload = () => loadAll().then(db => {
    setStore(db);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {}
  }).catch(() => {});

  const [store, setStore] = useState<any>(loadStore);
  const [view, setView] = useState<"groupes" | "liste">("groupes");
  const [fAct, setFAct] = useState("");
  const [fGroupe, setFGroupe] = useState("");
  const [fInstr, setFInstr] = useState("");
  const [fJour, setFJour] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selRow, setSelRow] = useState<Row | null>(null);
  const [showDetail, setShowDetail] = useState<Row | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [confirmDel, setConfirmDel] = useState<Row | null>(null);
  const [showGroup, setShowGroup] = useState(false);
  const [gName, setGName] = useState("");
  const [gItems, setGItems] = useState<string[]>([""]);
  const [showAct, setShowAct] = useState(false);
  const [actType, setActType] = useState("");
  const [actActivity, setActActivity] = useState("");
  const [actGroup, setActGroup] = useState("");
  const [slots, setSlots] = useState<{ day: string; start: string; end: string; trainer: string }[]>([{ day: "Lundi", start: "09:00", end: "10:00", trainer: "" }]);

  const save = (next: any) => { localStorage.setItem(STORE_KEY, JSON.stringify(next)); setStore(next); }; // eslint-disable-line

  const submitGroup = () => {
    if (!gName.trim()) return;
    const items = gItems.map(s => s.trim()).filter(Boolean);
    createActivity({ name: gName.trim(), price: 0 }).then(act => {
      const aid = act?.activity?.id;
      return Promise.all(items.map(s => createGroup({ name: s, activityId: aid })));
    }).then(() => reload()).catch(() => { setShowGroup(false); setGName(""); setGItems([""]); });
    setShowGroup(false); setGName(""); setGItems([""]);
  };
  const addGItem = () => setGItems([...gItems, ""]);
  const updGItem = (i: number, v: string) => setGItems(gItems.map((s, j) => j === i ? v : s));
  const delGItem = (i: number) => setGItems(gItems.filter((_, j) => j !== i));

  const submitAct = () => {
    if (!actGroup.trim() && !actType.trim()) return;
    const aid = store.activities.find((a: any) => a.name === actActivity)?.id || null;
    const gid = store.groups.find((g: any) => g.activity_id === aid && g.name === actGroup)?.id || null;
    const valid = slots.filter(s => s.day && s.start && s.end);
    if (!valid.length) return;
    Promise.all(valid.map(s => createCours({
      activityId: aid !== null ? aid : undefined, groupId: gid !== null ? gid : undefined,
      trainerId: s.trainer || null, name: actGroup.trim() || actType.trim(), day: s.day,
      startTime: s.start, endTime: s.end,
    }))).then(() => reload()).catch(() => {});
    setShowAct(false); setActType(""); setActActivity(""); setActGroup(""); setSlots([{ day: "Lundi", start: "09:00", end: "10:00", trainer: "" }]);
  };
  const updSlot = (i: number, k: string, v: string) => setSlots(slots.map((s, j) => j === i ? { ...s, [k]: v } : s));
  const addSlot = () => setSlots([...slots, { day: "Lundi", start: "09:00", end: "10:00", trainer: "" }]);
  const delSlot = (i: number) => setSlots(slots.filter((_, j) => j !== i));
const saveEdit = () => {
    if (!editRow) return;
    const clean = {
      id: editRow.id, name: editRow.name || "", day: editRow.day || "Lundi",
      start_time: editRow.start_time || "09:00", end_time: editRow.end_time || "10:00",
      room: editRow.room || "", trainer_id: editRow.trainer_id || null,
      activity_id: editRow.activity_id || null, group_id: editRow.group_id || null,
    };
    updateCours({ id: editRow.id, name: clean.name, day: clean.day, startTime: clean.start_time, endTime: clean.end_time, room: clean.room, trainerId: clean.trainer_id, activityId: clean.activity_id, groupId: clean.group_id }).then(() => reload()).catch(() => {});
    setEditRow(null);
  };
  const doDelete = () => { if (confirmDel) deleteCours(confirmDel.id).then(() => reload()).catch(() => {}); setConfirmDel(null); };

  const all = displayRows(store).sort((a, b) => ((DAY_ORDER[a.jour] || 9) - (DAY_ORDER[b.jour] || 9)) || String(a.activite).localeCompare(String(b.activite)));
  const filtered = all.filter(r =>
    (!fAct || r.activity_id === fAct) &&
    (!fGroupe || r.groupe === fGroupe) &&
    (!fInstr || r.trainer_id === fInstr) &&
    (!fJour || r.jour === fJour)
  );
  const searched = (view === "liste" && search.trim())
    ? filtered.filter(r => [r.activite, r.groupe, r.jour, r.coach, r.name].join(" ").toLowerCase().includes(search.toLowerCase()))
    : filtered;
  const pageCount = Math.max(1, Math.ceil(searched.length / PAGE));
  const curPage = Math.min(page, pageCount);
  const pageRows = searched.slice((curPage - 1) * PAGE, curPage * PAGE);
  const groupeOptions = [...new Set(all.map(r => r.groupe))].sort();

  const goPage = (p: number) => { if (p >= 1 && p <= pageCount) { setPage(p); } };
  const resetFilters = () => { setFAct(""); setFGroupe(""); setFInstr(""); setFJour(""); setPage(1); };
  const th = (label: string, cls?: string) => <th className={`px-3 py-2.5 text-xs text-white/40 text-left font-medium ${cls || ""}`}>{label}</th>;
  const renderActions = (r: Row) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setShowDetail(r)} title="Voir" className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white"><Eye className="w-3.5 h-3.5" /></button>
      <button onClick={() => setEditRow(r)} title="Modifier" className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
      <button onClick={() => setConfirmDel(r)} title="Supprimer" className="p-1.5 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
  const pageBar = () => (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
      <p className="text-xs text-white/40">Affichage {(curPage - 1) * PAGE + 1}–{Math.min(curPage * PAGE, searched.length)} sur {searched.length}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => goPage(curPage - 1)} className="p-1.5 rounded text-white/50 hover:bg-white/10"><ChevronLeft className="w-3.5 h-3.5" /></button>
        {Array.from({ length: Math.min(5, pageCount) }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => goPage(n)} className={`min-w-7 h-7 px-1.5 text-xs font-medium rounded border ${curPage === n ? "bg-[#EA5800] text-white border-[#EA5800]" : "bg-white/5 text-white/60 border-white/10 hover:border-[#EA5800]/40"}`}>{n}</button>
        ))}
        <button onClick={() => goPage(curPage + 1)} className="p-1.5 rounded text-white/50 hover:bg-white/10"><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
const rowsHead = (hasNum: boolean) => (
    <tr className="border-b border-white/5 bg-white/3">
      {hasNum && th("#", "w-10")}
      {th("Activité")}{th("Groupe")}{th("Jour")}{th("Horaire prévue")}{th("Instructeur")}
      <th className="px-3 py-2.5 text-xs text-white/40 text-left w-24">Actions</th>
    </tr>
  );
  const rowsBody = (rows: Row[], hasNum: boolean) =>
    rows.length === 0 ? (
      <tr><td colSpan={(hasNum ? 1 : 0) + 6} className="px-3 py-10 text-center text-white/30 text-sm">Aucun horaire trouvé.</td></tr>
    ) : rows.map((r, i) => (
      <tr key={r.id} onClick={() => setSelRow(r)} className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${selRow?.id === r.id ? "bg-[#EA5800]/10" : ""}`}>
        {hasNum && <td className="px-3 py-3 text-xs text-white/40 font-mono">{(curPage - 1) * PAGE + i + 1}</td>}
        <td className="px-3 py-3 font-medium text-white">{r.activite}</td>
        <td className="px-3 py-3 text-white/70">{r.groupe}</td>
        <td className="px-3 py-3 text-white/70">{r.jour}</td>
        <td className="px-3 py-3 font-mono text-white/60">{r.start_time}<span className="text-white/30 mx-1">→</span>{r.end_time}</td>
        <td className="px-3 py-3 text-white/70">{r.coach}</td>
        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>{renderActions(r)}</td>
      </tr>
    ));

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <div className="flex items-center gap-1.5 rounded-lg bg-white/5 p-0.5">
          {(["groupes", "liste"] as const).map(v => (
            <button key={v} onClick={() => { setView(v); setPage(1); }} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === v ? "bg-[#EA5800] text-white" : "text-white/60 hover:bg-white/10"}`}>{v === "groupes" ? "Groupes" : "Liste"}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => { setShowGroup(true); setGName(""); setGItems([""]); }} className="px-3 py-2 rounded-lg text-sm font-medium border border-[#475569] text-white/80 hover:bg-white/5 inline-flex items-center gap-2"><FolderPlus className="w-4 h-4" /> Créer une activité / groupe</button>
        <button onClick={() => setShowAct(true)} className="px-3 py-2 rounded-lg text-sm font-medium bg-[#EA5800] text-white inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Créer un horaires</button>
      </div>
{view === "groupes" && (
      <div className="bg-card border border-white/5 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/3">
              <th className="px-3 py-2.5 text-xs text-white/40 text-left font-medium">Nom du activité</th>
              <th className="px-3 py-2.5 text-xs text-white/40 text-left font-medium">Groupe</th>
              <th className="px-3 py-2.5 text-xs text-white/40 text-left w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const acts = byName(store.activities);
              if (acts.length === 0) {
                return <tr><td colSpan={3} className="px-3 py-10 text-center text-white/30 text-sm">Aucune activité. Cliquez sur « Créer une activité / groupe ».</td></tr>;
              }
              const list: any[] = [];
              for (const a of acts) {
                const grps = store.groups.filter((g: any) => g.activity_id === a.id);
                if (grps.length === 0) {
                  list.push((<tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-3 py-3 font-medium text-white">{a.name}</td>
                    <td className="px-3 py-3 text-white/50 italic">Aucun groupe</td>
                    <td className="px-3 py-3"></td>
                  </tr>));
                } else {
                  grps.forEach((g: any, gi: number) => {
                    list.push((<tr key={`${a.id}-${g.id || gi}`} className="border-b border-white/5 hover:bg-white/5">
                      {gi === 0 && <td className="px-3 py-3 font-medium text-white" rowSpan={grps.length}>{a.name}</td>}
                      <td className="px-3 py-3 text-white/80">{g.name}</td>
                      <td className="px-3 py-3"></td>
                    </tr>));
                  });
                }
              }
              return list;
            })()}
          </tbody>
        </table>
      </div>
      )}
{view === "liste" && (
      <div className="bg-card border border-white/5 rounded-lg">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher par type, activité, groupe, jour..." className="w-full pl-8 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/3">
                <th className="px-3 py-2.5 text-xs text-white/40 text-left font-medium">Type d'activité</th>
                <th className="px-3 py-2.5 text-xs text-white/40 text-left font-medium">Activité</th>
                <th className="px-3 py-2.5 text-xs text-white/40 text-left font-medium">Groupe</th>
                <th className="px-3 py-2.5 text-xs text-white/40 text-left font-medium">Jours & Horaires</th>
                <th className="px-3 py-2.5 text-xs text-white/40 text-left font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-white/30 text-sm">Aucun horaire trouvé.</td></tr>
              ) : pageRows.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer">
                  <td className="px-3 py-3 text-white/80">{r.type}</td>
                  <td className="px-3 py-3 font-medium text-white">{r.activite}</td>
                  <td className="px-3 py-3 text-white/70">{r.groupe}</td>
                  <td className="px-3 py-3 font-mono text-white/60">{r.jour} <span className="text-white/30 mx-1">→</span> {r.start_time}–{r.end_time}</td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>{renderActions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageBar()}
      </div>
      )}
{showGroup && (
        <ModalCard title="Créer un Groupe" onClose={() => setShowGroup(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Nom du activité <span className="text-[#EA5800]">*</span></label>
              <input value={gName} onChange={e => setGName(e.target.value)} placeholder="Ex: Sports collectifs, Gymnastique..." className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/60 uppercase tracking-wide">Groupe</p>
                <button onClick={addGItem} className="px-2 py-1 text-xs rounded text-white/70 hover:bg-white/10 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</button>
              </div>
              <div className="border border-white/10 rounded overflow-hidden">
                {gItems.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <input value={it} onChange={e => updGItem(i, e.target.value)} placeholder="Ex: Football U8, Baby Gym..." className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
                    {gItems.length > 1 && <button onClick={() => delGItem(i)} className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setShowGroup(false)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
            <button onClick={submitGroup} className="px-4 py-2 text-sm rounded bg-[#EA5800] text-white font-medium inline-flex items-center gap-2"><Check className="w-4 h-4" /> Créer le groupe</button>
          </div>
        </ModalCard>
      )}
{showAct && (
        <ModalCard title="Créer une Activité" onClose={() => setShowAct(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Type d'activité <span className="text-[#EA5800]">*</span></label>
                <input value={actType} onChange={e => setActType(e.target.value)} placeholder="Ex: Football, Danse, Judo..." className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Activité <span className="text-[#EA5800]">*</span></label>
                <select value={actActivity} onChange={e => setActActivity(e.target.value)} className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/60 focus:outline-none focus:border-[#EA5800]">
                  <option value="">Sélectionner un groupe...</option>
                  {byName(store.activities).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Groupe <span className="text-[#EA5800]">*</span></label>
              <input value={actGroup} onChange={e => setActGroup(e.target.value)} placeholder="Ex: Football U8" className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/60 uppercase tracking-wide">Jours & Horaires</p>
                <button onClick={addSlot} className="px-2 py-1 text-xs rounded text-white/70 hover:bg-white/10 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter un créneau</button>
              </div>
              <div className="border border-white/10 rounded overflow-hidden">
                {slots.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/5">
                    <select value={s.trainer} onChange={e => updSlot(i, "trainer", e.target.value)} className="px-2 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/60 focus:outline-none">
                      <option value="">Coach...</option>
                      {byName(store.trainers).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={s.day} onChange={e => updSlot(i, "day", e.target.value)} className="px-2 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/60 focus:outline-none">
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="time" value={s.start} onChange={e => updSlot(i, "start", e.target.value)} className="px-2 py-2 text-sm bg-white/5 border border-white/10 rounded text-white" />
                    <span className="text-white/40 text-sm">→</span>
                    <input type="time" value={s.end} onChange={e => updSlot(i, "end", e.target.value)} className="px-2 py-2 text-sm bg-white/5 border border-white/10 rounded text-white" />
                    {slots.length > 1 && <button onClick={() => delSlot(i)} className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setShowAct(false)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
            <button onClick={submitAct} className="px-4 py-2 text-sm rounded bg-[#EA5800] text-white font-medium inline-flex items-center gap-2"><Check className="w-4 h-4" /> Créer un horaires</button>
          </div>
        </ModalCard>
      )}
{editRow && (
        <ModalCard title="Modifier le cours" onClose={() => setEditRow(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Cours</label>
                <input value={editRow.name || ""} onChange={e => setEditRow({ ...editRow, name: e.target.value })} className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:border-[#EA5800]" />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Jour</label>
                <select value={editRow.day || "Lundi"} onChange={e => setEditRow({ ...editRow, day: e.target.value })} className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/60">
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="time" value={editRow.start_time || "09:00"} onChange={e => setEditRow({ ...editRow, start_time: e.target.value })} className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white" />
              <input type="time" value={editRow.end_time || "10:00"} onChange={e => setEditRow({ ...editRow, end_time: e.target.value })} className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Activité</label>
                <select value={editRow.activity_id || ""} onChange={e => setEditRow({ ...editRow, activity_id: e.target.value })} className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/60">
                  <option value="">—</option>
                  {byName(store.activities).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wide">Entraîneur</label>
                <select value={editRow.trainer_id || ""} onChange={e => setEditRow({ ...editRow, trainer_id: e.target.value })} className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/60">
                  <option value="">—</option>
                  {byName(store.trainers).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setEditRow(null)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
            <button onClick={saveEdit} className="px-4 py-2 text-sm rounded bg-[#EA5800] text-white font-medium">Enregistrer</button>
          </div>
        </ModalCard>
      )}
{showDetail && (
        <ModalCard title="Détails du cours" onClose={() => setShowDetail(null)}>
          <div className="space-y-2.5">
            {[["Activité", showDetail.activite], ["Groupe", showDetail.groupe], ["Jour", showDetail.jour], ["Horaire", showDetail.horaire], ["Instructeur", showDetail.coach]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between"><span className="text-xs text-white/50">{k}</span><span className="text-sm text-white">{v}</span></div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Fermer</button>
          </div>
        </ModalCard>
      )}

      {confirmDel && (
        <ModalCard title="Confirmer la suppression" onClose={() => setConfirmDel(null)}>
          <p className="text-sm text-white/70 mb-4">Supprimer « {confirmDel.activite} — {confirmDel.groupe} » ? Cette action est définitive.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm rounded bg-white/5 text-white/70">Annuler</button>
            <button onClick={doDelete} className="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium">Supprimer</button>
          </div>
        </ModalCard>
      )}
    </div>
  );
}