-- ═══════════════════════════════════════════════════════════════════════════════
--  Fix :32768 — insurance RPCs must tolerate BOTH date formats
--  ───────────────────────────────────────────────────────────────────────────────
--  The live member_insurance.end_date is a DATE (returns ISO YYYY-MM-DD), while
--  older/seed rows were written as DD/MM/YYYY. to_date(x,'DD/MM/YYYY') fails with
--  "date/time field value out of range" when x is ISO. Make the checks tolerant
--  and have add_member_insurance write ISO (safe for DATE or VARCHAR columns).
-- ═══════════════════════════════════════════════════════════════════════════════

-- Write ISO (YYYY-MM-DD): DATE stores as-native; VARCHAR keeps a DATE-compatible string.
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
          to_char(d_start, 'YYYY-MM-DD'),
          to_char(d_end,  'YYYY-MM-DD'));
  RETURN QUERY SELECT mi.id, mi.member_id, mi.start_date, mi.end_date
               FROM member_insurance mi WHERE mi.id = n_id;
END;
$$;

-- Read tolerant of ISO and DD/MM/YYYY.
CREATE OR REPLACE FUNCTION member_insured(p_member VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  today DATE := CURRENT_DATE;
  d DATE;
  r RECORD;
BEGIN
  FOR r IN SELECT mi.end_date FROM member_insurance mi WHERE mi.member_id = p_member
  LOOP
    BEGIN
      IF r.end_date ~ E'^[0-9]{4}-' THEN
        d := r.end_date::DATE;                 -- YYYY-MM-DD
      ELSE
        d := to_date(r.end_date, 'DD/MM/YYYY');-- DD/MM/YYYY
      END IF;
      IF d >= today THEN
        RETURN TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ignore malformed rows
    END;
  END LOOP;
  RETURN FALSE;
END;
$$;