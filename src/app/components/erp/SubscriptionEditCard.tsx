import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { Search, User, Phone, CreditCard, DollarSign, Calendar, Users, Plus } from "lucide-react";
import ModalCard from "../ui/ModalCard";
import { InputField, SelectField, FormActions } from "../ui/FormField";
import { loadAll, getAllInsurance } from "../../services/programService";
import { SubType } from "../../services/subscriptionService";
type SubscriptionForm = {
  id: string; member: string; phone: string; type: string; start: string;
  end: string; price: number; paid: number; remaining: number;
  status: string; payment: string; observation: string;
  activity: string; group: string; cours: string; trainer: string;
  packId: string; insurance: boolean; insuranceShown: string;
  remise: number;
  remiseType: string;
  mode: string; memberIds: string[]; packMemberIds: string[]; activityIds: string[]; groupIds: string[]; coursIds: string[];
  packCourses: Record<string, { activityIds: string[]; groupIds: string[]; coursIds: string[] }>;
};type Prog = { activities: any[]; groups: any[]; cours: any[]; trainers: any[]; packs: any[] };
function loadProg(): Prog {
  try { const r = localStorage.getItem("gym_programme_data"); if (r) return JSON.parse(r); } catch {}
  return { activities: [], groups: [], cours: [], trainers: [], packs: [] };
}
function loadInsurance(): Record<string, any> {
  try { const r = localStorage.getItem("gym_insurance"); if (r) return JSON.parse(r); } catch {}
  return {};
}
// Normalize "DD/MM/YYYY" or "YYYY-MM-DD" to "YYYY-MM-DD" for comparison.
function normDate(s?: string): string {
  if (!s) return "";
  const t = s.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const p = t.split("/");
  if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
  return t;
}
function todayYmd(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
interface SubscriptionEditCardProps {
  form: SubscriptionForm; setForm: Dispatch<SetStateAction<SubscriptionForm>>;
  onClose: () => void; onSave: () => void; members: string[]; subTypes: SubType[];
  updateType: (t: string) => void; updateStart: (v: string) => void; updatePaid: (v: number) => void;
}
export default function SubscriptionEditCard({ form, setForm, onClose, onSave, members, subTypes, updateType, updateStart, updatePaid }: SubscriptionEditCardProps) {
  const [prog, setProg] = useState<Prog>(loadProg);
  const [insByName, setInsByName] = useState<Record<string, { amount: number; end: string }>>({});
  useEffect(() => {
    loadAll().then(db => {
      setProg(db);
      try {
        const prev = loadProg();
        const merged = {
          activities: db.activities, groups: db.groups, cours: db.cours,
          trainers: db.trainers, packs: db.packs,
        };
        if (prev.activities?.length) merged.activities = [...new Map([...prev.activities, ...db.activities].map(a => [a.id, a])).values()];
        if (prev.groups?.length) merged.groups = [...new Map([...prev.groups, ...db.groups].map(g => [g.id, g])).values()];
        if (prev.cours?.length) merged.cours = [...new Map([...prev.cours, ...db.cours].map(c => [c.id, c])).values()];
        if (prev.trainers?.length) merged.trainers = [...new Map([...prev.trainers, ...db.trainers].map(t => [t.id, t])).values()];
        if (prev.packs?.length) merged.packs = [...new Map([...prev.packs, ...db.packs].map(p => [p.id, p])).values()];
        localStorage.setItem("gym_programme_data", JSON.stringify(merged));
      } catch { /* keep current prog */ }
    }).catch(() => {});
    getAllInsurance().then(r => {
      const map: Record<string, { amount: number; end: string }> = {};
      (r?.insurance || []).forEach((row: any) => {
        if (row?.member) {
          const end = (row.end || "").toString();
          const prev = map[row.member];
          if (!prev || normDate(end) >= normDate(prev.end)) {
            map[row.member] = { amount: Number(row.amount) || 300, end };
          }
        }
      });
      setInsByName(map);
    }).catch(() => {});
  }, []);
  const activities = prog.activities as any[];
  const groups = prog.groups as any[];
  const cours = prog.cours as any[];
  const trainers = prog.trainers as any[];
  const packs = prog.packs as any[];
  const mode = (form.mode || "nouvel") as string;
  const memberIds = (form.memberIds || []) as string[];
  const packId = (form.packId || "") as string;
  const packMemberIds = (form.packMemberIds || []) as string[];
  const actIds = (form.activityIds || []) as string[];
  const grpIds = (form.groupIds || []) as string[];
  const crsIds = (form.coursIds || []) as string[];
  const pack = packs.find(p => p.id === packId);
  const insStore = loadInsurance();
  const selectedPersons = memberIds.concat(packMemberIds).filter((v, i, a) => a.indexOf(v) === i);
  const assurance = selectedPersons.reduce((sum, name) => {
    const dbVal = Number(insByName[name]?.amount || 0);
    const localVal = Number((insStore as any)[name]?.premium || 0);
    return sum + (dbVal || localVal || 300);
  }, 0);
  // Assurance is NOT part of the abonnement total. It's shown separately so we
  // can see whether each selected member's insurance is still valid or needs renewal.
  const assuranceActive = selectedPersons.length > 0 && selectedPersons.every(name => {
    const end = insByName[name]?.end || (insStore as any)[name]?.end || "";
    return !!end && normDate(end) >= todayYmd();
  });
  const priceBase = form.price || 0;
  const remiseRaw = Math.max(0, Number(form.remise) || 0);
  const remise = (form.remiseType || "dh") === "percent"
    ? Math.min(priceBase, (priceBase * remiseRaw) / 100)
    : Math.min(priceBase, remiseRaw);
  const total = priceBase - remise;  const [sMember, setSMember] = useState("");
  const [sAct, setSAct] = useState("");
  const [sGrp, setSGrp] = useState("");
  const [sCr, setSCr] = useState("");
  const [sPackBenef, setSPackBenef] = useState("");
  const bubble = (patch: any) => setForm({ ...form, ...patch });
  const toggleMember = (name: string) => {
    const next = memberIds.includes(name) ? [] : [name];
    bubble({ memberIds: next, member: next.join(", ") });
  };
  const toggle = (arr: string[], id: string, key: string, joinKey: string, nameOf: (i: string) => string) => {
    const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
    bubble({ [key]: next, [joinKey]: next.map(nameOf).join(", ") });
  };
  const actName = (i: string) => activities.find(a => a.id === i)?.name || i;
  const grpName = (i: string) => groups.find(g => g.id === i)?.name || i;
  const crName = (i: string) => cours.find(c => c.id === i)?.name || i;
  const toggleAct = (id: string) => toggle(actIds, id, "activityIds", "activity", actName);
  const toggleGrp = (id: string) => toggle(grpIds, id, "groupIds", "group", grpName);
  const toggleCr = (id: string) => toggle(crsIds, id, "coursIds", "cours", crName);
  const toggleBeneficiary = (name: string) => {
    const maxB = pack ? (pack.max_beneficiaries || 3) : 3;
    const next = packMemberIds.includes(name) ? packMemberIds.filter(x => x !== name) : (packMemberIds.length < maxB ? [...packMemberIds, name] : packMemberIds);
    bubble({ packMemberIds: next });
  };
  const maxB = pack ? (pack.max_beneficiaries || 3) : 3;
  const packCourses: Record<string, { activityIds: string[]; groupIds: string[]; coursIds: string[] }> = form.packCourses || {};
  const packSel = (name: string) => packCourses[name] || { activityIds: [], groupIds: [], coursIds: [] };
  const setPackSel = (name: string, key: string, value: string[]) => bubble({ packCourses: { ...packCourses, [name]: { ...packSel(name), [key]: value } } });
  const togglePackAct = (name: string, id: string) => { const s = packSel(name); const next = s.activityIds.includes(id) ? s.activityIds.filter(x => x !== id) : [...s.activityIds, id]; setPackSel(name, "activityIds", next); };
  const togglePackGrp = (name: string, id: string) => { const s = packSel(name); const next = s.groupIds.includes(id) ? s.groupIds.filter(x => x !== id) : [...s.groupIds, id]; setPackSel(name, "groupIds", next); };
  const togglePackCr = (name: string, id: string) => { const s = packSel(name); const next = s.coursIds.includes(id) ? s.coursIds.filter(x => x !== id) : [...s.coursIds, id]; setPackSel(name, "coursIds", next); };
  // A pack may carry injected activities ("pack.activities"): when a pack is chosen,
  // restrict section 3 to only show those activities (and their groups / cours).
  const packActIds = (((pack?.activities || []) as string[]).map(String)).filter(Boolean);
  const packRestrict = !!pack && packActIds.length > 0;
  const visibleActs = packRestrict ? activities.filter(a => packActIds.includes(a.id)) : activities;
  const visibleActIds = visibleActs.map(a => a.id);
  const filteredActs = visibleActs.filter(a => !sAct || a.name.toLowerCase().includes(sAct.toLowerCase()));
  const selGroups = groups.filter(g => visibleActIds.includes(g.activity_id || "") && actIds.includes(g.activity_id || ""));
  const filteredGrps = selGroups.filter(g => !sGrp || g.name.toLowerCase().includes(sGrp.toLowerCase()));
  const selCours = cours.filter(c => {
    const g = c.group_id ? groups.find(x => x.id === c.group_id) : null;
    const visible = visibleActIds.includes(c.activity_id || "") || (g && visibleActIds.includes(g.activity_id || ""));
    return visible && ((c.group_id && grpIds.includes(c.group_id)) || (c.activity_id && actIds.includes(c.activity_id)));
  });
  const filteredCrs = selCours.filter(c => !sCr || (c.name || c.day || "").toLowerCase().includes(sCr.toLowerCase()));
  const coachName = (id: string) => trainers.find(t => t.id === id)?.name || "---";
  const coachPct = (id: string) => { const t = trainers.find(x => x.id === id); return t ? `${t.commission_percent || 0}%` : "---"; };
  const actCount = (id: string) => cours.filter(c => c.activity_id === id).length;
  const grpCount = (id: string) => cours.filter(c => c.group_id === id).length;
  const checkbox = (checked: boolean, onToggle: () => void, label: string, count: string, k?: string) => (
    <button key={k || label} onClick={onToggle} className="w-full text-left px-2 py-1.5 text-[12px] flex items-center justify-between hover:bg-white/5">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-4 h-4 rounded border shrink-0 inline-flex items-center justify-center ${checked ? "bg-[#EA5800] border-[#EA5800]" : "border-white/25"}`}>{checked ? <span className="text-white text-[10px]">x</span> : null}</span>
        <span className="font-medium truncate text-white/90">{label}</span>
      </div>
      {count ? <span className="text-[10px] text-white/40 shrink-0">({count})</span> : null}
    </button>
  );
  const renderPackCascade = (name: string) => {
    const pc = packSel(name);
    const pcG = groups.filter(g => pc.activityIds.includes(g.activity_id || ""));
    const pcC = cours.filter(c => (c.group_id && pc.groupIds.includes(c.group_id)) || (c.activity_id && pc.activityIds.includes(c.activity_id)));
    return (
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <p className="text-[10px] font-semibold text-white/50 uppercase mb-1">Activites</p>
          <div className="max-h-36 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
            {visibleActs.length === 0 ? <p className="px-2 py-3 text-[11px] text-white/40 italic">Aucune</p> : visibleActs.map(a => checkbox(pc.activityIds.includes(a.id), () => togglePackAct(name, a.id), a.name, String(actCount(a.id)), a.id))}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-[10px] font-semibold text-white/50 uppercase mb-1">Groupes</p>
          {pc.activityIds.length === 0 ? <p className="text-[11px] text-white/40 italic">Choisissez des activites</p> : (
            <div className="max-h-36 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
              {pcG.length === 0 ? <p className="px-2 py-3 text-[11px] text-white/40 italic">Aucun</p> : pcG.map(g => checkbox(pc.groupIds.includes(g.id), () => togglePackGrp(name, g.id), g.name, String(grpCount(g.id)), g.id))}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <p className="text-[10px] font-semibold text-white/50 uppercase mb-1">Cours / coach</p>
          {pc.activityIds.length === 0 ? <p className="text-[11px] text-white/40 italic">Choisissez des activites</p> : (
            <div className="max-h-36 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
              {pcC.length === 0 ? <p className="px-2 py-3 text-[11px] text-white/40 italic">Aucun</p> : pcC.map(c => (
                <div key={c.id}>
                  {checkbox(pc.coursIds.includes(c.id), () => togglePackCr(name, c.id), crName(c.id), "")}
                  {pc.coursIds.includes(c.id) && <div className="px-2 text-[10px] text-white/50">Coach: {coachName(c.trainer_id)} / {coachPct(c.trainer_id)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  const Sec = ({ children }: { children: any }) => <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">{children}</p>;  return (
    <ModalCard title="Modifier un Abonnement" onClose={onClose} wide>
      <div className="max-h-[80vh] overflow-y-auto pr-1 space-y-4">
        <div className="border-b border-white/10 pb-3">
          <Sec>1. Adherents</Sec>
          <div className="flex gap-2">
            <button onClick={() => bubble({ mode: "nouvel" })} className={`px-3 py-1.5 text-xs rounded font-medium ${mode === "nouvel" ? "bg-[#EA5800] text-white" : "border border-white/15 text-white/60 hover:bg-white/5"}`}>Nouvel abonnement</button>
            <button onClick={() => bubble({ mode: "reabonnement" })} className={`px-3 py-1.5 text-xs rounded font-medium ${mode === "reabonnement" ? "bg-[#EA5800] text-white" : "border border-white/15 text-white/60 hover:bg-white/5"}`}>Reabonnement</button>
          </div>
          <div className="mt-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input value={sMember} onChange={e => setSMember(e.target.value)} placeholder="Rechercher des adherents..." className="w-full pl-7 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
          </div>
          <div className="max-h-44 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
            {members.filter(m => !sMember || m.toLowerCase().includes(sMember.toLowerCase())).map(m => checkbox(memberIds.includes(m), () => toggleMember(m), m, "", m))}
          </div>
        </div>
        <div className="border-b border-white/10 pb-3">
          <Sec>Pack familial (optionnel)</Sec>
          <SelectField label="Pack" icon={Users} value={packId} onChange={v => bubble({ packId: v, packMemberIds: [] })} options={[{ value: "", label: "--- Aucun ---" }, ...packs.map(p => ({ value: p.id, label: p.name }))]} placeholder="Selectionner un pack" />
          {pack && (
            <>
              <p className="text-[11px] text-white/50 mt-1">Beneficiaires du pack - choisir jusqu'a {maxB} adherents</p>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                <input value={sPackBenef} onChange={e => setSPackBenef(e.target.value)} placeholder="Rechercher un adherent..." className="w-full pl-7 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
              </div>
              <div className="max-h-44 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
                {members.filter(m => !sPackBenef || m.toLowerCase().includes(sPackBenef.toLowerCase())).map(m => checkbox(packMemberIds.includes(m), () => toggleBeneficiary(m), m, "", m))}
              </div>
              {packMemberIds.map(bname => (
                <div key={bname} className="border border-[#EA5800]/20 rounded p-2 mt-2">
                  <p className="text-[11px] font-semibold text-[#EA5800] uppercase tracking-wider mb-1">3. Activites, Groupes & Cours - {bname}</p>
                  {renderPackCascade(bname)}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="border-b border-white/10 pb-3">
          <Sec>2. Type d'abonnement</Sec>
          <SelectField label="Type d'abonnement" icon={CreditCard} value={form.type} onChange={updateType} options={subTypes.map(t => ({ value: t.name, label: `${t.name} - ${t.price}DH` }))} placeholder="Type abonnement" />
        </div>        {!(pack && packMemberIds.length) && (
        <div className="border-b border-white/10 pb-3">
          <Sec>3. Activites, Groupes / Cours</Sec>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <p className="text-[10px] font-semibold text-white/50 uppercase mb-1">Activites</p>
              <input value={sAct} onChange={e => setSAct(e.target.value)} placeholder="Rechercher..." className="w-full px-2 py-1 text-[11px] bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
              <div className="max-h-40 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
                {filteredActs.length === 0 ? <p className="px-2 py-3 text-[11px] text-white/40 italic">Aucune</p> : filteredActs.map(a => checkbox(actIds.includes(a.id), () => toggleAct(a.id), a.name, String(actCount(a.id)), a.id))}
              </div>
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] font-semibold text-white/50 uppercase mb-1">Groupes</p>
              {actIds.length === 0 ? <p className="text-[11px] text-white/40 italic">Selectionnez des activites</p> : (
                <><input value={sGrp} onChange={e => setSGrp(e.target.value)} placeholder="Rechercher..." className="w-full px-2 py-1 text-[11px] bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
                <div className="max-h-40 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
                  {filteredGrps.length === 0 ? <p className="px-2 py-3 text-[11px] text-white/40 italic">Aucun</p> : filteredGrps.map(g => checkbox(grpIds.includes(g.id), () => toggleGrp(g.id), g.name, String(grpCount(g.id)), g.id))}
                </div></>
              )}
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] font-semibold text-white/50 uppercase mb-1">Cours (coach / commission)</p>
              {actIds.length === 0 ? <p className="text-[11px] text-white/40 italic">Selectionnez des activites</p> : (
                <><input value={sCr} onChange={e => setSCr(e.target.value)} placeholder="Rechercher..." className="w-full px-2 py-1 text-[11px] bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-[#EA5800]" />
                <div className="max-h-40 overflow-y-auto border border-white/10 rounded divide-y divide-white/5 mt-1">
                  {filteredCrs.length === 0 ? <p className="px-2 py-3 text-[11px] text-white/40 italic">Aucun</p> : filteredCrs.map(c => (
                    <div key={c.id}>
                      {checkbox(crsIds.includes(c.id), () => toggleCr(c.id), crName(c.id), "")}
                      {crsIds.includes(c.id) && <div className="px-2 text-[10px] text-white/50">Coach: {coachName(c.trainer_id)} / {coachPct(c.trainer_id)}</div>}
                    </div>
                  ))}
                </div></>
              )}
            </div>
          </div>
        </div>
        )}
        <div className="border-b border-white/10 pb-3">
          <Sec>4. Financier</Sec>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/60 mb-1">Base (Dhs)</label>
              <div className="px-2 py-1.5 text-sm rounded bg-white/5 text-white/70">{form.price || 0}</div>
            </div>
            <div>
              <label className="block text-[11px] text-white/60 mb-1">Remise</label>
              <div className="flex gap-1.5">
                <input type="number" min={0} value={form.remise === undefined ? "" : form.remise} onChange={e => setForm({ ...form, remise: Number(e.target.value) || 0 })} placeholder="0" className="w-full min-w-0 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40" />
                <select value={form.remiseType || "dh"} onChange={e => setForm({ ...form, remiseType: e.target.value })} className="px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white/70 shrink-0">
                  <option value="dh">DH</option>
                  <option value="percent">%</option>
                </select>
              </div>
              <p className="text-[10px] text-white/40">S'applique au prix, pas à l'assurance</p>
            </div>
            <div>
              <label className="block text-[11px] text-white/60 mb-1">Assurance (non incluse) — Dhs</label>
              <div className="px-2 py-1.5 text-sm rounded bg-white/5 text-white/70">{assurance}</div>
            </div>
          </div>
          <div className="mt-2 flex justify-between items-center text-[11px] text-white/50">
            <span>Sous-total abonnement (prix − remise)</span>
            <span className="font-mono">{priceBase - remise} Dhs</span>
          </div>
          <div className="mt-2 rounded bg-white/5 px-3 py-2 text-[11px] text-white/50">
            <div className="flex justify-between">
              <span>Assurance (non incluse au total)</span>
              <span className="font-mono">{assurance} Dhs</span>
            </div>
            {selectedPersons.length === 0 ? (
              <div className="mt-1 text-white/40">Assurance appliquée automatiquement selon les adhérents sélectionnés.</div>
            ) : assuranceActive ? (
              <div className="mt-1 text-emerald-400">✓ Assurance couverte pour {selectedPersons.length} adhérent(s)</div>
            ) : (
              <div className="mt-1 text-red-400">{selectedPersons.length} adhérent(s) — assurance à souscrire ou expirée</div>
            )}
          </div>
          <div className="mt-2 flex justify-between items-center border-t border-white/10 pt-2">
            <span className="text-sm font-semibold text-white">Total a payer</span>
            <span className="text-lg font-bold text-[#EA5800]">{total.toLocaleString()} Dhs</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <InputField label="Date debut" icon={Calendar} value={form.start} onChange={updateStart} placeholder="jj/mm/aaaa" />
            <InputField label="Date fin" icon={Calendar} value={form.end} onChange={v => setForm({ ...form, end: v as string })} placeholder="Date fin" readOnly />
          </div>
        </div>
        <div className="pb-1">
          <Sec>5. Paiement</Sec>
          <div className="flex gap-2 flex-wrap">
            {["Especes", "Virement", "Cheque"].map(p => (
              <button key={p} onClick={() => setForm({ ...form, payment: p })} className={`px-3 py-2 text-xs rounded font-medium ${form.payment === p ? "bg-[#EA5800] text-white" : "border border-white/15 text-white/60 hover:bg-white/5"}`}>{p}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <InputField label="Montant paye" icon={DollarSign} type="number" value={form.paid} onChange={updatePaid} placeholder="Paye" />
            <InputField label="Reste" icon={DollarSign} value={form.remaining} onChange={() => {}} placeholder="Reste" readOnly />
          </div>
        </div>
      </div>
      <FormActions onCancel={onClose} onSave={onSave} saveLabel="Enregistrer" />
    </ModalCard>
  );
}