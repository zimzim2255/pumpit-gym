// ═══════════════════════════════════════════════════════════════════════════════
//  Attendance Manager - track each member's trainer-day presence from door access
//  ───────────────────────────────────────────────────────────────────────────────
//  For every abonnement, resolves the member's selected cours (via
//  subscription_member_courses -> cours -> trainers). For each scheduled day of
//  that cours within [sub_start, sub_end], it checks the door logs
//  (access_logs, status = 'Autorisé') on that date:
//    * a matching authorized scan  -> PRÉSENT
//    * no scan                     -> ABSENT
//  The trainer's commission is paid ONLY for the days the member actually came.
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DAY_INDEX = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };
const DAY_NAMES = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// "DD/MM/YYYY" -> "YYYY-MM-DD"; pass through YYYY-MM-DD untouched.
function toISO(d: string): string {
  if (!d) return "";
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return d.slice(0, 10);
}
function parseDate(s: string): Date | null {
  const iso = toISO(s);
  if (!iso) return null;
  const p = iso.split("-").map(Number);
  if (p.length !== 3) return null;
  const dt = new Date(p[0], p[1] - 1, p[2]);
  return isNaN(dt.getTime()) ? null : dt;
}
function isoYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// All dates (as YYYY-MM-DD) from start..end (inclusive) falling on weekday#w (1..7).
function scheduledDates(start: Date, end: Date, w: number): string[] {
  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cur <= end) {
    const dow = cur.getDay(); // 0=Sun..6=Sat
    const target = w === 7 ? 0 : w; // Dimanche=7 -> JS 0
    if (dow === target) out.push(isoYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
function fmtDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

try {
    const body = await req.json();

    switch (body.type) {
      // ── attendance-list ─────────────────────────────────────────────
      case "attendance-list": {
        const memberId = body.memberId || "";
        const coursId = body.coursId || "";
        const trainerId = body.trainerId || "";

        let subQuery = supabase
          .from("subscriptions")
          .select("id, member_id, sub_start, sub_end, price, sub_type, trainer, commissions, subscription_member_courses(*), subscription_members(member_name)")
          .order("created_at", { ascending: false });
        if (memberId) subQuery = subQuery.eq("member_id", memberId);
        const { data: subs, error: subErr } = await subQuery;
        if (subErr) throw subErr;

        const memberNameById = new Map<string, string>();
        (subs || []).forEach((sub: any) => {
          if (sub.member_id) memberNameById.set(sub.member_id, sub.member_id);
          (sub.subscription_members || []).forEach((sm: any) => memberNameById.set(sm.member_name, sm.member_name));
        });

        const allCoursIds: string[] = [];
        (subs || []).forEach((sub: any) => {
          (sub.subscription_member_courses || []).forEach((c: any) => { if (c.cours_id) allCoursIds.push(c.cours_id); });
        });
        const uniqueCours = Array.from(new Set(allCoursIds));

        const coursMap = new Map<string, any>();
        if (uniqueCours.length) {
          const { data: coursRows, error: ce } = await supabase.from("cours").select("*, trainers(name)").in("id", uniqueCours);
          if (!ce) (coursRows || []).forEach((c: any) => coursMap.set(c.id, c));
        }

        const { data: logs, error: le } = await supabase
          .from("access_logs").select("member_id, member_name, date, status").in("status", ["Autorisé"]).order("date", { ascending: true });
        if (le) throw le;

        const presentSet = new Set<string>();
        (logs || []).forEach((l: any) => { presentSet.add(`${l.member_name || l.member_id}|${String(l.date).slice(0, 10)}`); });

        const rows: any[] = [];
        const totals: Record<string, { trainer: string; present: number; absent: number; commission: number }> = {};

        for (const sub of subs || []) {
          const startD = parseDate(sub.sub_start);
          const endD = parseDate(sub.sub_end) || startD;
          if (!startD) continue;
          const price = Number(sub.price || 0);

          for (const sel of sub.subscription_member_courses || []) {
            const c = coursMap.get(sel.cours_id || "");
            if (!c) continue;
            const widx = DAY_INDEX[(c.day as string) || ""];
            if (!widx) continue;
            if (coursId && c.id !== coursId) continue;
            const trainerName = c.trainers?.name || sub.trainer || "—";
            if (trainerId && c.trainer_id !== trainerId) continue;

            const dates = scheduledDates(startD, endD, widx);
            if (!dates.length) continue;

            const cType = c.commission_type || "percent";
            const cVal = Number(c.commission_value || 0);

            let present = 0, absent = 0, commission = 0;
            for (const iso of dates) {
              const isP = presentSet.has(`${sel.member_name}|${iso}`);
              if (isP) { present++; commission += cType === "fixed_amount" ? cVal : Math.round((price * cVal) / 100); }
              else absent++;
              rows.push({
                subscriptionId: sub.id,
                member: sel.member_name,
                memberId: sub.member_id,
                date: iso,
                dateDisp: fmtDDMMYYYY(iso),
                day: DAY_NAMES[widx],
                cours: c.name || c.day,
                start_time: c.start_time || "",
                end_time: c.end_time || "",
                trainerId: c.trainer_id,
                trainer: trainerName,
                status: isP ? "Présent" : "Absent",
                pay: isP ? (cType === "fixed_amount" ? cVal : Math.round((price * cVal) / 100)) : 0,
              });
            }

            const t = totals[trainerName] || { trainer: trainerName, present: 0, absent: 0, commission: 0 };
            t.present += present; t.absent += absent; t.commission += commission;
            totals[trainerName] = t;
          }
        }

        rows.sort((a: any, b: any) => String(a.member).localeCompare(String(b.member)) || a.date.localeCompare(b.date));
        return ok({ attendance: rows, totals: Object.values(totals), members: [...memberNameById.values()] });
      }

      default:
        return ok({ error: "Invalid type" }, 400);
    }
  } catch (error) {
    return ok({ error: error.message }, 500);
  }
});
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const ok = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });