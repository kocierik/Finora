-- =====================================================
-- FIX RLS POLICIES FOR INCOMES TABLE
-- =====================================================
-- Questo file applica le policy RLS mancanti alla tabella incomes

-- 1. Abilita Row Level Security se non già attivo
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

-- 2. Rimuovi policy esistenti se presenti (per evitare conflitti)
DROP POLICY IF EXISTS "Users can view own incomes" ON public.incomes;
DROP POLICY IF EXISTS "Users can insert own incomes" ON public.incomes;
DROP POLICY IF EXISTS "Users can update own incomes" ON public.incomes;
DROP POLICY IF EXISTS "Users can delete own incomes" ON public.incomes;
DROP POLICY IF EXISTS "Cron job can manage recurring incomes" ON public.incomes;

-- 3. Crea policy RLS per utenti autenticati
CREATE POLICY "Users can view own incomes" ON public.incomes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own incomes" ON public.incomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incomes" ON public.incomes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own incomes" ON public.incomes
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Policy speciale per il cron job
CREATE POLICY "Cron job can manage recurring incomes" ON public.incomes
  FOR ALL USING (
    -- Permetti accesso per operazioni di sistema (cron job)
    current_setting('role') = 'postgres' OR
    -- Oppure se l'utente è autenticato e può accedere ai propri dati
    auth.uid() = user_id
  );

-- 5. Forza RLS per sicurezza
ALTER TABLE public.incomes FORCE ROW LEVEL SECURITY;

-- 6. Verifica che RLS sia attivo
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

-- 7. Mostra le policy create
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'incomes' 
ORDER BY policyname;
