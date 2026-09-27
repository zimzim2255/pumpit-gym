-- ═══════════════════════════════════════════════════════════════════════════════
--  Subscription remise type (percent | dh)
--  ───────────────────────────────────────────────────────────────────────────────
--  The remise value can be a fixed amount (DH) or a percentage of the price.
--  The resolved remise amount is always stored in the `remise` DECIMAL column;
--  `remise_type` records how the user entered it.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS remise_type VARCHAR(10) NOT NULL DEFAULT 'dh';