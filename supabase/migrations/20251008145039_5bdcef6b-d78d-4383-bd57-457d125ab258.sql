-- Drop trigger first, then recreate functions with proper search_path
DROP TRIGGER IF EXISTS set_session_code_trigger ON private_sessions;
DROP FUNCTION IF EXISTS set_session_code();
DROP FUNCTION IF EXISTS generate_session_code();

-- Recreate with proper security settings
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text) from 1 for 5));
    
    SELECT COUNT(*) INTO exists_check 
    FROM private_sessions 
    WHERE session_code = code;
    
    IF exists_check = 0 THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION set_session_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_code IS NULL THEN
    NEW.session_code := generate_session_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER set_session_code_trigger
  BEFORE INSERT ON private_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_session_code();