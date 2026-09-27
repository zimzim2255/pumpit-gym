-- ═══════════════════════════════════════════════════════════════════════════════
--  Fix: subscriptions.pack_id must store STRING pack ids
--  ───────────────────────────────────────────────────────────────────────────────
--  The app's family packs are produced by program-manager/localStorage with
--  STRING ids like "p_1790445606236" (same model as activités/groups/cours,
--  which are VARCHAR). Migrations 00014 typed pack_id as UUID with an FK to
--  family_packs(id) — that fails at insert because the value is not a UUID.
--  Convert pack_id to VARCHAR and drop the FK (the pack record itself lives in
--  the app's programme store, not in family_packs).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_pack_id_fkey;
ALTER TABLE subscriptions ALTER COLUMN pack_id TYPE VARCHAR(100);
DROP INDEX IF EXISTS idx_subscriptions_pack;