-- Add session code fields to private_sessions
ALTER TABLE private_sessions 
  ADD COLUMN IF NOT EXISTS session_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS session_name TEXT NOT NULL DEFAULT 'Revision Session',
  ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 hour');

-- Drop the invite_id column since we're removing the invite system
ALTER TABLE private_sessions DROP COLUMN IF EXISTS invite_id;

-- Create an index on session_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_code ON private_sessions(session_code);

-- Create a function to generate unique 5-character session codes
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate a random 5-character alphanumeric code
    code := upper(substring(md5(random()::text) from 1 for 5));
    
    -- Check if it already exists
    SELECT COUNT(*) INTO exists_check 
    FROM private_sessions 
    WHERE session_code = code;
    
    -- If unique, return it
    IF exists_check = 0 THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Fix the incorrect RLS policy on private_sessions
DROP POLICY IF EXISTS "Users can view their sessions" ON private_sessions;
CREATE POLICY "Users can view their sessions" ON private_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = private_sessions.id AND sp.user_id = auth.uid()
    )
  );

-- Update the session participants policy
DROP POLICY IF EXISTS "Session participants can update sessions" ON private_sessions;
CREATE POLICY "Session participants can update sessions" ON private_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = private_sessions.id AND sp.user_id = auth.uid()
    )
  );

-- Allow users to create sessions
DROP POLICY IF EXISTS "Users can create sessions" ON private_sessions;
CREATE POLICY "Users can create sessions" ON private_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create a trigger to automatically set session_code on insert if not provided
CREATE OR REPLACE FUNCTION set_session_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_code IS NULL THEN
    NEW.session_code := generate_session_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_session_code_trigger ON private_sessions;
CREATE TRIGGER set_session_code_trigger
  BEFORE INSERT ON private_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_session_code();