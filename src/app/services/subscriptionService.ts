// ═══════════════════════════════════════════════════════════════════════════════
//  Subscription Types Service
//  ───────────────────────────────────────────────────────────────────────────────
//  Loads & saves the "Tarifs des abonnements" from/to the Supabase DB via the
//  deployed subscription-manager edge function. Shared across the whole app so
//  prices set in Paramètres are the real prices used in the Abonnements forms.
// ═══════════════════════════════════════════════════════════════════════════════

export type SubType = {
  code: string; name: string; duration: string; price: number; desc: string; status: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lbbwmwyfthvdnwofqakp.supabase.co";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const DEFAULT_SUB_TYPES: SubType[] = [
  { code: "JOUR", name: "Journalier", duration: "1 jour", price: 30, desc: "Accès unique journée", status: "Actif" },
  { code: "MENS", name: "Mensuel", duration: "1 mois", price: 200, desc: "Accès illimité 1 mois", status: "Actif" },
  { code: "BIME", name: "Bimestriel", duration: "2 mois", price: 380, desc: "2 mois à prix avantageux", status: "Actif" },
  { code: "TRIM", name: "Trimestriel", duration: "3 mois", price: 500, desc: "3 mois économiques", status: "Actif" },
  { code: "SEMI", name: "Semestriel", duration: "6 mois", price: 900, desc: "6 mois à prix réduit", status: "Actif" },
  { code: "ANNU", name: "Annuel", duration: "12 mois", price: 1600, desc: "Meilleure valeur", status: "Actif" },
];

// ─── In-memory cache so all views read the same (latest) prices ───────────────

let cachedPrices: SubType[] = DEFAULT_SUB_TYPES.map(t => ({ ...t }));

export function getCachedSubTypes(): SubType[] {
  return cachedPrices;
}

export function setCachedSubTypes(types: SubType[]) {
  if (Array.isArray(types) && types.length > 0) {
    cachedPrices = types.map(t => ({ ...t }));
  }
}

// ─── API calls (subscription-manager edge function) ───────────────────────────

async function subApi(type: string, data?: any) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/subscription-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ ...data, type }),
    });
    if (res.ok) return await res.json();
    throw new Error("API error");
  } catch {
    return null;
  }
}

// Load prices from the backend. Falls back to in-memory cache on failure.
export async function getSubscriptionPrices(): Promise<SubType[]> {
  const result = await subApi("prices-list");
  if (result?.prices?.length) {
    const mapped: SubType[] = result.prices.map((p: any) => ({
      code: p.code, name: p.name || p.code, duration: p.duration || "",
      price: typeof p.price === "number" ? p.price : Number(p.price) || 0,
      desc: p.desc ?? p.description ?? "", status: p.status || "Actif",
    }));
    setCachedSubTypes(mapped);
    return mapped;
  }
  return getCachedSubTypes();
}

// Save prices to the backend. Returns true on success.
export async function saveSubscriptionPrices(prices: SubType[]): Promise<boolean> {
  const result = await subApi("prices-update", { prices });
  if (result?.success) {
    setCachedSubTypes(prices);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  New mix-project helpers: Packs, Activités/Groupes/Cours, Entraîneurs, Insurance
//  ───────────────────────────────────────────────────────────────────────────────
//  These load the offer & scheduling data (created via program-manager) and expose
//  it to the Abonnement / Adhérent forms. Additive only — existing exports untouched.
// ═══════════════════════════════════════════════════════════════════════════════

export type Activity = { id: string; name: string; price: number; status: string };
export type GroupItem = { id: string; name: string; activity_id: string; activity_name?: string };
export type Trainer = { id: string; name: string; phone: string; specialty: string; photo: string };
export type Cours = { id: string; activity_id: string; group_id: string; trainer_id: string; name: string; day: string; start_time: string; end_time: string; room: string; capacity: number };
export type Pack = { id: string; name: string; price: number; duration: string; description: string; max_beneficiaries: number; status: string };
export type PackMember = { id: string; pack_id: string; name: string; gender: string; age: number; zkteco_id: string; photo: string };

async function progApi(type: string, data?: any) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/program-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ ...data, type }),
    });
    if (res.ok) return await res.json();
    return null;
  } catch { return null; }
}

// Activités
export async function getActivities(): Promise<Activity[]> {
  const r = await progApi("activities-list");
  return (r?.activities || []).map((a: any) => ({
    id: a.id, name: a.name, price: Number(a.price) || 0, status: a.status || "Actif",
  }));
}

// Groupes
export async function getGroups(): Promise<GroupItem[]> {
  const r = await progApi("groups-list");
  return (r?.groups || []).map((g: any) => ({
    id: g.id, name: g.name, activity_id: g.activity_id, activity_name: g.activity_name,
  }));
}

// Entraîneurs
export async function getTrainers(): Promise<Trainer[]> {
  const r = await progApi("trainers-list");
  return (r?.trainers || []).map((t: any) => ({
    id: t.id, name: t.name, phone: t.phone || "", specialty: t.specialty || "", photo: t.photo || "",
  }));
}

// Cours
export async function getCours(): Promise<Cours[]> {
  const r = await progApi("cours-list");
  return (r?.cours || []).map((c: any) => ({
    id: c.id, activity_id: c.activity_id, group_id: c.group_id, trainer_id: c.trainer_id,
    name: c.name || "", day: c.day, start_time: c.start_time || "", end_time: c.end_time || "",
    room: c.room || "", capacity: c.capacity || 0,
  }));
}

// Packs (backend "packs" returns each pack with its members inline)
export async function getPacks(): Promise<(Pack & { members: PackMember[] })[]> {
  const r = await progApi("packs-list");
  return (r?.packs || []).map((p: any) => ({
    id: p.id, name: p.name, price: Number(p.price) || 0, duration: p.duration || "",
    description: p.description || "", max_beneficiaries: Number(p.max_beneficiaries) || 1,
    status: p.status || "Actif",
    members: (p.members || []).map((m: any) => ({
      id: m.id, pack_id: m.pack_id, name: m.name,
      gender: m.gender || "", age: Number(m.age) || 0,
      zkteco_id: m.zkteco_id || "", photo: m.photo || "",
    })),
  }));
}

// Insurance: return the member's ins. status + list (backend uses insurance-status / insurance-list)
export async function getMemberInsurance(memberId: string): Promise<{ insured: boolean; end_date: string | null } | null> {
  const r = await progApi("insurance-status", { memberId });
  if (!r) return null;
  return { insured: !!r.insured, end_date: r.end_date || null };
}