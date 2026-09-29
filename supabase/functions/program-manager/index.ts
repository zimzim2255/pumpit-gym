// ═══════════════════════════════════════════════════════════════════════════════
//  Program Manager - Edge Function
//  ───────────────────────────────────────────────────────────────────────────────
//  CRUD for the NEW mix-project features (migrations 00013 + 00014):
//    * ACTIVITIES        - disciplines, EACH with its own price
//    * GROUPS            - a group/slot inside an activity
//    * TRAINERS          - coaches (photo + specialty)
//    * GROUP_TRAINERS    - trainer assignment + per-group COMMISSION
//    * FAMILY_PACKS + FAMILY_PACK_MEMBERS - multi-person packs
//    * MEMBER_INSURANCE  - paid once, end = start + 365 days
//
//  Goes through the connected Supabase project (env-driven keys). No hardcoding.
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

  const ok = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();

    switch (body.type) {
      // ── ACTIVITIES ─────────────────────────────────────────────
      case "activities-list": {
        const { data, error } = await supabase.from("activities").select("*").order("name");
        if (error) throw error;
        return ok({ activities: data });
      }
      case "activities-create": {
        if (!body.name) return ok({ error: "Missing name" }, 400);
        const { data, error } = await supabase.from("activities").insert({
          name: body.name, type: body.type || "Autre",
          price: Number(body.price) || 0, description: body.description || "",
        }).select().single();
        if (error) throw error;
        return ok({ activity: data });
      }
      case "activities-update": {
        const { data, error } = await supabase.from("activities").update({
          name: body.name, type: body.type, price: Number(body.price) || 0,
          description: body.description, status: body.status,
        }).eq("id", body.id).select().single();
        if (error) throw error;
        return ok({ activity: data });
      }
      case "activities-delete": {
        const { error } = await supabase.from("activities").delete().eq("id", body.id);
        if (error) throw error;
        return ok({ success: true });
      }

      // ── GROUPS ─────────────────────────────────────────────────
      case "groups-list": {
        const q = supabase.from("groups").select("*, activities(name, price)");
        if (body.activityId) q.eq("activity_id", body.activityId);
        const { data, error } = await q.order("name");
        if (error) throw error;
        return ok({ groups: data });
      }
      case "groups-create": {
        if (!body.name) return ok({ error: "Missing name" }, 400);
        const { data, error } = await supabase.from("groups").insert({
          name: body.name, activity_id: body.activityId || null, description: body.description || "",
        }).select().single();
        if (error) throw error;
        return ok({ group: data });
      }
      case "groups-update": {
        const { data, error } = await supabase.from("groups").update({
          name: body.name, activity_id: body.activityId, description: body.description,
        }).eq("id", body.id).select().single();
        if (error) throw error;
        return ok({ group: data });
      }
      case "groups-delete": {
        const { error } = await supabase.from("groups").delete().eq("id", body.id);
        if (error) throw error;
        return ok({ success: true });
      }

      // ── TRAINERS ───────────────────────────────────────────────
      case "trainers-list": {
        const { data: trainers, error: e1 } = await supabase.from("trainers").select("*").order("name");
        if (e1) throw e1;
        const { data: gts, error: e2 } = await supabase
          .from("group_trainers").select("*, groups(name), group_id");
        if (e2) throw e2;
        const byTrainer = new Map<string, any[]>();
        for (const gt of gts || []) {
          const arr = byTrainer.get(gt.trainer_id) || [];
          arr.push({ groupId: gt.group_id, groupName: gt.groups?.name, commissionType: gt.commission_type, commissionValue: gt.commission_value });
          byTrainer.set(gt.trainer_id, arr);
        }
        const out = (trainers || []).map((t: any) => ({ ...t, items: byTrainer.get(t.id) || [] }));
        return ok({ trainers: out });
      }
      case "trainers-create": {
        if (!body.name) return ok({ error: "Missing name" }, 400);
        const { data, error } = await supabase.from("trainers").insert({
          name: body.name, phone: body.phone || "", email: body.email || "",
          photo: body.photo || "", specialty: body.specialty || "",
        }).select().single();
        if (error) throw error;
        return ok({ trainer: data });
      }
      case "trainers-update": {
        const { data, error } = await supabase.from("trainers").update({
          name: body.name, phone: body.phone, email: body.email, photo: body.photo, specialty: body.specialty,
        }).eq("id", body.id).select().single();
        if (error) throw error;
        return ok({ trainer: data });
      }
      case "trainers-delete": {
        const { error } = await supabase.from("trainers").delete().eq("id", body.id);
        if (error) throw error;
        return ok({ success: true });
      }

      // ── GROUP × TRAINER commissions ────────────────────────────
      case "groups-assign": {
        const { data, error } = await supabase.from("group_trainers").upsert({
          group_id: body.groupId, trainer_id: body.trainerId,
          commission_type: body.commissionType || "percent",
          commission_value: Number(body.commissionValue) || 0,
        }, { onConflict: "group_id,trainer_id" }).select().single();
        if (error) throw error;
        return ok({ assignment: data });
      }
      case "groups-unassign": {
        const { error } = await supabase.from("group_trainers")
          .delete().eq("group_id", body.groupId).eq("trainer_id", body.trainerId);
        if (error) throw error;
        return ok({ success: true });
      }

      // ── FAMILY PACKS ───────────────────────────────────────────
      case "packs-list": {
        const { data: packs, error: e1 } = await supabase.from("family_packs").select("*").order("name");
        if (e1) throw e1;
        const { data: members, error: e2 } = await supabase.from("family_pack_members").select("*");
        if (e2) throw e2;
        const byPack = new Map<string, any[]>();
        for (const m of members || []) {
          const arr = byPack.get(m.pack_id) || [];
          arr.push(m); byPack.set(m.pack_id, arr);
        }
        const out = (packs || []).map((p: any) => ({ ...p, members: byPack.get(p.id) || [] }));
        return ok({ packs: out });
      }
      case "packs-create": {
        if (!body.name) return ok({ error: "Missing name" }, 400);
        const { data, error } = await supabase.from("family_packs").insert({
          name: body.name, price: Number(body.price) || 0, photo: body.photo || "",
          max_beneficiaries: Number(body.max_beneficiaries) || 3,
          duration: body.duration || "",
          status: body.status || "Actif",
          pack_type: (body.pack_type === "plus1") ? "plus1" : "familial",
          activities: Array.isArray(body.activities) ? body.activities : [],
        }).select().single();
        if (error) throw error;
        if (Array.isArray(body.members)) {
          for (const m of body.members) {
            const { error: me } = await supabase.from("family_pack_members").insert({
              pack_id: data.id, name: m.name, photo: m.photo || "", gender: m.gender || "",
              age: m.age, zkteco_id: m.zktecoId || m.zkteco_id || null,
            });
            if (me) throw me;
          }
        }
        return ok({ pack: data });
      }
      case "packs-update": {
        const { data, error } = await supabase.from("family_packs").update({
          name: body.name, price: Number(body.price) || 0, status: body.status, photo: body.photo || "",
          max_beneficiaries: Number(body.max_beneficiaries) || 3,
          duration: body.duration || "",
          pack_type: (body.pack_type === "plus1") ? "plus1" : "familial",
          activities: Array.isArray(body.activities) ? body.activities : [],
        }).eq("id", body.id).select().single();
        if (error) throw error;
        return ok({ pack: data });
      }
      case "packs-delete": {
        const { error } = await supabase.from("family_packs").delete().eq("id", body.id);
        if (error) throw error;
        return ok({ success: true });
      }

      // ── PACK MEMBERS ───────────────────────────────────────────
      case "pack-members-add": {
        const { data, error } = await supabase.from("family_pack_members").insert({
          pack_id: body.packId, name: body.name, photo: body.photo || "",
          gender: body.gender || "", age: body.age, zkteco_id: body.zktecoId || body.zkteco_id || null,
        }).select().single();
        if (error) throw error;
        return ok({ member: data });
      }
      case "pack-members-update": {
        const { data, error } = await supabase.from("family_pack_members").update({
          name: body.name, photo: body.photo, gender: body.gender,
          age: body.age, zkteco_id: body.zktecoId || body.zkteco_id,
        }).eq("id", body.id).select().single();
        if (error) throw error;
        return ok({ member: data });
      }
      case "pack-members-delete": {
        const { error } = await supabase.from("family_pack_members").delete().eq("id", body.id);
        if (error) throw error;
        return ok({ success: true });
      }

      // ── INSURANCE ──────────────────────────────────────────────
      case "insurance-status": {
        const r = await supabase.rpc("member_insured", { p_member: body.memberId });
        const { data } = await supabase.from("member_insurance")
          .select("end_date").eq("member_id", body.memberId)
          .order("end_date", { ascending: false }).limit(1).maybeSingle();
        if (r.error) throw r.error;
        return ok({ memberId: body.memberId, insured: r.data === true, end_date: data?.end_date || null });
      }
      case "insurance-list": {
        const { data, error } = await supabase.from("member_insurance")
          .select("*").eq("member_id", body.memberId).order("paid_at", { ascending: true });
        if (error) throw error;
        return ok({ insurance: data });
      }
      // Create a new insurance (paid once, end = now + 365 days)
      case "insurance-add": {
        if (!body.memberId) return ok({ error: "Missing memberId" }, 400);
        const start = body.start || new Date().toISOString().slice(0, 10);
        const end = body.end || new Date(new Date(start).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data, error } = await supabase.from("member_insurance").insert({
          member_id: body.memberId, paid_amount: Number(body.paidAmount) || Number(body.premium) || 0,
          start_date: start, end_date: end,
        }).select().single();
        if (error) throw error;
        return ok({ insurance: data });
      }

      // All insurances joined with member names (for the Assurance interface)
      case "insurance-all": {
        const { data, error } = await supabase.from("member_insurance")
          .select("*")
          .order("paid_at", { ascending: false });
        if (error) throw error;
        // member_insurance.member_id has no FK to members, so fetch names separately.
        const ids = (data || []).map((row: any) => row.member_id).filter(Boolean);
        const nameById = new Map<string, any>();
        if (ids.length) {
          const { data: members, error: me } = await supabase.from("members")
            .select("id, name, phone").in("id", ids);
          if (!me) (members || []).forEach((m: any) => nameById.set(m.id, m));
        }
        const flat = (data || []).map((row: any) => {
          const m = nameById.get(row.member_id) || {};
          return {
            id: row.id,
            memberId: row.member_id,
            member: m.name || row.member_id,
            phone: m.phone || "",
            amount: Number(row.paid_amount || 0),
            start: row.start_date,
            end: row.end_date,
            createdAt: row.created_at,
          };
        });
        return ok({ insurance: flat });
      }

      // ── COURS ─────────────────────────────────────────────────
      case "cours-list": {
        const { data, error } = await supabase.from("cours")
          .select("*, activities(name, price), groups(name), trainers(name)")
          .order("day");
        if (error) throw error;
        return ok({ cours: data });
      }
      case "cours-create": {
        if (!body.day) return ok({ error: "Missing day" }, 400);
        const { data, error } = await supabase.from("cours").insert({
          activity_id: body.activityId || null, group_id: body.groupId || null,
          trainer_id: body.trainerId || null, name: body.name || "",
          day: body.day, start_time: body.startTime || "", end_time: body.endTime || "",
          room: body.room || "", capacity: Number(body.capacity) || 0,
          commission_type: body.commissionType || "percent",
          commission_value: Number(body.commissionValue) || 0,
        }).select().single();
        if (error) throw error;
        return ok({ cours: data });
      }
      case "cours-update": {
        const { data, error } = await supabase.from("cours").update({
          activity_id: body.activityId, group_id: body.groupId, trainer_id: body.trainerId,
          name: body.name, day: body.day, start_time: body.startTime, end_time: body.endTime,
          room: body.room, capacity: Number(body.capacity), status: body.status,
          commission_type: body.commissionType || "percent",
          commission_value: Number(body.commissionValue) || 0,
        }).eq("id", body.id).select().single();
        if (error) throw error;
        return ok({ cours: data });
      }
      case "cours-delete": {
        const { error } = await supabase.from("cours").delete().eq("id", body.id);
        if (error) throw error;
        return ok({ success: true });
      }

      default:
        return ok({ error: "Invalid type" }, 400);
    }
  } catch (error) {
    return ok({ error: error.message }, 500);
  }
});