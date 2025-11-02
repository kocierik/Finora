-- RPC wrappers for recurring transaction generation functions
-- These allow calling the functions from Supabase client

-- Wrapper for generate_recurring_expenses
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses_rpc(horizon_days integer DEFAULT 60)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.generate_recurring_expenses(horizon_days);
  RETURN json_build_object('success', true, 'horizon_days', horizon_days);
END;
$$;

-- Wrapper for generate_recurring_incomes
CREATE OR REPLACE FUNCTION public.generate_recurring_incomes_rpc(horizon_days integer DEFAULT 60)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.generate_recurring_incomes(horizon_days);
  RETURN json_build_object('success', true, 'horizon_days', horizon_days);
END;
$$;

