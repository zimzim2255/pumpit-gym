-- ═══════════════════════════════════════════════════════════════════════════════
--  Cours & Planning + Pack fields + subscription⇄cours
--  ───────────────────────────────────────────────────────────────────────────────
--  Completes the mix-project data model per the cahier des charges:
--    * COURS          = a scheduled session: activity + group + trainer + day +
--                       start/end time + room + capacity.
--    * PACKS          gain duration / description / max_beneficiaries.
--    * SUBSCRIPTIONS  gain pack-beneficiaries link + selected courses
--                      (subscription_cours) for attendance + commission.
--  Packs are OFFERS; each beneficiary keeps their OWN access but shares the
--  same subscription. Each person is CHARGED INDIVIDUALLY (per the client).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Extend family_packs with offer fields ──────────────────────────────────────
ALTER TABLE family_packs
  ADD COLUMN IF NOT EXISTS duration VARCHAR(30),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS max_beneficiaries INT;

-- ── Pack ⇄ beneficiaries covered by one subscription ───────────────────────────
CREATE TABLE IF NOT EXISTS subscription_pack_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR(50) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  pack_member_id UUID NOT NULL REFERENCES family_pack_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, pack_member_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_pack_member_sub ON subscription_pack_members(subscription_id);

-- ── Cours (scheduled sessions) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  name VARCHAR(150),
  day VARCHAR(20) NOT NULL,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  start_date VARCHAR(10),
  end_date VARCHAR(10),
  room VARCHAR(100),
  capacity INT,
  status VARCHAR(20) NOT NULL DEFAULT 'Actif' CHECK (status IN ('Actif','Inactif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cours_day ON cours(day);
CREATE INDEX IF NOT EXISTS idx_cours_trainer ON cours(trainer_id);
CREATE INDEX IF NOT EXISTS idx_cours_group ON cours(group_id);

-- ── Subscription ⇄ selected cours ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_cours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR(50) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  cours_id UUID NOT NULL REFERENCES cours(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, cours_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_cours_sub ON subscription_cours(subscription_id);