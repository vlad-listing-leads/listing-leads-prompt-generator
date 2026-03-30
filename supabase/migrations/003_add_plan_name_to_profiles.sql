-- Add plan_name column to profiles for caching the resolved plan name from LL
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_name TEXT;
