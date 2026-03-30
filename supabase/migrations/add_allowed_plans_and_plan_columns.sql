-- Add active_plan_ids and is_team_member columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_plan_ids TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_team_member BOOLEAN DEFAULT FALSE;

-- Update role CHECK constraint to include superadmin
-- (drop existing constraint if it exists, then re-add)
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'superadmin'));

-- Create allowed_plans table
CREATE TABLE IF NOT EXISTS allowed_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memberstack_plan_id TEXT UNIQUE NOT NULL,
  plan_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for allowed_plans
ALTER TABLE allowed_plans ENABLE ROW LEVEL SECURITY;

-- Admins can manage allowed_plans (full CRUD)
CREATE POLICY "Admins can manage allowed_plans"
  ON allowed_plans FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'superadmin')
  ));

-- Authenticated users can read allowed_plans (for plan gate check)
CREATE POLICY "Authenticated users can read allowed_plans"
  ON allowed_plans FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create is_admin() helper function if it doesn't exist
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
