-- Migration: support loose ingredients in meal_plan_entries
-- Run this in the Supabase SQL editor

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS ingredient_id TEXT REFERENCES ingredients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity REAL,
  ADD COLUMN IF NOT EXISTS unit TEXT;

-- recipe_id is already nullable via ON DELETE SET NULL, so no change needed there.
-- An entry now represents either:
--   - a recipe entry:     recipe_id IS NOT NULL
--   - a loose ingredient: ingredient_id IS NOT NULL
