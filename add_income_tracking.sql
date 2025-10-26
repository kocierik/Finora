-- =====================================================
-- INCOME TRACKING SETUP FOR FINORA
-- =====================================================

-- 1. Aggiungi campo monthly_income alla tabella profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_income NUMERIC DEFAULT NULL;

-- Aggiungi commento per documentazione
COMMENT ON COLUMN public.profiles.monthly_income IS 'Monthly income amount in user currency for financial calculations';

-- 2. Crea tabella incomes per tracciamento dettagliato
CREATE TABLE IF NOT EXISTS public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  source text, -- "salary", "freelance", "investment", "bonus", "other"
  category text DEFAULT 'work', -- "work", "passive", "investment", "other"
  currency text DEFAULT 'EUR',
  date date NOT NULL,
  description text,
  -- Supporto per entrate ricorrenti
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_group_id text,
  recurring_frequency text, -- "monthly", "weekly", "yearly"
  recurring_total_occurrences integer,
  recurring_index integer,
  recurring_infinite boolean NOT NULL DEFAULT false,
  recurring_stopped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Crea indici per performance
CREATE INDEX IF NOT EXISTS incomes_user_date_idx ON public.incomes(user_id, date);
CREATE INDEX IF NOT EXISTS incomes_user_category_idx ON public.incomes(user_id, category);
CREATE INDEX IF NOT EXISTS incomes_recurring_group_idx ON public.incomes(recurring_group_id);

-- 4. Abilita Row Level Security
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

-- 5. Crea policy RLS
CREATE POLICY "Users can view own incomes" ON public.incomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own incomes" ON public.incomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incomes" ON public.incomes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own incomes" ON public.incomes
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Crea trigger per updated_at
CREATE OR REPLACE FUNCTION public.handle_incomes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_incomes_updated_at
  BEFORE UPDATE ON public.incomes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_incomes_updated_at();

-- 7. Funzione per generare entrate ricorrenti (simile a expenses)
CREATE OR REPLACE FUNCTION public.generate_recurring_incomes(horizon_days integer DEFAULT 60)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  horizon_date date := (CURRENT_DATE + make_interval(days => horizon_days))::date;
  rec RECORD;
  target_count integer;
  existing_count integer;
  i integer;
  next_date date;
