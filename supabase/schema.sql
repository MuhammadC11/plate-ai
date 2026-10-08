-- Plate AI schema.
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Safe to re-run: every statement is guarded.

-- ---------------------------------------------------------------------------
-- profiles: one row per user, holding their daily targets.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  calorie_goal  integer not null default 2000 check (calorie_goal between 500 and 10000),
  protein_goal_g integer not null default 150 check (protein_goal_g between 0 and 1000),
  carbs_goal_g  integer not null default 200 check (carbs_goal_g between 0 and 1000),
  fat_goal_g    integer not null default 65  check (fat_goal_g between 0 and 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- meals: one row per logged plate.
-- ---------------------------------------------------------------------------
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'Meal',
  photo_url  text,
  notes      text,
  eaten_at   timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- The dashboard always queries "this user's meals within a time window", so the
-- index is on both columns in that order.
create index if not exists meals_user_eaten_at_idx
  on public.meals (user_id, eaten_at desc);

-- ---------------------------------------------------------------------------
-- meal_items: the individual foods the model found on the plate.
-- Nutrition is stored denormalised per item so past logs never change when the
-- USDA database is updated.
-- ---------------------------------------------------------------------------
create table if not exists public.meal_items (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals (id) on delete cascade,
  name       text not null,
  query      text,
  grams      numeric(8,1) not null default 0 check (grams >= 0),
  calories   numeric(8,1) not null default 0 check (calories >= 0),
  protein_g  numeric(7,1) not null default 0 check (protein_g >= 0),
  carbs_g    numeric(7,1) not null default 0 check (carbs_g >= 0),
  fat_g      numeric(7,1) not null default 0 check (fat_g >= 0),
  source     text not null default 'estimate' check (source in ('usda', 'estimate')),
  fdc_id     integer,
  confidence numeric(3,2) check (confidence between 0 and 1),
  position   integer not null default 0
);

create index if not exists meal_items_meal_id_idx on public.meal_items (meal_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: every user can only ever see their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.meals      enable row level security;
alter table public.meal_items enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- meal_items has no user_id of its own; ownership is inherited through the
-- parent meal, which is why these policies join back to public.meals.
drop policy if exists "own meal items" on public.meal_items;
create policy "own meal items" on public.meal_items
  for all
  using (
    exists (
      select 1 from public.meals m
      where m.id = meal_items.meal_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_items.meal_id and m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Give every new signup a profile row automatically, so the app never has to
-- handle a missing-profile case.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage bucket for meal photos.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

-- Photos are filed under <user-id>/<filename>, so the first path segment is the
-- ownership check.
drop policy if exists "own meal photos upload" on storage.objects;
create policy "own meal photos upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own meal photos delete" on storage.objects;
create policy "own meal photos delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "public read meal photos" on storage.objects;
create policy "public read meal photos" on storage.objects
  for select using (bucket_id = 'meal-photos');
