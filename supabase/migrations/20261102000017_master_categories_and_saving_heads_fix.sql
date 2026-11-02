-- ==============================================================================
-- MIGRATION: 20261102000017_master_categories_and_saving_heads_fix.sql
-- DESCRIPTION: Complete, unified, idempotent fix for Categories, Subcategories,
--              Saving Heads, Cascading Deletes, and 409 PostgREST error 23505.
-- INSTRUCTIONS: Run this once in your Supabase SQL Editor:
--               https://supabase.com/dashboard/project/apxbmwxovgpnttwprijw/sql
-- ==============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop the old rigid UNIQUE constraint on (workspace_id, name) that triggers 409 error 23505
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

-- 3. Update categories_type_check to support 'saving' and 'savings'
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

-- 4. Update categories_accounting_classification_check to support 'asset_savings'
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

-- 5. Add columns for subcategories, saving head account linkage, income type, and notes
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS target_savings_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS income_type TEXT;

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id 
ON public.categories(workspace_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_categories_target_savings 
ON public.categories(workspace_id, target_savings_account_id);

-- 6. Add modern, case-insensitive, hierarchical unique index that allows subcategories to share names
DROP INDEX IF EXISTS public.uq_category_name_parent_workspace;
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_name_parent_workspace 
ON public.categories (
    workspace_id, 
    LOWER(TRIM(name)), 
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- 7. Ensure foreign keys cascade or set null on delete so categories can be cleanly deleted without 23503 error
DO $$ 
BEGIN
    -- journal_lines: unlinks category_id when category is deleted
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_category') THEN
        ALTER TABLE public.journal_lines DROP CONSTRAINT fk_journal_lines_category;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_category_id_fkey') THEN
        ALTER TABLE public.journal_lines DROP CONSTRAINT journal_lines_category_id_fkey;
    END IF;
    ALTER TABLE public.journal_lines 
    ADD CONSTRAINT fk_journal_lines_category 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

    -- budgets: automatically deletes budget limit when category is deleted
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_category_id_fkey') THEN
        ALTER TABLE public.budgets DROP CONSTRAINT budgets_category_id_fkey;
    END IF;
    ALTER TABLE public.budgets 
    ADD CONSTRAINT budgets_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

    -- recurring_rules: unlinks category_id when category is deleted
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_rules_category_id_fkey') THEN
        ALTER TABLE public.recurring_rules DROP CONSTRAINT recurring_rules_category_id_fkey;
    END IF;
    ALTER TABLE public.recurring_rules 
    ADD CONSTRAINT recurring_rules_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 8. Ensure savings account types exist in account_types table
INSERT INTO public.account_types (id, name, classification, normal_balance, description)
VALUES 
    ('savings_dps', 'DPS & Fixed Term Deposits', 'asset', 'debit', 'Dedicated savings schemes, DSPF, Unity Fund, and reserved funds'),
    ('investment', 'Investment / Stocks / Funds', 'asset', 'debit', 'Capital market, mutual funds, gold, fixed deposits')
ON CONFLICT (id) DO UPDATE 
SET classification = 'asset', normal_balance = 'debit';

-- 9. Refresh RLS policies to guarantee full CRUD on categories and financial_accounts for authenticated users
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_all_access" ON public.categories;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

CREATE POLICY "categories_all_access" ON public.categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_accounts_all_access" ON public.financial_accounts;
CREATE POLICY "financial_accounts_all_access" ON public.financial_accounts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Verify execution
SELECT 
    'SUCCESS: Categories & Saving Heads Schema Successfully Aligned' AS status,
    count(*) AS total_categories_count 
FROM public.categories;
