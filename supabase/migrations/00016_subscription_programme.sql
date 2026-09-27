-- ═══════════════════════════════════════════════════════════════════════════════
--  Subscriptions: programme / encadrement columns
--  ───────────────────────────────────────────────────────────────────────────────
--  Stores the activity / group / trainer / selected course label chosen at the
--  time the abonnement is created (denormalized for display + attendance).
--  Also exposes a helper to resolve the pack beneficiaries of a subscription.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS activity VARCHAR(150),
  ADD COLUMN IF NOT EXISTS training_group VARCHAR(150),
  ADD COLUMN IF NOT EXISTS trainer VARCHAR(150),
  ADD COLUMN IF NOT EXISTS course_name VARCHAR(150);

-- Resolve all ZKTeco IDs covered by a subscription (single member + pack members)
CREATE OR REPLACE FUNCTION subscription_access_ids(p_sub VARCHAR(255))
RETURNS TABLE(access_id VARCHAR(30)) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT m.id AS access_id
    FROM members m
    WHERE m.id = p_sub OR m.id IN (
      SELECT mm.id
      FROM family_pack_members mm
      JOIN subscription_pack_members spm ON spm.pack_member_id = mm.id
      WHERE spm.subscription_id = p_sub
    );
END;
$$;