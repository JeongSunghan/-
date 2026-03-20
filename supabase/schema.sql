create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  official_status text not null default 'discovered'
    check (official_status in ('discovered', 'pending', 'verified', 'official')),
  contact_status text not null default 'uncontacted'
    check (contact_status in ('uncontacted', 'queued', 'contacted', 'verified', 'rejected')),
  base_area text,
  base_address text,
  base_lat double precision,
  base_lng double precision,
  mobile_service boolean not null default true,
  truck_label text,
  service_tags text[] not null default '{}',
  service_areas text[] not null default '{}',
  price_hints text[] not null default '{}',
  intro text,
  reservation_url text,
  schedule_feed_url text,
  notice_channel_url text,
  last_verified_on date,
  source_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  title text generated always as (
    coalesce(district, '') || ' ' || coalesce(neighborhood, '') || ' ' || coalesce(truck_type, '')
  ) stored,
  district text not null,
  neighborhood text not null,
  place text not null,
  truck_type text not null,
  provider_hint text,
  note text,
  reporter_alias text,
  lat double precision,
  lng double precision,
  has_photo boolean not null default false,
  photo_url text,
  trust_score integer not null default 50 check (trust_score between 0 and 100),
  status text not null default 'active' check (status in ('active', 'expired', 'blocked')),
  source_type text not null default 'user_report'
    check (source_type in ('seed_report', 'community_report', 'user_report')),
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  district text not null,
  anchor_neighborhood text not null,
  radius_meters integer not null check (radius_meters > 0),
  channel text not null check (channel in ('웹 푸시', '카카오 알림톡', '문자')),
  nickname text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_reported_at on public.reports (reported_at desc);
create index if not exists idx_reports_district on public.reports (district);
create index if not exists idx_reports_status on public.reports (status);
create index if not exists idx_alert_subscriptions_district on public.alert_subscriptions (district);

drop trigger if exists set_providers_updated_at on public.providers;

create trigger set_providers_updated_at
before update on public.providers
for each row
execute function public.set_updated_at();

alter table public.providers enable row level security;
alter table public.reports enable row level security;
alter table public.alert_subscriptions enable row level security;

drop policy if exists "providers public read" on public.providers;
create policy "providers public read"
on public.providers
for select
using (true);

drop policy if exists "reports public read active" on public.reports;
create policy "reports public read active"
on public.reports
for select
using (status = 'active');

drop policy if exists "reports public insert" on public.reports;
create policy "reports public insert"
on public.reports
for insert
with check (
  status = 'active'
  and source_type in ('seed_report', 'community_report', 'user_report')
  and char_length(trim(district)) > 0
  and char_length(trim(neighborhood)) > 0
  and char_length(trim(place)) > 0
  and char_length(trim(truck_type)) > 0
);

drop policy if exists "alerts public insert" on public.alert_subscriptions;
create policy "alerts public insert"
on public.alert_subscriptions
for insert
with check (
  radius_meters > 0
  and channel in ('웹 푸시', '카카오 알림톡', '문자')
);
