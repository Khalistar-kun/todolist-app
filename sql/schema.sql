-- Enable required extensions (usually pre-installed in Supabase)
create extension if not exists pgcrypto;

-- Profiles table (optional; mirrors auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles readable"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clients enable row level security;

create policy "Clients readable by authenticated"
  on public.clients for select to authenticated using (true);

create policy "Insert own clients"
  on public.clients for insert to authenticated
  with check (created_by = auth.uid());

create policy "Update/delete own clients"
  on public.clients for update to authenticated
  using (created_by = auth.uid());

create policy "Delete own clients"
  on public.clients for delete to authenticated
  using (created_by = auth.uid());

-- Tasks
create type task_status as enum ('todo','in_progress','done');

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('todo','in_progress','done');
  end if;
exception when duplicate_object then null; end$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'todo',
  due_at timestamptz,
  assignees text[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Tasks readable by authenticated"
  on public.tasks for select to authenticated using (true);

create policy "Insert own tasks"
  on public.tasks for insert to authenticated
  with check (created_by = auth.uid());

create policy "Update if creator or assignee"
  on public.tasks for update to authenticated
  using (
    created_by = auth.uid() or
    (auth.email() is not null and auth.email() = any(assignees))
  );

create policy "Delete own tasks"
  on public.tasks for delete to authenticated
  using (created_by = auth.uid());

-- Useful triggers to maintain updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Auto set created_by from auth.uid() on insert
create or replace function set_created_by() returns trigger as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
for each row execute function set_updated_at();

drop trigger if exists clients_set_created_by on public.clients;
create trigger clients_set_created_by before insert on public.clients
for each row execute function set_created_by();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function set_updated_at();

drop trigger if exists tasks_set_created_by on public.tasks;
create trigger tasks_set_created_by before insert on public.tasks
for each row execute function set_created_by();
