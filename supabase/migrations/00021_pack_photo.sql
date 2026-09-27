-- ═══════════════════════════════════════════════════════════════════════════════
--  Family pack photo (browsable image shown in Packs page)
--  ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE family_packs
  ADD COLUMN IF NOT EXISTS photo VARCHAR(500);