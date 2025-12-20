-- Migration script to populate categories table from profiles.categories_config
-- This should be run after creating the categories table

-- Function to migrate categories from profiles to categories table
CREATE OR REPLACE FUNCTION migrate_categories_from_profiles()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  profile_record RECORD;
  category_item JSONB;
  category_id UUID;
  sort_order_counter INTEGER;
BEGIN
  -- Loop through all profiles that have categories_config
  FOR profile_record IN
    SELECT id, categories_config
    FROM public.profiles
    WHERE categories_config IS NOT NULL 
    AND jsonb_typeof(categories_config) = 'array'
    AND jsonb_array_length(categories_config) > 0
  LOOP
    sort_order_counter := 0;
    
    -- Loop through each category in the categories_config
    FOR category_item IN
      SELECT * FROM jsonb_array_elements(profile_record.categories_config)
    LOOP
      -- Insert category into categories table
      INSERT INTO public.categories (
        user_id,
        name,
        icon,
        color,
        sort_order
      ) VALUES (
        profile_record.id,
        COALESCE(category_item->>'name', category_item->>'key', 'Other'),
        COALESCE(category_item->>'icon', '📦'),
        COALESCE(category_item->>'color', '#10b981'),
        sort_order_counter
      )
      ON CONFLICT (user_id, name) DO NOTHING; -- Avoid duplicates
      
      sort_order_counter := sort_order_counter + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Categories migration completed successfully';
END;
$$;

-- Run the migration
SELECT migrate_categories_from_profiles();

-- Clean up the function
DROP FUNCTION migrate_categories_from_profiles();

-- Optional: Update expenses to use category_id instead of category
-- This will be done in the application code to handle the migration properly
