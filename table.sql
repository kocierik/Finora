create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  quantity numeric not null,
  average_price numeric not null,
  purchase_date date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists investments_user_ticker_date_idx
  on public.investments(user_id, ticker, purchase_date);

alter table public.investments enable row level security;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  merchant text,
  category text,
  currency text,
  date date not null,
  raw_notification text,
  -- Recurring transaction support
  is_recurring boolean not null default false,
  recurring_group_id text,
  recurring_frequency text,
  recurring_total_occurrences integer,
  recurring_index integer,
  recurring_infinite boolean not null default false,
  recurring_stopped boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses(user_id, date);

alter table public.expenses enable row level security;


-- Crea la tabella profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  -- Financial settings
  monthly_budget NUMERIC,
  expense_threshold_moderate NUMERIC DEFAULT 1000,
  expense_threshold_high NUMERIC DEFAULT 1500,
  currency TEXT DEFAULT 'EUR',
  hide_balances BOOLEAN DEFAULT false,
  -- App config
  categories_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Crea le policy
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Crea il trigger per updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Ensure categories_config is an array (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'categories_config'
  ) THEN
    BEGIN
      ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_categories_config_is_array
      CHECK (jsonb_typeof(categories_config) = 'array');
    EXCEPTION WHEN duplicate_object THEN
      -- constraint already exists
      NULL;
    END;
  END IF;
END $$;


-- Ensure recurring columns exist on public.expenses for existing databases
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_group_id text,
  ADD COLUMN IF NOT EXISTS recurring_frequency text,
  ADD COLUMN IF NOT EXISTS recurring_total_occurrences integer,
  ADD COLUMN IF NOT EXISTS recurring_index integer,
  ADD COLUMN IF NOT EXISTS recurring_infinite boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_stopped boolean DEFAULT false;

-- Backfill nulls for is_recurring and enforce NOT NULL
UPDATE public.expenses SET is_recurring = COALESCE(is_recurring, false) WHERE is_recurring IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE public.expenses ALTER COLUMN is_recurring SET NOT NULL;
  END IF;
END $$;

-- Helpful index for grouping recurring entries
CREATE INDEX IF NOT EXISTS expenses_recurring_group_idx ON public.expenses(recurring_group_id);

-- Enable pg_cron for scheduled jobs
create extension if not exists pg_cron;

