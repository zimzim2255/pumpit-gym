import { useState, useEffect } from "react";
import { Plus, Trash2, Eye, Pencil, Phone, UserRound, Calendar, Upload } from "lucide-react";
import ModalCard from "../ui/ModalCard";
import { InputField } from "../ui/FormField";
import { loadAll, createTrainer, updateTrainer, deleteTrainer, getAttendance } from "../../services/programService";
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
  const [att, setAtt] = useState<any[]>([]);
  const [attFrom, setAttFrom] = useState("");
  const [attTo, setAttTo] = useState("");
  const [detailTab, setDetailTab] = useState<"assiduite" | "absences" | "commissions">("assiduite");
  const [detailMembers, setDetailMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSelOpen, setMemberSelOpen] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [assPage, setAssPage] = useState(1);
  const [absPage, setAbsPage] = useState(1);
  const [comPage, setComPage] = useState(1);
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
  // Load attendance (présence / absences) for the coach being viewed
  useEffect(() => {
    setDetailMembers([]);
    setMemberSearch("");
    setMemberSelOpen(false);
    if (detail?.name) {
      setAttLoading(true);
      getAttendance({}).then(r => setAtt(r?.attendance || [])).catch(() => setAtt([])).finally(() => setAttLoading(false));
    } else {
      setAtt([]);
    }
  }, [detail]);
  // Reset pagination when filters change
  useEffect(() => { setAssPage(1); setAbsPage(1); setComPage(1); }, [detailMembers, attFrom, attTo]);
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
  const coachSubs = (name: string) => { const nm = (name || "").trim().toLowerCase(); return (subs || []).filter(s => (s.trainer || "").trim().toLowerCase() === nm); };
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
  const memberAvatar = (name: string) => (
    <div className="w-8 h-8 rounded-full bg-[#EA5800]/20 flex items-center justify-center text-sm font-bold text-[#EA5800]">{name?.charAt?.(0)?.toUpperCase?.() || ""}</div>
  );
  const attCoach = (name: string) => {
    const nm = (name || "").trim().toLowerCase();
    return att.filter((r: any) => (r.trainer || "").trim().toLowerCase() === nm
      && (!detailMembers.length || detailMembers.some(m => (m || "").trim() === (r.member || "").trim()))
      && (!attFrom || String(r.date || "").slice(0, 10) >= attFrom)
      && (!attTo || String(r.date || "").slice(0, 10) <= attTo));
  };
  const attPresent = (name: string) => attCoach(name).filter((r: any) => r.status === "Présent");
  const attAbsent = (name: string) => attCoach(name).filter((r: any) => r.status === "Absent");
  const attCommission = (name: string) => attPresent(name).reduce((s, r) => s + Number(r.pay || 0), 0);
  const attMembers = (name: string) => {
    const map = new Map<string, { member: string; present: number; absent: number }>();
    attCoach(name).forEach((r: any) => {
      const cur = map.get(r.member) || { member: r.member, present: 0, absent: 0 };
      if (r.status === "Présent") cur.present++; else cur.absent++;
      map.set(r.member, cur);
    });
    return [...map.values()].sort((a, b) => b.absent - a.absent || a.member.localeCompare(b.member));
  };
  const coachMemberNames = (name: string) => {
    const set = new Set<string>();
    const nm = (name || "").trim().toLowerCase();
    att.filter((r: any) => (r.trainer || "").trim().toLowerCase() === nm).forEach(r => { if (r.member) set.add(String(r.member).trim()); });
    coachSubs(name).forEach(s => { if (s.member) set.add(String(s.member).trim()); });
    return [...set].sort();
  };
  const detailSubs = (name: string) => coachSubs(name).filter((s: any) => !detailMembers.length || detailMembers.some(m => (m || "").trim() === String(s.member || "").trim()));
  const detailSubsTotal = (name: string) => detailSubs(name).reduce((sum, s) => sum + subCommission(s), 0);
  // ── Pagination (20 lignes/page) ──
  const PAGE_N = 20;
  const pageSlice = (arr: any[], p: number) => { const s = (p - 1) * PAGE_N; return arr.slice(s, s + PAGE_N); };
  const pageBar = (total: number, p: number, setP: (n: number) => void) => {
    const pages = Math.max(1, Math.ceil(total / PAGE_N));
    if (total <= PAGE_N) return null;
    return (
      <div className="flex items-center gap-2 mt-2 text-[11px] text-white/50">
        <button disabled={p <= 1} onClick={() => setP(Math.max(1, p - 1))} className="px-2 py-0.5 rounded bg-white/5 text-white/60 disabled:opacity-40">←</button>
        <span className="px-2 py-0.5 rounded bg-white/5">Page {p} / {pages} • {total} ligne(s)</span>
        <button disabled={p >= pages} onClick={() => setP(Math.min(pages, p + 1))} className="px-2 py-0.5 rounded bg-white/5 text-white/60 disabled:opacity-40">→</button>
      </div>
    );
  };
  // ── Assiduité: liste TOUS les adhérents du coach (abonnements + présence) ──
  const attCounts = (name: string, member: string) => {
    let present = 0, absent = 0;
    attCoach(name).forEach((r: any) => { if ((r.member || "").trim() === (member || "").trim()) { if (r.status === "Présent") present++; else absent++; } });
    return { present, absent };
  };
  const assiduiteRows = (name: string) => {
    const members = coachMemberNames(name).filter(m => !detailMembers.length || detailMembers.some(x => (x || "").trim() === (m || "").trim()));
    return members.map(m => ({ member: m, ...attCounts(name, m) }));
  };
  const statCard = (label: string, value: string, sub: string, cls: string) => (
    <div className={`rounded-lg border border-white/5 p-3 ${cls}`}>
      <div className="text-[11px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-white/40">{sub}</div>
    </div>
  );
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
        <ModalCard title={`Détails coach — ${detail.name}`} onClose={() => setDetail(null)} wide size="xl">
          <div className="max-h-[85vh] overflow-y-auto pr-1 space-y-4">
            {/* En-tête coach + total à payer */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-4">
              {avatar(detail, "w-20 h-20", "rounded-2xl")}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-white">{detail.name}</div>
                <div className="text-xs text-white/40 mt-1">Spécialité : {detail.specialty || "—"}</div>
                {detail.phone && <div className="text-xs text-white/40">Téléphone : {detail.phone}</div>}
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white/40 uppercase tracking-wider">Total à payer (commissions)</div>
                <div className="text-2xl font-bold text-emerald-400">{detailSubsTotal(detail.name).toLocaleString()} DH</div>
                <div className="text-[11px] text-white/40">{detailSubs(detail.name).length} abonnement(s) • {attPresent(detail.name).length} présent(s) • {attAbsent(detail.name).length} absent(s)</div>
              </div>
            </div>

            {/* Cartes récapitulatives */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statCard("Total commissions", `${detailSubsTotal(detail.name).toLocaleString()} DH`, "à payer sur les abonnements", "bg-[#EA5800]/10")}
              {statCard("Adhérents", String(coachMemberNames(detail.name).length), "sous ce coach", "bg-white/5")}
              {statCard("Jours présents", String(attPresent(detail.name).length), "passages au doigt", "bg-emerald-500/10")}
              {statCard("Jours absents", String(attAbsent(detail.name).length), "manqués, sans passage", "bg-red-500/10")}
            </div>

            {/* Filtre par date */}
            <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-white/50 uppercase tracking-wider">Filtrer</span>
              <label className="text-[10px] text-white/50">Du
                <input type="date" value={attFrom} onChange={e => setAttFrom(e.target.value)} className="mx-1 px-1.5 py-1 text-xs bg-white/5 border border-white/10 rounded text-white" />
              </label>
              <label className="text-[10px] text-white/50">Au
                <input type="date" value={attTo} onChange={e => setAttTo(e.target.value)} className="mx-1 px-1.5 py-1 text-xs bg-white/5 border border-white/10 rounded text-white" />
              </label>
              {(attFrom || attTo) && <button onClick={() => { setAttFrom(""); setAttTo(""); }} className="text-[11px] text-[#EA5800] hover:underline">Réinitialiser dates</button>}
            </div>

            {/* Sélecteur d'adhérents (recherche + multi-sélection) — dropdown compact */}
            <div className="rounded-md bg-white/5 border border-white/10 relative">
              <button type="button" onClick={() => setMemberSelOpen(o => !o)} className="w-full flex items-center justify-between px-2.5 py-2 text-[12px] text-white/80">
                <span className="text-white/80">Adhérents {detailMembers.length ? `(${detailMembers.length} sél.)` : "(tous)"}</span>
                <span className={`text-white/40 transition-transform ${memberSelOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {memberSelOpen && (
                <div className="absolute left-0 right-0 z-30 mt-1 rounded-md bg-[#181b28] border border-white/10 shadow-xl">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Rechercher un adhérent..." className="flex-1 min-w-[120px] px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder-white/40" />
                    {(detailMembers.length > 0 || memberSearch) && <button onClick={() => { setDetailMembers([]); setMemberSearch(""); }} className="text-[11px] text-[#EA5800] hover:underline shrink-0">Tous</button>}
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-white/10 rounded divide-y divide-white/5">
                    <button key="__all__" type="button" onClick={() => { setDetailMembers([]); setMemberSearch(""); }} className="w-full text-left px-2 py-1.5 text-[12px] flex items-center gap-2 hover:bg-white/5">
                      <span className={`w-4 h-4 rounded border shrink-0 inline-flex items-center justify-center ${detailMembers.length === 0 ? "bg-[#EA5800] border-[#EA5800]" : "border-white/25"}`}>{detailMembers.length === 0 ? <span className="text-white text-[10px]">x</span> : null}</span>
                      <span className="font-medium text-white/90">Tous</span>
                    </button>
                    {coachMemberNames(detail.name).filter(m => !memberSearch || m.toLowerCase().includes(memberSearch.toLowerCase())).map(m => {
                      const check = detailMembers.includes(m);
                      return (
                        <button key={m} type="button" onClick={() => setDetailMembers(check ? detailMembers.filter(x => x !== m) : [...detailMembers, m])} className="w-full text-left px-2 py-1.5 text-[12px] flex items-center gap-2 hover:bg-white/5">
                          <span className={`w-4 h-4 rounded border shrink-0 inline-flex items-center justify-center ${check ? "bg-[#EA5800] border-[#EA5800]" : "border-white/25"}`}>{check ? <span className="text-white text-[10px]">x</span> : null}</span>
                          <span className="truncate text-white/90">{m}</span>
                        </button>
                      );
                    })}
                    {coachMemberNames(detail.name).length === 0 && <p className="px-2 py-3 text-[11px] text-white/40 italic">Aucun adhérent sous ce coach</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Onglets */}
            <div className="flex gap-2 bg-white/5 rounded-lg p-1">
              <button onClick={() => setDetailTab("assiduite")} className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md ${detailTab === "assiduite" ? "bg-[#EA5800] text-white" : "text-white/50 hover:bg-white/10"}`}>Assiduité</button>
              <button onClick={() => setDetailTab("absences")} className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md ${detailTab === "absences" ? "bg-[#EA5800] text-white" : "text-white/50 hover:bg-white/10"}`}>Jours absents ({attAbsent(detail.name).length})</button>
              <button onClick={() => setDetailTab("commissions")} className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md ${detailTab === "commissions" ? "bg-[#EA5800] text-white" : "text-white/50 hover:bg-white/10"}`}>Commissions</button>
            </div>

            {detailTab === "assiduite" && (
            <div className="rounded-lg bg-white/5 border border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider">Assiduité des adhérents sous ce coach</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/3">
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Adhérent</th>
                      <th className="px-3 py-2 text-right text-xs text-white/30 uppercase">Présent</th>
                      <th className="px-3 py-2 text-right text-xs text-white/30 uppercase">Absent</th>
                      <th className="px-3 py-2 text-right text-xs text-white/30 uppercase">Total</th>
                      <th className="px-3 py-2 text-right text-xs text-white/30 uppercase">Taux présence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pageSlice(assiduiteRows(detail.name), assPage).map((m: any) => {
                      const tot = m.present + m.absent;
                      const rate = tot ? Math.round((m.present / tot) * 100) : 0;
                      return (
                        <tr key={m.member} className="border-b border-white/5">
                          <td className="px-3 py-2.5"><div className="flex items-center gap-2">{memberAvatar(m.member)}<span className="font-medium text-white">{m.member}</span></div></td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-400">{m.present}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-red-400">{m.absent}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-white/70">{tot}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-white/70">{rate}%</td>
                        </tr>
                      );
                    })}
                    {assiduiteRows(detail.name).length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-white/20 text-sm">{attLoading ? "Chargement..." : "Aucun adhérent sous ce coach"}</td></tr>}
                  </tbody>
                </table>
                {pageBar(assiduiteRows(detail.name).length, assPage, setAssPage)}
              </div>
            </div>
            )}

            {detailTab === "absences" && (
            <div className="rounded-lg bg-white/5 border border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-red-400/80 uppercase tracking-wider">Jours d'absence ({attAbsent(detail.name).length})</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/3">
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Adhérent</th>
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Jour</th>
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Cours</th>
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Horaire</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pageSlice(attAbsent(detail.name), absPage).map((r: any, i: number) => (
                      <tr key={`${r.member}-${r.date}-${i}`} className="border-b border-white/5">
                        <td className="px-3 py-2"><div className="flex items-center gap-2">{memberAvatar(r.member)}<span className="text-white/85">{r.member}</span></div></td>
                        <td className="px-3 py-2 font-mono text-xs text-white/70">{r.dateDisp || r.date}</td>
                        <td className="px-3 py-2 text-white/70">{r.day}</td>
                        <td className="px-3 py-2 text-white/80">{r.cours}</td>
                        <td className="px-3 py-2 font-mono text-xs text-white/60">{r.start_time}–{r.end_time}</td>
                      </tr>
                    ))}
                    {attAbsent(detail.name).length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-white/20 text-sm">{attLoading ? "Chargement..." : "Aucune absence enregistrée"}</td></tr>}
                  </tbody>
                </table>
                {pageBar(attAbsent(detail.name).length, absPage, setAbsPage)}
              </div>
            </div>
            )}

            {detailTab === "commissions" && (
            <div className="rounded-lg bg-white/5 border border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider">Commissions à payer par abonnement</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/3">
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Adhérent</th>
                      <th className="px-3 py-2 text-left text-xs text-white/30 uppercase">Abonnement</th>
                      <th className="px-3 py-2 text-right text-xs text-white/30 uppercase">Prix</th>
                      <th className="px-3 py-2 text-right text-xs text-white/30 uppercase">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pageSlice(detailSubs(detail.name), comPage).map((s: any, i: number) => (
                      <tr key={s.id || i} className="border-b border-white/5">
                        <td className="px-3 py-2"><div className="flex items-center gap-2">{memberAvatar(s.member)}<span className="font-medium text-white">{s.member}</span></div></td>
                        <td className="px-3 py-2"><span className="font-mono text-xs text-[#EA5800]">{s.id}</span></td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-white/60">{Number(s.price || 0).toLocaleString()} DH</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold text-emerald-400">{subCommission(s)} DH</td>
                      </tr>
                    ))}
                    {detailSubs(detail.name).length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-white/20 text-sm">Aucun abonnement assigné</td></tr>}
                    {detailSubs(detail.name).length > 0 && (
                      <tr className="bg-white/3">
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold text-white/70">Total commissions abonnements</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold text-emerald-400">{detailSubsTotal(detail.name).toLocaleString()} DH</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {pageBar(detailSubs(detail.name).length, comPage, setComPage)}
              </div>
            </div>
            )}
          </div>
        </ModalCard>
      )}
    </div>
  );
}