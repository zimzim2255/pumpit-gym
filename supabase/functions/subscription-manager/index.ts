// ═══════════════════════════════════════════════════════════════════════════════
//  Subscription Manager - Edge Function
//  ───────────────────────────────────────────────────────────────────────────────
//  CRUD operations for subscriptions in Supabase database.
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const generateId = (prefix: string): string => {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${rand}`;
  };

  try {
    const body = await req.json();

    switch (body.type) {
      case "create": {
        // Tolerant: never reject a real submission over trivial field gaps.
        // Derive subEnd from subType when missing; default type to "Mensuel".
        const subTypeNorm = (body.subType || "Mensuel") as string;
        const subStartNorm = (body.subStart || new Date().toLocaleDateString("fr-FR")) as string;
        let subEndNorm = (body.subEnd || "") as string;
        if (!subEndNorm) {
          const monthsMap = { "Journalier": 0, "Mensuel": 1, "Bimestriel": 2, "Trimestriel": 3, "Semestriel": 6, "Annuel": 12 };
          const [d, m, y] = subStartNorm.split("/").map(Number);
          const dt = new Date(y, (m || 1) - 1, d || 1);
          dt.setMonth(dt.getMonth() + (monthsMap[subTypeNorm] || 1));
          subEndNorm = dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
        }
        const subType = subTypeNorm, subStart = subStartNorm, subEnd = subEndNorm;

        const memberIdRaw = (body.memberId || "").toString().trim();
        // subscriptions.member_id is a NOT NULL FK → members.id. Callers sometimes
        // only send NAMES (family-pack / multi-adhérent flow) and leave memberId
        // empty; never fabricate a fake id (that trips subscriptions_member_id_fkey).
        // Resolve the primary member from the first covered adhérent that exists.
        let memberId = memberIdRaw;
        if (!memberId) {
          const coveredNames = Array.from(new Set(
            [...(Array.isArray(body.memberIds) ? body.memberIds : []),
             ...(Array.isArray(body.packMemberIds) ? body.packMemberIds : [])]
              .map(n => String(n).trim()).filter(n => n.length > 0 && !n.includes(","))
          ));
          if (coveredNames.length) {
            const { data: found } = await supabase
              .from("members").select("id").in("name", coveredNames).limit(1);
            if (found && found.length) memberId = found[0].id;
          }
        }
        if (!memberId) return new Response(
          JSON.stringify({ error: "A valid member is required to create a subscription." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
        const subId = `AB${Date.now().toString(36).toUpperCase()}`;
        const price = body.price || 0;
        const paid = body.paid || 0;
        const remiseRaw = Number(body.remise) || 0;
        const remiseType = body.remiseType || "dh";
        const remise = remiseType === "percent"
          ? Math.min(price, (price * remiseRaw) / 100)
          : Math.min(price, remiseRaw);
        const netPrice = Math.max(0, price - remise);
        const remaining = Math.max(0, netPrice - paid);
        const subStatus = remaining === 0 ? "Payé" : paid === 0 ? "Non payé" : "Paiement partiel";

        // Family pack support: subscription can cover a pack (multi-member).
        const packId = body.packId || body.pack_id || null;

        // Insurance rule: NEW member = 1 year, paid ONCE. On renewal, skip if the
        // member still has a valid insurance (end_date >= today).
        let insuranceSkipped = false;
        let insuranceAdded = false;
        const { data: insuredRes, error: insuredErr } = await supabase
          .rpc("member_insured", { p_member: memberId });
        if (insuredErr) throw insuredErr;
        if (insuredRes === true) {
          insuranceSkipped = true;
        } else if (body.insurance || body.withInsurance) {
          const { error: insErr } = await supabase
            .rpc("add_member_insurance", { p_member: memberId, p_amount: Number(body.insuranceAmount) || 0 });
          if (insErr) throw insErr;
          insuranceAdded = true;
        }

        const { data: sub, error } = await supabase.from("subscriptions").insert({
          id: subId, member_id: memberId, sub_type: subType,
          sub_start: subStart, sub_end: subEnd,
          price, paid, remaining, sub_status: subStatus, remise, remise_type: remiseType,
          pack_id: packId,
          sub_mode: body.mode || "nouvel",
          // programme / encadrement
          activity: body.activity || null,
          training_group: body.group || null,
          trainer: body.trainer || null,
          course_name: body.cours || null,
          commissions: body.commissions || {},
        }).select().single();

        if (error) throw error;

        // Link pack beneficiaries covered by this subscription (each keeps own
        // access). Only insert when the id is a real UUID (a family-pack member);
        // adhérent-names go to subscription_members below instead (a UUID cast of a
        // name would fail with a 500).
        if (packId && body.packMemberIds && Array.isArray(body.packMemberIds)) {
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          for (const mid of body.packMemberIds) {
            if (typeof mid === "string" && UUID_RE.test(mid)) {
              await supabase.from("subscription_pack_members").insert({
                subscription_id: subId, pack_member_id: mid,
              });
            }
          }
        }

        // Link selected cours (used for attendance + commission)
        if (body.coursId) {
          await supabase.from("subscription_cours").insert({
            subscription_id: subId, cours_id: body.coursId,
          });
        }

        // Store every covered member (multi-adhérents + pack beneficiaries), each
        // keeping its own profile/access. memberIds = direct adhérents,
        // packMemberIds = family-pack beneficiaries (adhérent names).
        const covered: string[] = [];
        if (Array.isArray(body.memberIds)) covered.push(...body.memberIds);
        if (Array.isArray(body.packMemberIds)) covered.push(...body.packMemberIds);
        // de-dupe
        const unique = Array.from(new Set(covered.map((m) => String(m).trim()).filter((m) => m.length > 0)));
        for (const name of unique) {
          await supabase.from("subscription_members").insert({
            subscription_id: subId, member_name: name,
          });
        }

        // Per-beneficiary Activités/Groupes/Cours (packCourses): each beneficiary
        // has its OWN selection (stored normalized).
        const pc = body.packCourses || {};
        for (const [name, sel] of Object.entries(pc)) {
          const selObj = sel as { activityIds?: string[]; groupIds?: string[]; coursIds?: string[] };
          const acts = selObj?.activityIds || [];
          const grps = selObj?.groupIds || [];
          const crss = selObj?.coursIds || [];
          if (acts.length === 0 && grps.length === 0 && crss.length === 0) continue;
          for (const activity_id of acts) {
            for (const group_id of grps) {
              const coursList = crss.length ? crss : [null];
              for (const cours_id of coursList) {
                await supabase.from("subscription_member_courses").insert({
                  subscription_id: subId, member_name: name,
                  activity_id, group_id, cours_id,
                });
              }
            }
          }
          // If only cours selected without a group, still record them
          if (acts.length === 0 && grps.length === 0) {
            for (const cours_id of crss) {
              await supabase.from("subscription_member_courses").insert({
                subscription_id: subId, member_name: name, activity_id: null, group_id: null, cours_id,
              });
            }
          }
        }

        // If paid amount > 0, add to caisse
        if (paid > 0) {
          await supabase.rpc("update_caisse", { amount_change: paid });
          await supabase.from("caisse_transactions").insert({
            type: "abonnement",
            label: `Abonnement ${subId} - ${body.subType} (${memberId})`,
            amount: paid,
            reference: subId,
            date: new Date().toLocaleDateString("fr-FR"),
          });
        }

        return new Response(JSON.stringify({ success: true, subscription: sub, insuranceSkipped, insuranceAdded }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list": {
        // Get all subscriptions joined with member names + covered members + courses
        const { data: subscriptions, error } = await supabase
          .from("subscriptions")
          .select(`*, members(name, phone),
            subscription_members(member_name),
            subscription_member_courses(activity_id, group_id, cours_id)`)
          .order("created_at", { ascending: false });
        if (error) throw error;

        // Flatten to match frontend format
        const flat = (subscriptions || []).map((s: any) => {
          const covered = (s.subscription_members || []).map((m: any) => m.member_name).filter(Boolean);
          const actIds = (s.subscription_member_courses || []).map((c: any) => c.activity_id).filter(Boolean);
          const grpIds = (s.subscription_member_courses || []).map((c: any) => c.group_id).filter(Boolean);
          const crsIds = (s.subscription_member_courses || []).map((c: any) => c.cours_id).filter(Boolean);
          return {
            id: s.id,
            member: s.members?.name || s.member_id,
            phone: s.members?.phone || "",
            type: s.sub_type,
            start: s.sub_start,
            end: s.sub_end,
            price: s.price,
            paid: s.paid,
            remaining: s.remaining,
            remise: s.remise || 0,
            remiseType: s.remise_type || "dh",
            status: s.sub_status,
            payment: "—",
            observation: "",
            activity: s.activity ?? null,
            group: s.training_group ?? null,
            cours: s.course_name ?? null,
            trainer: s.trainer ?? null,
            sub_mode: s.sub_mode ?? null,
            pack_id: s.pack_id ?? null,
            commissions: s.commissions ?? {},
            memberIds: covered,
            activityIds: [...new Set(actIds)],
            groupIds: [...new Set(grpIds)],
            coursIds: [...new Set(crsIds)],
          };
        });

        return new Response(JSON.stringify({ subscriptions: flat }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update": {
        const { id, sub_type, sub_start, sub_end, price, paid } = body;
        const remiseRaw = Number(body.remise) || 0;
        const remiseType = body.remiseType || "dh";
        const remise = remiseType === "percent"
          ? Math.min(price || 0, ((price || 0) * remiseRaw) / 100)
          : Math.min(price || 0, remiseRaw);
        const netPrice = Math.max(0, (price || 0) - remise);
        const remaining = Math.max(0, netPrice - (paid || 0));
        const sub_status = remaining === 0 ? "Payé" : (paid || 0) === 0 ? "Non payé" : "Paiement partiel";

        const { data, error } = await supabase.from("subscriptions").update({
          sub_type, sub_start, sub_end, price, paid, remaining, sub_status, remise, remise_type: remiseType,
        }).eq("id", id).select().single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, subscription: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "delete": {
        const { error } = await supabase.from("subscriptions").delete().eq("id", body.id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "prices-list": {
        // Get all subscription type prices (Tarifs des abonnements) from the DB
        const { data, error } = await supabase
          .from("subscription_types")
          .select("*")
          .order("code");
        if (error) throw error;

        const prices = (data || []).map((p: any) => ({
          code: p.code,
          name: p.name,
          duration: p.duration,
          price: Number(p.price),
          desc: p.description,
          status: p.status,
        }));

        return new Response(JSON.stringify({ prices }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "prices-update": {
        // Save subscription prices (from Paramètres → Tarifs des abonnements)
        const list = Array.isArray(body.prices) ? body.prices : (body.subscription_types || []);
        if (list.length === 0) {
          return new Response(JSON.stringify({ error: "Missing prices" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        for (const item of list) {
          const { error: upsertError } = await supabase
            .from("subscription_types")
            .upsert({
              code: item.code,
              name: item.name,
              duration: item.duration,
              price: Number(item.price) || 0,
              description: item.desc ?? item.description ?? "",
              status: item.status ?? "Actif",
              updated_at: new Date().toISOString(),
            }, { onConflict: "code" });
          if (upsertError) throw upsertError;
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});