-- ═══════════════════════════════════════════════════════════════════════════════
--  Extend accepted genders (sexe)
--  ───────────────────────────────────────────────────────────────────────────────
--  "Ajouter un adhérent" now offers Homme / Femme / Garçon / Fille (Boy / Girl).
--  The members.gender column is a free VARCHAR, so the edge function stores any
--  value as-is. The only DB CHECK that would reject the new values is the one on
--  family_pack_members.gender — relax it so pack beneficiaries accept them too.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE family_pack_members DROP CONSTRAINT IF EXISTS family_pack_members_gender_check;
ALTER TABLE family_pack_members
  ADD CONSTRAINT family_pack_members_gender_check
  CHECK (gender IN ('', 'Homme', 'Femme', 'Garçon', 'Fille'));