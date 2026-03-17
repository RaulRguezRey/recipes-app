-- ============================================================
-- Recipes App — Full Supabase Schema
-- Run this entire file in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Core tables ──────────────────────────────────────────────────────────────

create table if not exists ingredients (
  id             text primary key,
  name           text not null,
  default_unit   text not null default 'ud',
  category       text,
  is_online      boolean not null default false,
  purchase_url   text,
  purchase_store text
);

create table if not exists origins (
  name text primary key
);

create table if not exists recipes (
  id                   text primary key,
  name                 text not null,
  meal_type            text not null,
  origin               text,
  difficulty           text,
  prep_time            integer,
  cook_time            integer,
  servings             integer not null default 1,
  ingredients          jsonb,
  steps                jsonb,
  calories_per_serving integer,
  protein_g            real,
  fat_g                real,
  carbs_g              real,
  cost_eur             real,
  photo_uri            text,
  is_favorite          boolean not null default false,
  source_url           text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Auth columns
  owner_user_id        uuid references auth.users(id) on delete cascade,
  is_seed              boolean not null default false
);

create table if not exists meal_plans (
  id            text primary key,
  title         text not null,
  week_start    date not null,
  created_at    timestamptz not null default now(),
  -- Auth columns
  owner_user_id uuid references auth.users(id) on delete cascade,
  household_id  uuid references households(id) on delete set null
);

create table if not exists meal_plan_entries (
  id           text primary key,
  meal_plan_id text not null references meal_plans(id) on delete cascade,
  day_of_week  text,
  meal_type    text,
  recipe_id    text references recipes(id) on delete set null,
  servings     integer not null default 1
);

create table if not exists shopping_lists (
  id           text primary key,
  meal_plan_id text not null references meal_plans(id) on delete cascade,
  created_at   timestamptz not null default now(),
  items        jsonb
);

-- ── Auth tables ───────────────────────────────────────────────────────────────

