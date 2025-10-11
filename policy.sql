-- EXTENSIONS utili
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- INVESTMENTS
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  quantity numeric not null,
  average_price numeric not null,
  purchase_date date not null,
  created_at timestamptz not null default now()
);

-- Vincolo per upsert dal client
create unique index if not exists investments_user_ticker_date_idx
  on public.investments(user_id, ticker, purchase_date);

alter table public.investments enable row level security;

-- RLS: il proprietario può gestire solo i propri record
create policy if not exists "investments_select_own"
  on public.investments for select
  using (auth.uid() = user_id);

create policy if not exists "investments_insert_own"
  on public.investments for insert
  with check (auth.uid() = user_id);

create policy if not exists "investments_update_own"
  on public.investments for update
  using (auth.uid() = user_id);

create policy if not exists "investments_delete_own"
  on public.investments for delete
  using (auth.uid() = user_id);

-- EXPENSES
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  merchant text,
  category text,
  currency text,
  date date not null,
  raw_notification text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses(user_id, date);

alter table public.expenses enable row level security;

create policy if not exists "expenses_select_own"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy if not exists "expenses_insert_own"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy if not exists "expenses_update_own"
  on public.expenses for update
  using (auth.uid() = user_id);

create policy if not exists "expenses_delete_own"
  on public.expenses for delete
  using (auth.uid() = user_id);