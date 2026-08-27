-- Run once in Supabase Dashboard → SQL Editor.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 70),
  category text not null check (category in ('work', 'wellness', 'learning', 'personal')),
  completed boolean not null default false,
  progress integer not null default 0 check (progress between 0 and 100),
  note text not null default '' check (char_length(note) <= 500),
  due_date date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_due_date_idx on public.tasks (user_id, due_date);
alter table public.tasks enable row level security;

create policy "Users manage their own tasks"
on public.tasks for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- If you already ran the first version of this file, run these two lines as well.
alter table public.tasks add column if not exists progress integer not null default 0 check (progress between 0 and 100);
alter table public.tasks add column if not exists note text not null default '' check (char_length(note) <= 500);

-- Budget tracker: run this block once in Supabase SQL Editor.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  title text not null check (char_length(title) between 1 and 80),
  category text not null check (char_length(category) between 1 and 50),
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);
create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.transactions enable row level security;
alter table public.monthly_budgets enable row level security;
create policy "Users manage their own transactions" on public.transactions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own budgets" on public.monthly_budgets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Add a dedicated monthly allocation for money sent home.
alter table public.monthly_budgets add column if not exists send_home_amount numeric(12,2) not null default 0 check (send_home_amount >= 0);

-- Category budget plans: run once in Supabase SQL Editor.
create table if not exists public.budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  category text not null check (char_length(category) between 1 and 50),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);
alter table public.budget_plans enable row level security;
create policy "Users manage their own category plans" on public.budget_plans for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Job application tracker: run once in Supabase SQL Editor.
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null check (char_length(company) between 1 and 80),
  role text not null check (char_length(role) between 1 and 100),
  status text not null default 'applied' check (status in ('applied', 'interview', 'offer', 'rejected')),
  application_date date not null default current_date,
  follow_up_date date,
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
alter table public.job_applications enable row level security;
create policy "Users manage their own job applications" on public.job_applications for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Job application detail columns: run once if the table already exists.
alter table public.job_applications add column if not exists resume_link text not null default '' check (char_length(resume_link) <= 500);
alter table public.job_applications add column if not exists cover_letter_link text not null default '' check (char_length(cover_letter_link) <= 500);
alter table public.job_applications add column if not exists contacts text not null default '' check (char_length(contacts) <= 300);
alter table public.job_applications add column if not exists response text not null default '' check (char_length(response) <= 500);
alter table public.job_applications add column if not exists email text not null default '' check (char_length(email) <= 254);
alter table public.job_applications add column if not exists portal_link text not null default '' check (char_length(portal_link) <= 500);
alter table public.job_applications add column if not exists reference text not null default '' check (char_length(reference) <= 300);
alter table public.job_applications add column if not exists location text not null default '' check (char_length(location) <= 120);
alter table public.job_applications add column if not exists reference_linkedin text not null default '' check (char_length(reference_linkedin) <= 500);
alter table public.job_applications add column if not exists reference_contact text not null default '' check (char_length(reference_contact) <= 300);

-- Learning roadmaps: run once in Supabase SQL Editor.
create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 400),
  created_at timestamptz not null default now()
);
create table if not exists public.roadmap_sections (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.roadmap_topics (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.roadmap_sections(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  definition text not null default '' check (char_length(definition) <= 1000),
  notes text not null default '' check (char_length(notes) <= 5000),
  mastered boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.roadmaps enable row level security;
alter table public.roadmap_sections enable row level security;
alter table public.roadmap_topics enable row level security;
create policy "Users manage their own roadmaps" on public.roadmaps for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage sections in their roadmaps" on public.roadmap_sections for all to authenticated using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = (select auth.uid())));
create policy "Users manage topics in their roadmaps" on public.roadmap_topics for all to authenticated using (exists (select 1 from public.roadmap_sections s join public.roadmaps r on r.id = s.roadmap_id where s.id = section_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.roadmap_sections s join public.roadmaps r on r.id = s.roadmap_id where s.id = section_id and r.user_id = (select auth.uid())));
