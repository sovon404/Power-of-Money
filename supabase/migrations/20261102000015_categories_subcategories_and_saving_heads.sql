-- ==============================================================================
-- MIGRATION: 20261102000015_categories_subcategories_and_saving_heads.sql
-- DESCRIPTION:
-- 1. Drops and updates categories_type_check to allow 'saving' and 'savings'.
-- 2. Drops and updates categories_accounting_classification_check to allow 'asset_savings'.
-- 3. Adds parent_id to public.categories with foreign key cascade for unlimited sub-categories.
-- 4. Adds target_savings_account_id and income_type columns.
-- 5. Replaces strict uq_category_name_workspace with hierarchical unique index.
-- 6. Upgrades RLS and ensures account_types for savings schemes.
-- EXECUTION: Run in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql).
-- ==============================================================================

-- 1. Update categories_type_check constraint
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

-- 2. Update categories_accounting_classification_check constraint (Fixes PostgREST error=23514)
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

-- 3. Add parent_id for hierarchical sub-categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id 
ON public.categories(workspace_id, parent_id);

-- 4. Add target_savings_account_id and income_type if not present
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS target_savings_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS income_type TEXT;

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_target_savings 
ON public.categories(workspace_id, target_savings_account_id);

-- 5. Relax uq_category_name_workspace so sub-categories can share names across parents
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_category_name_parent_workspace 
ON public.categories (
    workspace_id, 
    LOWER(TRIM(name)), 
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- 6. Ensure savings account types exist
INSERT INTO public.account_types (id, name, classification, normal_balance, description)
VALUES 
    ('savings_dps', 'DPS & Fixed Term Deposits', 'asset', 'debit', 'Dedicated savings schemes, DSPF, Unity Fund, and reserved funds'),
    ('investment', 'Investment / Stocks / Funds', 'asset', 'debit', 'Capital market, mutual funds, gold, fixed deposits')
ON CONFLICT (id) DO UPDATE 
SET classification = 'asset', normal_balance = 'debit';

-- 7. Ensure RLS policies allow full CRUD on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "categories_all_access" ON public.categories;
    CREATE POLICY "categories_all_access" 
    ON public.categories 
    FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm 
            WHERE wm.workspace_id = categories.workspace_id 
              AND wm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm 
            WHERE wm.workspace_id = categories.workspace_id 
              AND wm.user_id = auth.uid()
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
