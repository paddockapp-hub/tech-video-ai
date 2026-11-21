create table if not exists transfer_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  depositor text not null,
  plan text not null,
  amount integer not null,
  status text not null default 'pending'  -- pending | confirmed | rejected
);
alter table transfer_requests enable row level security; -- 서비스 키로만 접근
