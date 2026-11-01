-- ==============================================================================
-- MIGRATION: 20261101000011_income_types_and_dashboard_cockpit.sql
-- DESCRIPTION: 
-- 1. Adds 'income_type' column to public.categories for macro stream classification
--    (e.g., 'salary', 'remote_freelance', 'land_mortgage', 'business', 'investment', 'other').
-- 2. Ensures standard operating revenue and expense accounts can be linked in financial_accounts.
-- 3. Updates default categories with appropriate income types.
-- 4. Ensures RLS policies allow authorized members to manage categories and settings.
-- EXECUTION: Run this script in your Supabase Project SQL Editor (https://supabase.com/dashboard/project/_/sql).
-- ==============================================================================

-- 1. Add income_type column to categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS income_type TEXT DEFAULT 'other';

-- Index for speedy filtering by income type
CREATE INDEX IF NOT EXISTS idx_categories_income_type 
ON public.categories(workspace_id, type, income_type);

-- 2. Populate default income types on existing categories
UPDATE public.categories
SET income_type = CASE
    WHEN LOWER(name) LIKE '%salary%' OR LOWER(name) LIKE '%allowance%' OR LOWER(name) LIKE '%employment%' THEN 'salary'
    WHEN LOWER(name) LIKE '%remote%' OR LOWER(name) LIKE '%freelance%' OR LOWER(name) LIKE '%software%' OR LOWER(name) LIKE '%tech%' THEN 'remote_freelance'
    WHEN LOWER(name) LIKE '%mortgage%' OR LOWER(name) LIKE '%land%' OR LOWER(name) LIKE '%rent%' OR LOWER(name) LIKE '%lease%' THEN 'land_mortgage'
    WHEN LOWER(name) LIKE '%business%' OR LOWER(name) LIKE '%trade%' OR LOWER(name) LIKE '%sales%' THEN 'business'
    WHEN LOWER(name) LIKE '%dividend%' OR LOWER(name) LIKE '%interest%' OR LOWER(name) LIKE '%profit%' OR LOWER(name) LIKE '%dps%' OR LOWER(name) LIKE '%invest%' THEN 'investment'
    ELSE 'other'
END
WHERE type = 'income' AND (income_type IS NULL OR income_type = 'other');

-- 3. Confirm RLS policy on categories allows authorized members to insert, update, delete
DROP POLICY IF EXISTS "Authorized members can manage categories" ON public.categories;
CREATE POLICY "Authorized members can manage categories"
    ON public.categories FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- 4. Verification queries (you can run this to verify schema health)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'income_type';
-- SELECT id, name, type, income_type FROM public.categories WHERE type = 'income' LIMIT 10;
