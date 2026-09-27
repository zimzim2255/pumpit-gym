-- ═══════════════════════════════════════════════════════════════════════════════
--  Subscription remise (discount) — applies to the base price, NOT insurance
--  ───────────────────────────────────────────────────────────────────────────────
--  A remise reduces the abonnement price. It is applied only to the amount
--  WITHOUT insurance (total = price - remise + assurance).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS remise DECIMAL(10,2) NOT NULL DEFAULT 0;