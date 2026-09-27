-- ═══════════════════════════════════════════════════════════════════════════════
--  Subscription members + per-member courses (activités/groupes/cours)
--  ───────────────────────────────────────────────────────────────────────────────
--  One abonnement can cover MULTIPLE adhérents (direct or via a family pack).
--  Each beneficiary keeps its OWN "Activités, Groupes & Cours" selection.
--  * subscription_members        : the adhérents covered by this abonnement
--  * subscription_member_courses : per-adhérent selected activity/group/cours
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscription_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR(50) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  member_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, member_name)
);
CREATE INDEX IF NOT EXISTS idx_sub_members_sub ON subscription_members(subscription_id);

CREATE TABLE IF NOT EXISTS subscription_member_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR(50) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  member_name VARCHAR(255) NOT NULL,
  activity_id VARCHAR(50),
  group_id VARCHAR(50),
  cours_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, member_name, activity_id, group_id, cours_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_member_courses_sub ON subscription_member_courses(subscription_id);

-- Store the abonnement mode (nouvel / reabonnement)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS sub_mode VARCHAR(20) DEFAULT 'nouvel';