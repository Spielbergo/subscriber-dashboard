-- Add first-touch and signup-touch attribution columns to profiles.
-- Run this in Supabase Dashboard > SQL Editor.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_touch_source text,
ADD COLUMN IF NOT EXISTS signup_touch_source text,
ADD COLUMN IF NOT EXISTS signup_utm_source text,
ADD COLUMN IF NOT EXISTS signup_utm_medium text,
ADD COLUMN IF NOT EXISTS signup_utm_campaign text,
ADD COLUMN IF NOT EXISTS signup_utm_content text,
ADD COLUMN IF NOT EXISTS signup_utm_term text,
ADD COLUMN IF NOT EXISTS signup_referrer text;

-- Helpful indexes for common attribution queries.
CREATE INDEX IF NOT EXISTS idx_profiles_first_touch_source ON profiles(first_touch_source);
CREATE INDEX IF NOT EXISTS idx_profiles_signup_touch_source ON profiles(signup_touch_source);
CREATE INDEX IF NOT EXISTS idx_profiles_signup_utm_source ON profiles(signup_utm_source);