-- Function: generate missing future occurrences for recurring expenses
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses(horizon_days integer DEFAULT 60)
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
  -- Iterate each recurring group that is not stopped
  FOR rec IN
    SELECT DISTINCT ON (e.recurring_group_id)
      e.recurring_group_id,
      e.user_id,
      e.merchant,
      e.category,
      e.currency,
      e.amount,
      e.raw_notification,
      e.date AS start_date,
      e.recurring_frequency,
      e.recurring_total_occurrences,
      e.recurring_infinite
    FROM public.expenses e
    WHERE e.is_recurring = true
      AND COALESCE(e.recurring_stopped, false) = false
    ORDER BY e.recurring_group_id, COALESCE(e.recurring_index, 1), e.created_at
  LOOP
    -- How many occurrences already exist for this group
    SELECT COUNT(*), MAX(date) INTO existing_count, next_date
    FROM public.expenses
    WHERE recurring_group_id = rec.recurring_group_id;

    -- Decide target count
    IF rec.recurring_infinite THEN
      -- Generate until horizon_date
      i := existing_count; -- next index (0-based for math)
      LOOP
        -- compute next occurrence date from start_date and i
        IF rec.recurring_frequency = 'monthly' THEN
          next_date := (rec.start_date + (i || ' month')::interval)::date;
        ELSE
          next_date := (rec.start_date + (i * 7 || ' days')::interval)::date;
        END IF;

        EXIT WHEN next_date IS NULL OR next_date > horizon_date;

        -- Insert only if not already present
        IF NOT EXISTS (
          SELECT 1 FROM public.expenses 
          WHERE recurring_group_id = rec.recurring_group_id AND date = next_date
        ) THEN
          INSERT INTO public.expenses (
            user_id, amount, merchant, category, currency, date, raw_notification,
            is_recurring, recurring_group_id, recurring_frequency,
            recurring_total_occurrences, recurring_index, recurring_infinite, recurring_stopped
          ) VALUES (
            rec.user_id, rec.amount, rec.merchant, rec.category, rec.currency, next_date, COALESCE(rec.raw_notification, 'manual'),
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
        ELSE
          next_date := (rec.start_date + (i * 7 || ' days')::interval)::date;
        END IF;

        -- Insert if missing
        IF NOT EXISTS (
          SELECT 1 FROM public.expenses 
          WHERE recurring_group_id = rec.recurring_group_id AND date = next_date
        ) THEN
          INSERT INTO public.expenses (
            user_id, amount, merchant, category, currency, date, raw_notification,
            is_recurring, recurring_group_id, recurring_frequency,
            recurring_total_occurrences, recurring_index, recurring_infinite, recurring_stopped
          ) VALUES (
            rec.user_id, rec.amount, rec.merchant, rec.category, rec.currency, next_date, COALESCE(rec.raw_notification, 'manual'),
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

-- Schedule the generator daily at 02:00 UTC with 60-day horizon
SELECT cron.schedule(
  'generate_recurring_expenses_daily',
  '0 2 * * *',
  $$CALL public.generate_recurring_expenses(60);$$
)
ON CONFLICT (jobname) DO NOTHING;

-- Aggiungi colonne per le impostazioni finanziarie alla tabella profiles (per database esistenti)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS expense_threshold_moderate NUMERIC DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS expense_threshold_high NUMERIC DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS hide_balances BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS categories_config JSONB DEFAULT '[]'::jsonb;

-- Idempotent constraint for existing DBs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'categories_config'
  ) THEN
    BEGIN
      ALTER TABLE public.profiles
      ADD CONSTRAINT IF NOT EXISTS profiles_categories_config_is_array
      CHECK (jsonb_typeof(categories_config) = 'array');
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Optional GIN index for categories_config
CREATE INDEX IF NOT EXISTS idx_profiles_categories_config
ON public.profiles
USING gin (categories_config jsonb_path_ops);

-- Aggiorna updated_at quando si modificano le impostazioni
CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per aggiornare updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_updated_at();

-- =====================================================
-- INCOME TRACKING TABLES
-- =====================================================

-- Aggiungi campo monthly_income alla tabella profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_income NUMERIC DEFAULT NULL;

-- Aggiungi commento per documentazione
COMMENT ON COLUMN public.profiles.monthly_income IS 'Monthly income amount in user currency for financial calculations';

-- Crea tabella incomes per tracciamento dettagliato
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

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS incomes_user_date_idx ON public.incomes(user_id, date);
CREATE INDEX IF NOT EXISTS incomes_user_category_idx ON public.incomes(user_id, category);
CREATE INDEX IF NOT EXISTS incomes_recurring_group_idx ON public.incomes(recurring_group_id);

-- Abilita Row Level Security
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

-- Crea policy RLS per incomes
CREATE POLICY "Users can view own incomes" ON public.incomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own incomes" ON public.incomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incomes" ON public.incomes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own incomes" ON public.incomes
  FOR DELETE USING (auth.uid() = user_id);

-- Assicurati che le policy siano attive
ALTER TABLE public.incomes FORCE ROW LEVEL SECURITY;

-- Policy speciale per il cron job che genera entrate ricorrenti
CREATE POLICY "Cron job can manage recurring incomes" ON public.incomes
  FOR ALL USING (
    -- Permetti accesso solo per operazioni di sistema (cron job)
    current_setting('role') = 'postgres' OR
    -- Oppure se l'utente è autenticato e può accedere ai propri dati
    auth.uid() = user_id
  );

-- Crea trigger per updated_at
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

-- Funzione per generare entrate ricorrenti
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

-- Schedula il generatore di entrate ricorrenti
SELECT cron.schedule(
  'generate_recurring_incomes_daily',
  '0 3 * * *', -- Daily at 03:00 UTC (after expenses generation)
  $$CALL public.generate_recurring_incomes(60);$$
)
ON CONFLICT (jobname) DO NOTHING;

-- Aggiungi constraint per validazione dati
ALTER TABLE public.incomes
  ADD CONSTRAINT IF NOT EXISTS incomes_amount_positive 
  CHECK (amount > 0);

ALTER TABLE public.incomes
  ADD CONSTRAINT IF NOT EXISTS incomes_category_valid 
  CHECK (category IN ('work', 'passive', 'investment', 'other'));

-- Aggiungi constraint per frequenze ricorrenti
ALTER TABLE public.incomes
  ADD CONSTRAINT IF NOT EXISTS incomes_frequency_valid 
  CHECK (recurring_frequency IN ('monthly', 'weekly', 'yearly') OR recurring_frequency IS NULL);

-- Verifica che RLS sia attivo per incomes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'incomes' 
    AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on incomes table!';
  END IF;
  
  RAISE NOTICE 'RLS is properly configured for incomes table';
END $$;