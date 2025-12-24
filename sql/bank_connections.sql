-- Tabella per memorizzare le connessioni bancarie degli utenti
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank_name text NOT NULL,
  bank_id text NOT NULL, -- L'ID della banca su Enable Banking
  external_session_id text NOT NULL, -- Il session_id fornito da Enable Banking
  status text DEFAULT 'pending', -- 'pending', 'active', 'expired'
  access_expires_at timestamp with time zone, -- La PSD2 scade solitamente ogni 90-180 giorni
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabella per memorizzare i conti associati a ogni connessione
-- Importante: alcuni dati di Enable Banking vengono mostrati solo alla creazione della sessione
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid REFERENCES public.bank_connections(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  external_account_id text NOT NULL, -- Il resource_id di Enable Banking
  iban text,
  name text,
  currency text DEFAULT 'EUR',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(connection_id, external_account_id)
);

-- Abilita RLS (Row Level Security)
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Policy per bank_connections
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections' AND policyname = 'Users can view own bank connections') THEN
    CREATE POLICY "Users can view own bank connections" ON public.bank_connections FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections' AND policyname = 'Users can delete own bank connections') THEN
    CREATE POLICY "Users can delete own bank connections" ON public.bank_connections FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections' AND policyname = 'Users can update own bank connections') THEN
    CREATE POLICY "Users can update own bank connections" ON public.bank_connections FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy per bank_accounts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_accounts' AND policyname = 'Users can view own bank accounts') THEN
    CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_accounts' AND policyname = 'Users can delete own bank accounts') THEN
    CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
