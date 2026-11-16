-- Chongqing → Chengdu Trip Dashboard
-- Run this whole file in Supabase SQL Editor.
-- This creates the shared trip/booking/expense/attachment data model.

create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  currency text not null default 'THB',
  share_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_no integer not null,
  plan_date date,
  city text,
  title text not null,
  time_text text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  booking_date date,
  status text not null default 'todo' check (status in ('todo','pending','booked','cancelled')),
  provider text,
  reference text,
  booking_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  expense_date date,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'THB',
  paid_by uuid not null references auth.users(id) on delete restrict,
  notes text,
  settled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  share_amount numeric(12,2) not null default 0 check (share_amount >= 0),
  primary key (expense_id, user_id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (booking_id is not null or expense_id is not null)
);

create index if not exists idx_daily_plans_trip on public.daily_plans(trip_id, day_no, sort_order);
create index if not exists idx_bookings_trip on public.bookings(trip_id, booking_date);
create index if not exists idx_expenses_trip on public.expenses(trip_id, expense_date);
create index if not exists idx_splits_expense on public.expense_splits(expense_id);
create index if not exists idx_attachments_trip on public.attachments(trip_id);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.daily_plans enable row level security;
alter table public.bookings enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.attachments enable row level security;

-- Membership helper.
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
  );
$$;

-- Trips: creator can create/read; members can read.
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
for select to authenticated
using (created_by = auth.uid() or public.is_trip_member(id));

-- Trip members: users can see members of trips they belong to.
drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members
for select to authenticated
using (public.is_trip_member(trip_id) or user_id = auth.uid());

drop policy if exists members_insert_self on public.trip_members;
create policy members_insert_self on public.trip_members
for insert to authenticated
with check (user_id = auth.uid());

-- Daily plans.
drop policy if exists daily_select on public.daily_plans;
create policy daily_select on public.daily_plans
for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists daily_write on public.daily_plans;
create policy daily_write on public.daily_plans
for all to authenticated
using (public.is_trip_member(trip_id))
with check (public.is_trip_member(trip_id));

-- Bookings.
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists bookings_write on public.bookings;
create policy bookings_write on public.bookings
for all to authenticated
using (public.is_trip_member(trip_id))
with check (public.is_trip_member(trip_id));

-- Expenses.
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists expenses_write on public.expenses;
create policy expenses_write on public.expenses
for all to authenticated
using (public.is_trip_member(trip_id))
with check (public.is_trip_member(trip_id));

-- Expense splits.
drop policy if exists splits_select on public.expense_splits;
create policy splits_select on public.expense_splits
for select to authenticated
using (exists (
  select 1 from public.expenses e
  where e.id = expense_id and public.is_trip_member(e.trip_id)
));

drop policy if exists splits_write on public.expense_splits;
create policy splits_write on public.expense_splits
for all to authenticated
using (exists (
  select 1 from public.expenses e
  where e.id = expense_id and public.is_trip_member(e.trip_id)
))
with check (exists (
  select 1 from public.expenses e
  where e.id = expense_id and public.is_trip_member(e.trip_id)
));

-- Attachments metadata.
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
for select to authenticated using (public.is_trip_member(trip_id));

drop policy if exists attachments_write on public.attachments;
create policy attachments_write on public.attachments
for all to authenticated
using (public.is_trip_member(trip_id))
with check (public.is_trip_member(trip_id));

-- Storage bucket for booking/expense attachments.
insert into storage.buckets (id, name, public)
values ('trip-attachments', 'trip-attachments', false)
on conflict (id) do nothing;

drop policy if exists trip_attachments_select on storage.objects;
create policy trip_attachments_select
on storage.objects for select to authenticated
using (bucket_id = 'trip-attachments');

drop policy if exists trip_attachments_insert on storage.objects;
create policy trip_attachments_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'trip-attachments');

drop policy if exists trip_attachments_update on storage.objects;
create policy trip_attachments_update
on storage.objects for update to authenticated
using (bucket_id = 'trip-attachments')
with check (bucket_id = 'trip-attachments');

drop policy if exists trip_attachments_delete on storage.objects;
create policy trip_attachments_delete
on storage.objects for delete to authenticated
using (bucket_id = 'trip-attachments');

-- Realtime: safe to attempt; if already present this may error harmlessly in some projects.
do $$
begin
  begin
    alter publication supabase_realtime add table public.bookings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.expenses;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.daily_plans;
  exception when duplicate_object then null;
  end;
end $$;

-- v4 compatibility layer for the browser app
create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_no integer not null,
  date_label text,
  city text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.trip_days enable row level security;
drop policy if exists trip_days_select on public.trip_days;
create policy trip_days_select on public.trip_days for select to authenticated using (public.is_trip_member(trip_id));
drop policy if exists trip_days_write on public.trip_days;
create policy trip_days_write on public.trip_days for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

alter table public.bookings add column if not exists date_label text;
alter table public.bookings add column if not exists ref_label text;
alter table public.bookings add column if not exists ref_url text;
alter table public.expenses add column if not exists date_label text;
alter table public.expenses add column if not exists split_a numeric(12,2) default 0;
alter table public.expenses add column if not exists split_b numeric(12,2) default 0;

create or replace function public.create_trip(p_name text, p_start date, p_end date)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 insert into public.trips(name,start_date,end_date,created_by) values(p_name,p_start,p_end,auth.uid()) returning id into v_id;
 insert into public.trip_members(trip_id,user_id,display_name) values(v_id,auth.uid(),'A');
 return v_id;
end $$;
grant execute on function public.create_trip(text,date,date) to authenticated;

create or replace function public.join_trip(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select id into v_id from public.trips where upper(share_code)=upper(trim(p_code)) limit 1;
 if v_id is null then raise exception 'Trip code not found'; end if;
 insert into public.trip_members(trip_id,user_id,display_name) values(v_id,auth.uid(),'B')
 on conflict(trip_id,user_id) do nothing;
 return v_id;
end $$;
grant execute on function public.join_trip(text) to authenticated;

insert into storage.buckets(id,name,public) values('trip-files','trip-files',false) on conflict(id) do nothing;
