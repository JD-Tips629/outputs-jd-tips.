create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, data)
values (
  'default',
  '{
    "followers": [],
    "tips": [],
    "paymentRequests": [],
    "history": [],
    "analytics": { "visits": [] },
    "wallet": 0
  }'::jsonb
)
on conflict (id) do nothing;
