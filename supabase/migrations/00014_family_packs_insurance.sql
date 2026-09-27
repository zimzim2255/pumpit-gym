-- ═══════════════════════════════════════════════════════════════════════════════
--  Family Packs + Insurance
--  ───────────────────────────────────────────────────────────────────────────────
--  * FAMILY_PACKS         = a package that covers MULTIPLE people at once, with
--                           its OWN price.
--  * FAMILY_PACK_MEMBERS  = each person in the pack: name, photo, gender, age,
--                           zkteco_id (so each one can use the door).
--  * MEMBER_INSURANCE     = insurance is paid ONCE per year per member. On renewal
--                           it is skipped if a valid (still-active) insurance row
--                           exists. end_date is always start + 365 days.
--  * subscriptions        += optional pack_id => a subscription can cover a full
--                           family pack and/or a single member (multi-member).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Family Packs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,            -- each pack has its own price
  status VARCHAR(20) NOT NULL DEFAULT 'Actif' CHECK (status IN ('Actif','Inactif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_family_packs_name ON family_packs(name);

-- ── Pack members (multi-person; each links to the biometric door) ──────────────
CREATE TABLE IF NOT EXISTS family_pack_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES family_packs(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  photo VARCHAR(500),
  gender VARCHAR(10) NOT NULL DEFAULT '' CHECK (gender IN ('','Homme','Femme')),
  age INT,
  zkteco_id VARCHAR(50),                              -- device PIN; NULL allowed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_pack_members_zkteco ON family_pack_members(zkteco_id)
  WHERE zkteco_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pack_members_pack ON family_pack_members(pack_id);

-- ── Member / Normal-user insurance ─────────────────────────────────────────────
-- One row per insurance payment. end_date is always start + 365 days.
-- A member is "insured" while an active row with end_date >= today exists.
CREATE TABLE IF NOT EXISTS member_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id VARCHAR(50) NOT NULL,                       -- matches members.id
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  start_date VARCHAR(10) NOT NULL,                      -- DD/MM/YYYY
  end_date VARCHAR(10) NOT NULL,                        -- DD/MM/YYYY (start + 365)
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_insurance_member ON member_insurance(member_id);

-- ── Extend subscriptions: allow covering a family pack (multi-member) ──────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS pack_id UUID REFERENCES family_packs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_pack ON subscriptions(pack_id) WHERE pack_id IS NOT NULL;

-- ── Helpers ─────────────────────────────────────────────────────────────────────
-- Given a member id + a payment date, insert insurance = start→start+365 days.
CREATE OR REPLACE FUNCTION add_member_insurance(p_member VARCHAR(50), p_amount DECIMAL)
RETURNS TABLE (id UUID, member_id VARCHAR, start_date VARCHAR, end_date VARCHAR)
LANGUAGE plpgsql AS $$
DECLARE
  d_start DATE := CURRENT_DATE;
  d_end DATE := CURRENT_DATE + 365;
  n_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO member_insurance (id, member_id, paid_amount, start_date, end_date)
  VALUES (n_id, p_member, p_amount,
          to_char(d_start, 'DD/MM/YYYY'),
          to_char(d_end,  'DD/MM/YYYY'));
  RETURN QUERY SELECT mi.id, mi.member_id, mi.start_date, mi.end_date
               FROM member_insurance mi WHERE mi.id = n_id;
END;
$$;

-- Return TRUE if the member still has a valid insurance (end_date >= today).
CREATE OR REPLACE FUNCTION member_insured(p_member VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM member_insurance mi
    WHERE mi.member_id = p_member
      AND to_date(mi.end_date, 'DD/MM/YYYY') >= today
  );
END;
$$;