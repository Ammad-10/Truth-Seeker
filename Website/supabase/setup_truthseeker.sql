-- TruthSeeker Supabase Setup
-- Paste this whole file into the Supabase SQL Editor for project:
-- https://wdlxovvxnfxchfzfcvkd.supabase.co

begin;

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, new.raw_user_meta_data ->> 'username')
  on conflict (user_id) do update
    set username = coalesce(excluded.username, public.profiles.username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification history
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  headline text default '',
  article_text text not null,
  credibility_score integer not null,
  verdict text not null check (verdict in ('verified', 'suspicious', 'fake')),
  ai_confidence integer not null,
  ai_reasoning text,
  source_score integer default 0,
  source_summary text,
  topic text,
  model_score integer,
  news_api_score integer,
  google_fc_score integer,
  groq_score integer,
  groq_reasoning text,
  groq_verdict text,
  created_at timestamptz not null default now()
);

create index if not exists verifications_user_id_created_at_idx
  on public.verifications (user_id, created_at desc);

alter table public.verifications enable row level security;

drop policy if exists "Users can view their own verifications" on public.verifications;
create policy "Users can view their own verifications"
  on public.verifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own verifications" on public.verifications;
create policy "Users can insert their own verifications"
  on public.verifications
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own verifications" on public.verifications;
create policy "Users can delete their own verifications"
  on public.verifications
  for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpful backfill for users created before the trigger existed
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.profiles (user_id, username)
select
  u.id,
  u.raw_user_meta_data ->> 'username'
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

commit;
