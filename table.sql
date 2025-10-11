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
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses(user_id, date);

alter table public.expenses enable row level security;