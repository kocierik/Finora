-- Migration: Add monitored_banks column to profiles table
-- This stores the array of bank IDs the user wants to monitor for notifications

-- Add the column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS monitored_banks JSONB DEFAULT '["google_wallet"]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.monitored_banks IS 'Array of bank IDs to monitor for payment notifications (e.g. ["google_wallet", "revolut", "mediolanum"])';

-- Add constraint to ensure it's an array
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_monitored_banks_is_array
    CHECK (jsonb_typeof(monitored_banks) = 'array');
  EXCEPTION WHEN duplicate_object THEN
    -- constraint already exists
    NULL;
  END;
END $$;

-- Create index for efficient querying (optional, for future analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_monitored_banks
ON public.profiles
USING gin (monitored_banks jsonb_path_ops);

