-- ═══════════════════════════════════════════════════════════════════════════════
--  Groups / Activities / Trainers / Commission
--  ───────────────────────────────────────────────────────────────────────────────
--  PORT of the TouptiGym activity/trainer concepts into THIS mix project,
--  ADAPTED for a mixed gym (NOT the kids program, NO parents).
--    * ACTIVITY (Activité)  = a discipline, EACH with its OWN price.
--    * GROUP (Groupe)       = a group/slot inside an activity.
--    * TRAINER (Entraîneur) = a coach with a photo + specialty.
--    * GROUP_TRAINERS       = the trainer(s) assigned to a group + their
--                             COMMISSION for that group (trainer is paid by
--                             the commission of each group they're assigned to).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Activities ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Autre',        -- Football/Basketball/.../Autre
  price DECIMAL(10,2) NOT NULL DEFAULT 0,            -- each activity has its own price
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Actif' CHECK (status IN ('Actif','Inactif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_name ON activities(name);

-- ── Groups ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  description TEXT,                                  -- optional JSON list of group items
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_groups_activity ON groups(activity_id);

-- ── Trainers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(150),
  photo VARCHAR(500),
  specialty VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trainers_name ON trainers(name);

-- ── Group × Trainer (assignment + commission) ──────────────────────────────────
-- The trainer is paid a COMMISSION of every group they've been assigned to.
CREATE TABLE IF NOT EXISTS group_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  commission_type VARCHAR(20) NOT NULL DEFAULT 'percent'
    CHECK (commission_type IN ('percent','fixed_amount')),
  commission_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, trainer_id)
);
CREATE INDEX IF NOT EXISTS idx_group_trainers_trainer ON group_trainers(trainer_id);
CREATE INDEX IF NOT EXISTS idx_group_trainers_group ON group_trainers(group_id);