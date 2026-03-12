-- ─────────────────────────────────────────────────────────────────────────────
-- MealPlanner App — Supabase Schema
-- Run this in the Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ingredients catalogue
create table if not exists ingredients (
  id            text primary key,
  name          text not null,
  default_unit  text not null default 'ud',
  category      text,
  is_online     boolean not null default false,
  purchase_url  text,
  purchase_store text
);

-- 2. Recipes (recipe_ingredients and steps stored as JSONB)
create table if not exists recipes (
  id                    text primary key,
  name                  text not null,
  meal_type             text not null,
  origin                text,
  difficulty            text,
  prep_time             integer not null default 0,
  cook_time             integer not null default 0,
  servings              integer not null default 1,
  ingredients           jsonb not null default '[]',
  steps                 jsonb not null default '[]',
  calories_per_serving  integer not null default 0,
  protein_g             real not null default 0,
  fat_g                 real not null default 0,
  carbs_g               real not null default 0,
  cost_eur              real not null default 0,
  photo_uri             text,
  is_favorite           boolean not null default false,
  source_url            text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 3. Recipe origins (autocomplete)
create table if not exists origins (
  name text primary key
);

-- 4. Meal plans
create table if not exists meal_plans (
  id          text primary key,
  title       text not null,
  week_start  date not null,
  created_at  timestamptz not null default now()
);

-- 5. Meal plan entries
create table if not exists meal_plan_entries (
  id            text primary key,
  meal_plan_id  text not null references meal_plans(id) on delete cascade,
  day_of_week   text not null,
  meal_type     text not null,
  recipe_id     text references recipes(id) on delete set null,
  servings      integer not null default 1
);

-- 6. Shopping lists (items stored as JSONB)
create table if not exists shopping_lists (
  id            text primary key,
  meal_plan_id  text not null references meal_plans(id) on delete cascade,
  created_at    timestamptz not null default now(),
  items         jsonb not null default '[]'
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Household app: all authenticated users (or anon) can read/write everything.
-- Disable RLS for simplicity — enable and add user-scoped policies when needed.

alter table ingredients      disable row level security;
alter table recipes          disable row level security;
alter table origins          disable row level security;
alter table meal_plans       disable row level security;
alter table meal_plan_entries disable row level security;
alter table shopping_lists   disable row level security;
