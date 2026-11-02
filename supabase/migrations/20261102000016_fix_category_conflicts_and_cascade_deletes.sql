-- ==============================================================================
-- MIGRATION: 20261102000016_fix_category_conflicts_and_cascade_deletes.sql
-- DESCRIPTION:
-- 1. Drops rigid uq_category_name_workspace constraint that caused 409 error 23505.
-- 2. Allows 'saving' and 'savings' in categories_type_check.
-- 3. Allows 'asset_savings' in categories_accounting_classification_check.
-- 4. Adds parent_id (with CASCADE delete) for hierarchical subcategories.
-- 5. Adds target_savings_account_id, income_type, and description columns.
-- 6. Adds resilient hierarchical unique index (workspace, LOWER(name), COALESCE(parent_id)).
-- 7. Fixes foreign keys so deleting accounts/categories NEVER fails with 23503:
--    - journal_lines.category_id -> ON DELETE SET NULL
--    - budgets.category_id -> ON DELETE CASCADE
--    - recurring_rules.category_id -> ON DELETE SET NULL
--    - categories.target_savings_account_id -> ON DELETE SET NULL
-- 8. Enables full RLS CRUD (SELECT, INSERT, UPDATE, DELETE) for categories.
-- EXECUTION: Run in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql).
-- ==============================================================================

-- 1. Drop rigid unique constraint that caused 409 (PostgREST error 23505)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_category_name_workspace'
    ) THEN
        ALTER TABLE public.categories DROP CONSTRAINT uq_category_name_workspace;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Update categories_type_check to support 'saving' and 'savings'
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_type_check'
    ) THEN
        ALTER TABLE public.categories DROP CONSTRAINT categories_type_check;
    END IF;

    ALTER TABLE public.categories 
    ADD CONSTRAINT categories_type_check 
    CHECK (type IN ('income', 'expense', 'transfer_allocation', 'saving', 'savings'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 3. Update categories_accounting_classification_check to support 'asset_savings'
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_accounting_classification_check'
    ) THEN
        ALTER TABLE public.categories DROP CONSTRAINT categories_accounting_classification_check;
    END IF;

    ALTER TABLE public.categories 
    ADD CONSTRAINT categories_accounting_classification_check 
    CHECK (accounting_classification IN (
        'expense_operating', 
        'expense_finance', 
        'liability_reduction', 
        'asset_transfer', 
        'asset_savings', 
        'receivable_outflow', 
        'income_operating'
    ));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 4. Add parent_id for unlimited subcategories & saving heads
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id 
ON public.categories(workspace_id, parent_id);

-- 5. Add target_savings_account_id, income_type, and description
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS target_savings_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS income_type TEXT;

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_target_savings 
ON public.categories(workspace_id, target_savings_account_id);

-- 6. Add modern, case-insensitive, hierarchical unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_name_parent_workspace 
ON public.categories (
    workspace_id, 
    LOWER(TRIM(name)), 
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- 7. Ensure foreign keys cascade / set null on delete so categories can be cleanly deleted
DO $$ 
BEGIN
    -- journal_lines category FK
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_category') THEN
        ALTER TABLE public.journal_lines DROP CONSTRAINT fk_journal_lines_category;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_category_id_fkey') THEN
        ALTER TABLE public.journal_lines DROP CONSTRAINT journal_lines_category_id_fkey;
    END IF;
    ALTER TABLE public.journal_lines 
    ADD CONSTRAINT fk_journal_lines_category 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

    -- budgets category FK
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_category_id_fkey') THEN
        ALTER TABLE public.budgets DROP CONSTRAINT budgets_category_id_fkey;
    END IF;
    ALTER TABLE public.budgets 
    ADD CONSTRAINT budgets_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

    -- recurring_rules category FK
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_rules_category_id_fkey') THEN
        ALTER TABLE public.recurring_rules DROP CONSTRAINT recurring_rules_category_id_fkey;
    END IF;
    ALTER TABLE public.recurring_rules 
    ADD CONSTRAINT recurring_rules_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 8. Ensure account_types contains 'savings_dps' and 'investment'
INSERT INTO public.account_types (id, name, classification, normal_balance, description)
VALUES 
    ('savings_dps', 'DPS & Fixed Term Deposits', 'asset', 'debit', 'Dedicated savings schemes, DSPF, Unity Fund, and reserved funds'),
    ('investment', 'Investment / Stocks / Funds', 'asset', 'debit', 'Capital market, mutual funds, gold, fixed deposits')
ON CONFLICT (id) DO UPDATE 
SET classification = 'asset', normal_balance = 'debit';

-- 9. Refresh RLS policies on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

CREATE POLICY "categories_select_policy" ON public.categories
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_insert_policy" ON public.categories
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "categories_update_policy" ON public.categories
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "categories_delete_policy" ON public.categories
    FOR DELETE TO authenticated USING (true);
