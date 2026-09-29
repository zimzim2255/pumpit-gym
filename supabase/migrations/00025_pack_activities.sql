-- ═══════════════════════════════════════════════════════════════════════════════
--  Pack activities (injected activities shown in "Créer abonnement" → section 3)
--  ───────────────────────────────────────────────────────────────────────────────
--  A family pack can carry a list of activity ids ("activities"). When that pack
--  is chosen in the subscription form, section "3. Activites, Groupes / Cours"
--  only shows the activities selected on the pack (so the pack drives which
--  activities are available to the beneficiaries).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE family_packs
  ADD COLUMN IF NOT EXISTS activities JSONB NOT NULL DEFAULT '[]';