BEGIN
  -- Iterate each recurring income group that is not stopped
  FOR rec IN
    SELECT DISTINCT ON (i.recurring_group_id)
      i.recurring_group_id,
      i.user_id,
      i.amount,
      i.source,
      i.category,
      i.currency,
      i.description,
      i.date AS start_date,
      i.recurring_frequency,
      i.recurring_total_occurrences,
      i.recurring_infinite
    FROM public.incomes i
    WHERE i.is_recurring = true
      AND COALESCE(i.recurring_stopped, false) = false
    ORDER BY i.recurring_group_id, COALESCE(i.recurring_index, 1), i.created_at
  LOOP
    -- How many occurrences already exist for this group
    SELECT COUNT(*), MAX(date) INTO existing_count, next_date
    FROM public.incomes
    WHERE recurring_group_id = rec.recurring_group_id;

    -- Decide target count
    IF rec.recurring_infinite THEN
      -- Generate until horizon_date
      i := existing_count; -- next index (0-based for math)
      LOOP
        -- compute next occurrence date from start_date and i
        IF rec.recurring_frequency = 'monthly' THEN
          next_date := (rec.start_date + (i || ' month')::interval)::date;
        ELSIF rec.recurring_frequency = 'weekly' THEN
          next_date := (rec.start_date + (i * 7 || ' days')::interval)::date;
        ELSIF rec.recurring_frequency = 'yearly' THEN
          next_date := (rec.start_date + (i || ' year')::interval)::date;
        ELSE
          next_date := (rec.start_date + (i * 7 || ' days')::interval)::date;
        END IF;

        EXIT WHEN next_date IS NULL OR next_date > horizon_date;

        -- Insert only if not already present
        IF NOT EXISTS (
          SELECT 1 FROM public.incomes 
          WHERE recurring_group_id = rec.recurring_group_id AND date = next_date
        ) THEN
          INSERT INTO public.incomes (
            user_id, amount, source, category, currency, date, description,
            is_recurring, recurring_group_id, recurring_frequency,
            recurring_total_occurrences, recurring_index, recurring_infinite, recurring_stopped
          ) VALUES (
            rec.user_id, rec.amount, rec.source, rec.category, rec.currency, next_date, rec.description,
            true, rec.recurring_group_id, rec.recurring_frequency,
            NULL, i + 1, true, false
          );
        END IF;

        i := i + 1;
      END LOOP;
    ELSE
      -- Finite series: ensure up to total_occurrences exist
      IF rec.recurring_total_occurrences IS NULL OR rec.recurring_total_occurrences <= 0 THEN
        CONTINUE;
      END IF;
      target_count := rec.recurring_total_occurrences;
      i := existing_count; -- start from existing count
      WHILE i < target_count LOOP
        -- compute next occurrence date
        IF rec.recurring_frequency = 'monthly' THEN
          next_date := (rec.start_date + (i || ' month')::interval)::date;
        ELSIF rec.recurring_frequency = 'weekly' THEN
          next_date := (rec.start_date + (i * 7 || ' days')::interval)::date;
        ELSIF rec.recurring_frequency = 'yearly' THEN
          next_date := (rec.start_date + (i || ' year')::interval)::date;
        ELSE
          next_date := (rec.start_date + (i * 7 || ' days')::interval)::date;
        END IF;

        -- Insert if missing
        IF NOT EXISTS (
          SELECT 1 FROM public.incomes 
          WHERE recurring_group_id = rec.recurring_group_id AND date = next_date
        ) THEN
          INSERT INTO public.incomes (
            user_id, amount, source, category, currency, date, description,
            is_recurring, recurring_group_id, recurring_frequency,
            recurring_total_occurrences, recurring_index, recurring_infinite, recurring_stopped
          ) VALUES (
            rec.user_id, rec.amount, rec.source, rec.category, rec.currency, next_date, rec.description,
            true, rec.recurring_group_id, rec.recurring_frequency,
            target_count, i + 1, false, false
          );
        END IF;
        i := i + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- 8. Schedula il generatore di entrate ricorrenti
SELECT cron.schedule(
  'generate_recurring_incomes_daily',
  '0 3 * * *', -- Daily at 03:00 UTC (after expenses generation)
  $$CALL public.generate_recurring_incomes(60);$$
)
ON CONFLICT (jobname) DO NOTHING;

-- 9. Aggiungi constraint per validazione dati
ALTER TABLE public.incomes
  ADD CONSTRAINT IF NOT EXISTS incomes_amount_positive 
  CHECK (amount > 0);

ALTER TABLE public.incomes
  ADD CONSTRAINT IF NOT EXISTS incomes_category_valid 
  CHECK (category IN ('work', 'passive', 'investment', 'other'));

-- 10. Aggiungi constraint per frequenze ricorrenti
ALTER TABLE public.incomes
  ADD CONSTRAINT IF NOT EXISTS incomes_frequency_valid 
  CHECK (recurring_frequency IN ('monthly', 'weekly', 'yearly') OR recurring_frequency IS NULL);

-- =====================================================
-- VERIFICA SETUP
-- =====================================================

-- Verifica che le tabelle siano state create correttamente
DO $$
BEGIN
  -- Check profiles table has monthly_income
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'monthly_income'
  ) THEN
    RAISE EXCEPTION 'monthly_income column not found in profiles table';
  END IF;
  
  -- Check incomes table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'incomes'
  ) THEN
    RAISE EXCEPTION 'incomes table not found';
  END IF;
  
  RAISE NOTICE 'Income tracking setup completed successfully!';
END $$;
