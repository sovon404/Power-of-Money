-- ==============================================================================
-- MIGRATION: 20261102000012_savings_category_and_heads.sql
-- DESCRIPTION:
-- 1. Updates public.categories constraint to include 'saving' category type.
-- 2. Adds target_savings_account_id to public.categories linking saving categories directly to financial_accounts.
-- 3. Ensures savings_dps and investment accounts have proper debit normal balance.
-- 4. Automatically associates default saving categories (DSPF, Unity Fund) to their respective heads.
-- EXECUTION: Run in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql).
-- ==============================================================================

-- 1. Allow 'saving' in public.categories.type check constraint
DO $$ 
BEGIN
    -- Drop existing check constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_type_check'
    ) THEN
        ALTER TABLE public.categories DROP CONSTRAINT categories_type_check;
    END IF;

    -- Add updated constraint including 'saving'
    ALTER TABLE public.categories 
    ADD CONSTRAINT categories_type_check 
    CHECK (type IN ('income', 'expense', 'transfer_allocation', 'saving'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Add target_savings_account_id to public.categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS target_savings_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_target_savings 
ON public.categories(workspace_id, target_savings_account_id);

-- 3. Ensure savings_dps and investment account types exist and are debit-normal assets
INSERT INTO public.account_types (id, name, classification, normal_balance, description)
VALUES 
    ('savings_dps', 'DPS & Fixed Term Deposits', 'asset', 'debit', 'Dedicated savings schemes, DSPF, Unity Fund, and reserved funds'),
    ('investment', 'Investment / Stocks / Funds', 'asset', 'debit', 'Capital market, mutual funds, gold, fixed deposits')
ON CONFLICT (id) DO UPDATE 
SET classification = 'asset', normal_balance = 'debit';

-- 4. Upgrade seed savings categories to 'saving' type
UPDATE public.categories
SET type = 'saving',
    accounting_classification = 'asset_transfer'
WHERE LOWER(name) IN ('dps', 'dsp (baf)', 'unity fund-2026')
  AND type <> 'saving';

-- 5. Auto-link seed categories to matching financial accounts if available
UPDATE public.categories c
SET target_savings_account_id = fa.id
FROM public.financial_accounts fa
WHERE c.workspace_id = fa.workspace_id
  AND (
    (c.name ILIKE '%unity fund%' AND fa.name ILIKE '%unity fund%') OR
    (c.name ILIKE '%dsp%' AND fa.name ILIKE '%dsp%') OR
    (c.name ILIKE '%baf%' AND fa.name ILIKE '%baf%') OR
    (c.name ILIKE '%los fund%' AND fa.name ILIKE '%los fund%')
  )
  AND c.target_savings_account_id IS NULL;
