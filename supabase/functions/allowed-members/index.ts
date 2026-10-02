// ═══════════════════════════════════════════════════════════════════════════════
//  allowed-members - returns the members allowed to enter RIGHT NOW.
//  ───────────────────────────────────────────────────────────────────────────────
//  Used by the connector's access-sync layer: the connector asks "who may
//  enter?" and writes that state into the CVAccess local DB so the terminal
//  refuses the rest LOCALLY (relay never fires for them).
//  Rule mirrors zkteco-webhook: member Actif + subscription in range + paid
//  (Payé / Paiement partiel allowed, "Non payé" denied). Uses each member's
//  latest subscription (by sub_end).
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Compare two DD/MM/YYYY strings chronologically.
function cmpFrDate(a: string, b: string): number {
  const p = (s: string) => {
    const [d, m, y] = s.split("/").map(Number);
    return y * 10000 + m * 100 + d;
  };
  const av = a ? p(a) : 0;
  const bv = b ? p(b) : 0;
  return av === bv ? 0 : av > bv ? 1 : -1;
}

function parseFrDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

// ── Strict time-window (TouptiGym rule) ────────────────────────────────────
// A member may enter ONLY while "now" falls inside one of the scheduled cours
// linked to their subscription (via subscription_cours -> cours). If no cours
// is scheduled for this day (or none linked at all) -> denied.
const FR_DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function toMin(s: string): number | null {
  const m = String(s || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Local wall-clock moment (configurable offset, Morocco is UTC+1 => +60).
function localNow(): { dayFr: string; todayYmd: string; minutes: number } {
  const offset = Number(Deno.env.get("GYM_TZ_OFFSET_MIN") || 60);
  const t = new Date(Date.now() + offset * 60000);
  return {
    dayFr: FR_DAYS[t.getUTCDay()],
    todayYmd: `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`,
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
}

// Returns true if the member is inside one of their linked cours' time window.
// TouptiGym rule: allowed on the member's training day, from course START − 15 min
// through course END + 30 min (an entry window around the actual class).
// HYBRID rule: if the member has NO linked cours (or none scheduled), they are
// allowed; the time-window is enforced ONLY when a cours is actually linked and
// its day/time/states can be checked. This prevents locking out valid+paid
// members who simply don't have a schedule row.
const ALLOW_BEFORE_MIN = 15; // entry allowed this many minutes before cours start
const ALLOW_AFTER_MIN = 30;  // entry allowed this many minutes after cours end
async function inCourseWindow(supabase: any, courseIds: string[]): Promise<boolean> {
  if (!courseIds.length) return true; // no cours linked => allow (no schedule constraint)
  const { dayFr, todayYmd, minutes } = localNow();
  const { data: rows, error } = await supabase
    .from("cours")
    .select("day, start_time, end_time, start_date, end_date, status")
    .in("id", courseIds)
    .eq("status", "Actif");
  if (error || !rows || !rows.length) return true; // cours referenced but none active => allow to be safe
  return rows.some((c: any) => {
    if (String(c.day || "").trim() !== dayFr) return false;
    if (c.start_date && todayYmd < String(c.start_date).slice(0, 10)) return false;
    if (c.end_date && todayYmd > String(c.end_date).slice(0, 10)) return false;
    const s = toMin(c.start_time), e = toMin(c.end_time);
    if (s === null || e === null) return false;
    const lo = s - ALLOW_BEFORE_MIN, hi = e + ALLOW_AFTER_MIN;
    return minutes >= lo && minutes <= hi;
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const secret =
    Deno.env.get("ZKTECO_WEBHOOK_SECRET") ||
    Deno.env.get("WEBHOOK_SECRET") ||
    Deno.env.get("GYM_DOOR_SECRET");
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    // Normal single members (existing behaviour)
    const { data: members } = await supabase.from("members").select("id, status");
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, member_id, sub_start, sub_end, sub_status, pack_id");

    const memberStatus = new Map<string, string>();
    for (const m of members || []) memberStatus.set(m.id, m.status);

    // latest subscription per member (by sub_end desc)
    const latestSub = new Map<string, any>();
    for (const s of subs || []) {
      if (!s.member_id) continue;
      const cur = latestSub.get(s.member_id);
      if (!cur || cmpFrDate(s.sub_end, cur.sub_end) > 0) latestSub.set(s.member_id, s);
    }

    // Family packs: active pack subscriptions -> every pack member (by zkteco_id)
    const today = new Date();
    const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const packIds = new Set<string>();
    for (const s of subs || []) {
      if (!s.pack_id) continue;
      if (s.sub_status === "Non payé") continue;
      const startDate = parseFrDate(s.sub_start);
      const endDate = parseFrDate(s.sub_end);
      if (!startDate || !endDate) continue;
      if (todayNorm >= startDate && todayNorm <= endDate) packIds.add(s.pack_id);
    }

    let packMembers: Array<{ id: string; zkteco_id: string; pack_id: string }> = [];
    // subscription_id -> cours ids (for the active pack subscriptions)
    const subCours: Record<string, string[]> = {};
    // family_pack_members.id -> subscription_id (which sub covers this beneficiary)
    const packMemberSub: Record<string, string> = {};
    if (packIds.size > 0) {
      const packSubIds = subs
        ?.filter((s: any) => s.pack_id && packIds.has(s.pack_id))
        .map((s: any) => s.id) || [];

      if (packSubIds.length) {
        const [scRes, spmRes] = await Promise.all([
          supabase.from("subscription_cours")
            .select("subscription_id, cours_id")
            .in("subscription_id", packSubIds),
          supabase.from("subscription_pack_members")
            .select("subscription_id, pack_member_id")
            .in("subscription_id", packSubIds),
        ]);
        for (const row of scRes.data || []) {
          (subCours[row.subscription_id] = subCours[row.subscription_id] || []).push(row.cours_id);
        }
        for (const row of spmRes.data || []) {
          // keep the latest subscription that covers this pack member
          packMemberSub[row.pack_member_id] = row.subscription_id;
        }
      }

      const { data: pm } = await supabase
        .from("family_pack_members")
        .select("id, zkteco_id, pack_id")
        .in("pack_id", Array.from(packIds))
        .not("zkteco_id", "is", null);
      packMembers = pm || [];
    }

    const allowed: Array<{ userId: string; subEnd: string }> = [];
    const used = new Set<string>();

    for (const [memberId, sub] of latestSub) {
      if (memberStatus.get(memberId) !== "Actif") continue;
      if (sub.sub_status === "Non payé") continue;
      const startDate = parseFrDate(sub.sub_start);
      const endDate = parseFrDate(sub.sub_end);
      if (!startDate || !endDate) continue;
      if (todayNorm < startDate || todayNorm > endDate) continue;

      // STRICT TIME-WINDOW: resolve cours linked to THIS subscription (member-level)
      // and only allow if now is inside one of their scheduled windows.
      let courseIds: string[] = [];
      if (sub.id) {
        const { data: sc } = await supabase
          .from("subscription_cours")
          .select("cours_id")
          .eq("subscription_id", sub.id);
        courseIds = (sc || []).map((r: any) => r.cours_id).filter(Boolean);
      }
      if (!(await inCourseWindow(supabase, courseIds))) continue; // strict: outside window => denied

      allowed.push({ userId: memberId, subEnd: sub.sub_end });
      used.add(memberId);
    }

    // Add every pack member (inside their covering subscription's course window)
    for (const p of packMembers) {
      if (!p.zkteco_id || used.has(p.zkteco_id)) continue;
      const subId = packMemberSub[p.id];
      const packCourseIds = subId ? (subCours[subId] || []) : [];
      if (!(await inCourseWindow(supabase, packCourseIds))) continue; // strict
      allowed.push({ userId: p.zkteco_id, subEnd: "" });
      used.add(p.zkteco_id);
    }

    return new Response(JSON.stringify({ allowed, count: allowed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("allowed-members error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});