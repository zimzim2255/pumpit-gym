-- ═══════════════════════════════════════════════════════════════════════════════
--  Pack type (familial | plus1)
--  ───────────────────────────────────────────────────────────────────────────────
--  Two kinds of packs:
--    * "familial"  : a family pack covering up to 3 beneficiaries.
--    * "plus1"     : a single-person pack (exactly 1 beneficiary).
--  The "Bénéficiaires max" in the creation form is locked to 1 for "plus1".
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE family_packs
  ADD COLUMN IF NOT EXISTS pack_type VARCHAR(20) NOT NULL DEFAULT 'familial';