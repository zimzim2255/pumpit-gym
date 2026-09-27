-- ═══════════════════════════════════════════════════════════════════════════════
--  Move coach commission to the COURS (Créer une Activité)
--  ───────────────────────────────────────────────────────────────────────────────
--  The coach commission used to be typed per abonnement. Now it is defined at
--  creation on the cours (Créer une Activité) for each coach/slot, so it stays
--  with the cours and flows automatically into the abonnement + coaches page.
--  Reuses the same convention as group_trainers: type percent | fixed_amount.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE cours
  ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20) NOT NULL DEFAULT 'percent'
    CHECK (commission_type IN ('percent', 'fixed_amount')),
  ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2) NOT NULL DEFAULT 0;