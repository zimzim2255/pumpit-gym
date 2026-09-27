-- ═══════════════════════════════════════════════════════════════════════════════
--  Per-abonnement trainer commissions
--  ───────────────────────────────────────────────────────────────────────────────
--  The coach's commission is defined PER ABONNEMENT (set when the coach is
--  assigned to a cours in the abonnement), NOT on the coach's profile.
--  Stored as a JSONB map keyed by cours id:
--    { "<coursId>": { "percent": <int>, "amount": <int DH> } }
--  The CoachesPage aggregates these per-subscription to show, per abonnement,
--  the commission earned and the coach's running total.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS commissions JSONB NOT NULL DEFAULT '{}'::jsonb;