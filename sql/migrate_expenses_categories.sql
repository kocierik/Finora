-- Migration script to update expenses to use category_id instead of category
-- This should be run after populating the categories table

-- Function to update expenses with category_id
CREATE OR REPLACE FUNCTION update_expenses_with_category_id()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  expense_record RECORD;
  category_record RECORD;
BEGIN
  -- Loop through all expenses that have a category but no category_id
  FOR expense_record IN
    SELECT id, user_id, category
    FROM public.expenses
    WHERE category IS NOT NULL 
    AND category_id IS NULL
  LOOP
    -- Find the matching category for this user
    SELECT id INTO category_record
    FROM public.categories
    WHERE user_id = expense_record.user_id
    AND LOWER(name) = LOWER(expense_record.category)
    LIMIT 1;
    
    -- Update the expense with the category_id
    IF category_record.id IS NOT NULL THEN
      UPDATE public.expenses
      SET category_id = category_record.id
      WHERE id = expense_record.id;
      
      RAISE NOTICE 'Updated expense % with category_id %', expense_record.id, category_record.id;
    ELSE
      -- If no matching category found, create a default "Other" category
      INSERT INTO public.categories (user_id, name, icon, color, sort_order)
      VALUES (expense_record.user_id, 'Other', '📦', '#10b981', 999)
      ON CONFLICT (user_id, name) DO NOTHING;
      
      -- Get the "Other" category ID
      SELECT id INTO category_record
      FROM public.categories
      WHERE user_id = expense_record.user_id
      AND LOWER(name) = 'other'
      LIMIT 1;
      
      -- Update the expense with the "Other" category_id
      IF category_record.id IS NOT NULL THEN
        UPDATE public.expenses
        SET category_id = category_record.id
        WHERE id = expense_record.id;
        
        RAISE NOTICE 'Updated expense % with default Other category_id %', expense_record.id, category_record.id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Expenses category_id migration completed successfully';
END;
$$;

-- Run the migration
SELECT update_expenses_with_category_id();

-- Clean up the function
DROP FUNCTION update_expenses_with_category_id();

-- Optional: After confirming everything works, you can drop the old category column
-- ALTER TABLE public.expenses DROP COLUMN category;
