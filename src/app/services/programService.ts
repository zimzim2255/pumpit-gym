// ═══════════════════════════════════════════════════════════════════════════════
//  programService - talks to the `program-manager` edge function
//  (activités / groupes / cours / entraîneurs / packs). The UI reads + writes
//  through here so the data actually lives in the Supabase database instead of
//  being trapped in localStorage.
// ═══════════════════════════════════════════════════════════════════════════════

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

interface Resp { error?: string; [k: string]: any; }

async function call(type: string, payload: any = {}): Promise<Resp> {
  const res = await fetch(`${FUNCTIONS_URL}/program-manager`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ ...payload, type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `program-manager ${type} failed`);
  return data;
}

export interface ProgrammeStore {
  activities: any[];
  groups: any[];
  trainers: any[];
  packs: any[];
  cours: any[];
}

const EMPTY: ProgrammeStore = { activities: [], groups: [], trainers: [], packs: [], cours: [] };

/** Load every programme collection from the database (parallel). */
export async function loadAll(): Promise<ProgrammeStore> {
  try {
    const [a, g, t, p, c] = await Promise.all([
      call("activities-list"),
      call("groups-list"),
      call("trainers-list"),
      call("packs-list"),
      call("cours-list"),
    ]);
    return {
      activities: a.activities || [],
      groups: g.groups || [],
      trainers: t.trainers || [],
      packs: p.packs || [],
      cours: c.cours || [],
    };
  } catch (e) {
    // network/CORS failure (e.g. edge function not yet deployed) — fall back to
    // whatever the caller seeded from localStorage
    return EMPTY;
  }
}

// ── ACTIVITIES ─────────────────────────────────────────────────────────────
export const createActivity = (a: any) => call("activities-create", a);
export const updateActivity = (a: any) => call("activities-update", a);
export const deleteActivity = (id: string) => call("activities-delete", { id });

// ── GROUPS ─────────────────────────────────────────────────────────────────
export const createGroup = (g: any) => call("groups-create", g);
export const updateGroup = (g: any) => call("groups-update", g);
export const deleteGroup = (id: string) => call("groups-delete", { id });

// ── TRAINERS / COACHES ─────────────────────────────────────────────────────
export const createTrainer = (t: any) => call("trainers-create", t);
export const updateTrainer = (t: any) => call("trainers-update", t);
export const deleteTrainer = (id: string) => call("trainers-delete", { id });

// ── COURS ──────────────────────────────────────────────────────────────────
export const createCours = (c: any) => call("cours-create", c);
export const updateCours = (c: any) => call("cours-update", c);
export const deleteCours = (id: string) => call("cours-delete", { id });

// ── PACKS ──────────────────────────────────────────────────────────────────
export const createPack = (p: any) => call("packs-create", p);
export const updatePack = (p: any) => call("packs-update", p);
export const deletePack = (id: string) => call("packs-delete", { id });

// ── INSURANCE ─────────────────────────────────────────────────────────────
export const getAllInsurance = () => call("insurance-all");

export const addInsurance = (payload: any) => call("insurance-add", payload);

// ── ATTENDANCE / COMMISSION PER TRAINER DAY ────────────────────────────────
const ATTENDANCE_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/attendance-manager";
export async function getAttendance(payload: any = {}): Promise<any> {
  const res = await fetch(ATTENDANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ ...payload, type: "attendance-list" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "attendance failed");
  return data;
}
