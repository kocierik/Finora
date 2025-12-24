-- Aggiunta di external_id per evitare duplicati durante la sincronizzazione bancaria
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS external_id text;
-- Rimuoviamo l'indice parziale e creiamo un indice unico standard necessario per ON CONFLICT
DROP INDEX IF EXISTS idx_expenses_external_id;
CREATE UNIQUE INDEX idx_expenses_external_id ON public.expenses(external_id);

ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS external_id text;
DROP INDEX IF EXISTS idx_incomes_external_id;
CREATE UNIQUE INDEX idx_incomes_external_id ON public.incomes(external_id);