create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists recipe_shares (
  recipe_id           text not null references recipes(id) on delete cascade,
  shared_with_user_id uuid not null references auth.users(id) on delete cascade,
  shared_by_user_id   uuid not null references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (recipe_id, shared_with_user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_recipes_owner         on recipes(owner_user_id);
create index if not exists idx_meal_plans_owner      on meal_plans(owner_user_id);
create index if not exists idx_meal_plans_household  on meal_plans(household_id);
create index if not exists idx_hm_user_id            on household_members(user_id);
create index if not exists idx_hm_household_id       on household_members(household_id);

-- ── Helper functions ──────────────────────────────────────────────────────────

-- Generates a unique household code in format ABCD-1234
create or replace function generate_household_code()
returns text
language plpgsql
as $$
declare
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code   text;
  exists boolean;
begin
  loop
    code := '';
    for i in 1..4 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    code := code || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
    select count(*) > 0 into exists from households where households.code = code;
    exit when not exists;
  end loop;
  return code;
end;
$$;

-- Returns true if auth.uid() shares a household with the target user
create or replace function shares_household(target uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from household_members a
    join household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid()
      and b.user_id = target
      and a.user_id <> b.user_id
  );
$$;

-- ── Trigger: auto-create profile + copy seeds on new user ─────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seed_row record;
  new_id   text;
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  for seed_row in select * from recipes where is_seed = true loop
    new_id := 'usr_' || new.id::text || '_' || seed_row.id;
    insert into recipes (
      id, name, meal_type, origin, difficulty, prep_time, cook_time, servings,
      ingredients, steps, calories_per_serving, protein_g, fat_g, carbs_g,
      cost_eur, photo_uri, is_favorite, source_url, notes,
      created_at, updated_at, owner_user_id, is_seed
    ) values (
      new_id, seed_row.name, seed_row.meal_type, seed_row.origin, seed_row.difficulty,
      seed_row.prep_time, seed_row.cook_time, seed_row.servings,
      seed_row.ingredients, seed_row.steps, seed_row.calories_per_serving,
      seed_row.protein_g, seed_row.fat_g, seed_row.carbs_g, seed_row.cost_eur,
      seed_row.photo_uri, false, seed_row.source_url, seed_row.notes,
      now(), now(), new.id, false
    )
    on conflict (id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── RPC: re-copy seeds for existing user (Settings → Reload) ─────────────────

create or replace function copy_seeds_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  seed_row record;
  new_id   text;
begin
  for seed_row in select * from recipes where is_seed = true loop
    new_id := 'usr_' || p_user_id::text || '_' || seed_row.id;
    insert into recipes (
      id, name, meal_type, origin, difficulty, prep_time, cook_time, servings,
      ingredients, steps, calories_per_serving, protein_g, fat_g, carbs_g,
      cost_eur, photo_uri, is_favorite, source_url, notes,
      created_at, updated_at, owner_user_id, is_seed
    ) values (
      new_id, seed_row.name, seed_row.meal_type, seed_row.origin, seed_row.difficulty,
      seed_row.prep_time, seed_row.cook_time, seed_row.servings,
      seed_row.ingredients, seed_row.steps, seed_row.calories_per_serving,
      seed_row.protein_g, seed_row.fat_g, seed_row.carbs_g, seed_row.cost_eur,
      seed_row.photo_uri, false, seed_row.source_url, seed_row.notes,
      now(), now(), p_user_id, false
    )
    on conflict (id) do nothing;
  end loop;
end;
$$;

-- ── Mark existing recipes as seed templates (run once on existing DB) ─────────
-- update recipes set is_seed = true where owner_user_id is null;

-- ── RLS ───────────────────────────────────────────────────────────────────────

-- ingredients and origins are a shared public catalogue — no RLS
alter table ingredients disable row level security;
alter table origins     disable row level security;

alter table profiles          enable row level security;
alter table households        enable row level security;
alter table household_members enable row level security;
alter table recipe_shares     enable row level security;
alter table recipes           enable row level security;
alter table meal_plans        enable row level security;
alter table meal_plan_entries enable row level security;
alter table shopping_lists    enable row level security;

-- profiles
create policy "own profile read"   on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- households
create policy "member can view" on households for select using (
  exists (select 1 from household_members where household_id = households.id and user_id = auth.uid())
);
create policy "auth can create"    on households for insert with check (auth.uid() = created_by);
create policy "creator can update" on households for update using (auth.uid() = created_by);
create policy "creator can delete" on households for delete using (auth.uid() = created_by);

-- household_members
create policy "view own memberships" on household_members for select using (
  user_id = auth.uid()
  or household_id in (select household_id from household_members where user_id = auth.uid())
);
create policy "join"  on household_members for insert with check (user_id = auth.uid());
create policy "leave" on household_members for delete  using  (user_id = auth.uid());

-- recipe_shares
create policy "owner/recipient view" on recipe_shares for select using (
  shared_by_user_id = auth.uid() or shared_with_user_id = auth.uid()
);
create policy "owner can share" on recipe_shares for insert with check (
  shared_by_user_id = auth.uid()
  and exists (select 1 from recipes where id = recipe_id and owner_user_id = auth.uid())
);
create policy "owner removes share" on recipe_shares for delete using (shared_by_user_id = auth.uid());

-- recipes
create policy "seed recipes visible to all" on recipes for select using (is_seed = true);
create policy "own/household/shared select" on recipes for select using (
  owner_user_id = auth.uid()
  or shares_household(owner_user_id)
  or exists (
    select 1 from recipe_shares
    where recipe_id = recipes.id and shared_with_user_id = auth.uid()
  )
);
create policy "insert own"  on recipes for insert with check (owner_user_id = auth.uid());
create policy "update own"  on recipes for update using  (owner_user_id = auth.uid());
create policy "delete own"  on recipes for delete using  (owner_user_id = auth.uid());

-- Helper: returns true if the current user can access a given meal plan
-- (owns it, or is a member of its household)
create or replace function can_access_meal_plan(p_meal_plan_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from meal_plans
    where id = p_meal_plan_id
      and (
        owner_user_id = auth.uid()
        or (
          household_id is not null
          and exists (
            select 1 from household_members
            where household_id = meal_plans.household_id
              and user_id = auth.uid()
          )
        )
      )
  );
$$;

-- meal_plans
create policy "plans select" on meal_plans for select using (
  owner_user_id = auth.uid()
  or (
    household_id is not null
    and exists (
      select 1 from household_members
      where household_id = meal_plans.household_id and user_id = auth.uid()
    )
  )
);
create policy "plans insert" on meal_plans for insert with check (owner_user_id = auth.uid());
create policy "plans update" on meal_plans for update using (
  owner_user_id = auth.uid()
  or (
    household_id is not null
    and exists (
      select 1 from household_members
      where household_id = meal_plans.household_id and user_id = auth.uid()
    )
  )
);
create policy "plans delete" on meal_plans for delete using (
  owner_user_id = auth.uid()
  or (
    household_id is not null
    and exists (
      select 1 from household_members
      where household_id = meal_plans.household_id and user_id = auth.uid()
    )
  )
);

-- meal_plan_entries
create policy "entries select" on meal_plan_entries for select using (can_access_meal_plan(meal_plan_id));
create policy "entries insert" on meal_plan_entries for insert with check (can_access_meal_plan(meal_plan_id));
create policy "entries update" on meal_plan_entries for update using (can_access_meal_plan(meal_plan_id));
create policy "entries delete" on meal_plan_entries for delete using (can_access_meal_plan(meal_plan_id));

-- shopping_lists
create policy "lists select" on shopping_lists for select using (can_access_meal_plan(meal_plan_id));
create policy "lists insert" on shopping_lists for insert with check (can_access_meal_plan(meal_plan_id));
create policy "lists update" on shopping_lists for update using (can_access_meal_plan(meal_plan_id));
create policy "lists delete" on shopping_lists for delete using (can_access_meal_plan(meal_plan_id));
