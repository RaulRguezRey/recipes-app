-- ============================================================
-- Migration: Household sync for meal plans, entries, shopping lists
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add household_id column to meal_plans
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meal_plans_household ON meal_plans(household_id);

-- 2. Helper function: returns true if current user can access a meal plan
CREATE OR REPLACE FUNCTION can_access_meal_plan(p_meal_plan_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meal_plans
    WHERE id = p_meal_plan_id
      AND (
        owner_user_id = auth.uid()
        OR (
          household_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM household_members
            WHERE household_id = meal_plans.household_id
              AND user_id = auth.uid()
          )
        )
      )
  );
$$;

-- 3. Replace meal_plans RLS policies
DROP POLICY IF EXISTS "own plans select" ON meal_plans;
DROP POLICY IF EXISTS "own plans insert" ON meal_plans;
DROP POLICY IF EXISTS "own plans update" ON meal_plans;
DROP POLICY IF EXISTS "own plans delete" ON meal_plans;

CREATE POLICY "plans select" ON meal_plans FOR SELECT USING (
  owner_user_id = auth.uid()
  OR (
    household_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM household_members
      WHERE household_id = meal_plans.household_id AND user_id = auth.uid()
    )
  )
);
CREATE POLICY "plans insert" ON meal_plans FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "plans update" ON meal_plans FOR UPDATE USING (
  owner_user_id = auth.uid()
  OR (
    household_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM household_members
      WHERE household_id = meal_plans.household_id AND user_id = auth.uid()
    )
  )
);
CREATE POLICY "plans delete" ON meal_plans FOR DELETE USING (
  owner_user_id = auth.uid()
  OR (
    household_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM household_members
      WHERE household_id = meal_plans.household_id AND user_id = auth.uid()
    )
  )
);

-- 4. Replace meal_plan_entries RLS policies
DROP POLICY IF EXISTS "entries select" ON meal_plan_entries;
DROP POLICY IF EXISTS "entries insert" ON meal_plan_entries;
DROP POLICY IF EXISTS "entries update" ON meal_plan_entries;
DROP POLICY IF EXISTS "entries delete" ON meal_plan_entries;

CREATE POLICY "entries select" ON meal_plan_entries FOR SELECT USING (can_access_meal_plan(meal_plan_id));
CREATE POLICY "entries insert" ON meal_plan_entries FOR INSERT WITH CHECK (can_access_meal_plan(meal_plan_id));
CREATE POLICY "entries update" ON meal_plan_entries FOR UPDATE USING (can_access_meal_plan(meal_plan_id));
CREATE POLICY "entries delete" ON meal_plan_entries FOR DELETE USING (can_access_meal_plan(meal_plan_id));

-- 5. Replace shopping_lists RLS policies
DROP POLICY IF EXISTS "lists select" ON shopping_lists;
DROP POLICY IF EXISTS "lists insert" ON shopping_lists;
DROP POLICY IF EXISTS "lists update" ON shopping_lists;
DROP POLICY IF EXISTS "lists delete" ON shopping_lists;

CREATE POLICY "lists select" ON shopping_lists FOR SELECT USING (can_access_meal_plan(meal_plan_id));
CREATE POLICY "lists insert" ON shopping_lists FOR INSERT WITH CHECK (can_access_meal_plan(meal_plan_id));
CREATE POLICY "lists update" ON shopping_lists FOR UPDATE USING (can_access_meal_plan(meal_plan_id));
CREATE POLICY "lists delete" ON shopping_lists FOR DELETE USING (can_access_meal_plan(meal_plan_id));

-- 6. (Optional) Backfill: assign existing plans to the household of their owner
--    Uncomment and run if you want old plans to also be visible to household members.
--
-- UPDATE meal_plans mp
-- SET household_id = hm.household_id
-- FROM household_members hm
-- WHERE mp.owner_user_id = hm.user_id
--   AND mp.household_id IS NULL;
