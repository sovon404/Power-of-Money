-- Migration: 20261102000013_period_end_date_and_enhancements.sql
-- Description: Adds period_end_date to journal_entries for multi-year/span entries, ensures saving category type, and updates indexes.

-- 1. Add period_end_date column to public.journal_entries
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS period_end_date DATE;

-- 2. Add an index for fast date-range and overlapping period queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_period 
ON public.journal_entries (workspace_id, entry_date, period_end_date);

-- 3. Ensure categories support 'saving' and 'transfer_allocation' types
DO $$ 
BEGIN
  -- Drop existing check constraint if it restricts types
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'categories' AND constraint_name = 'categories_type_check'
  ) THEN
    ALTER TABLE public.categories DROP CONSTRAINT categories_type_check;
  END IF;

  -- Add updated check constraint allowing saving and transfer_allocation
  ALTER TABLE public.categories 
  ADD CONSTRAINT categories_type_check 
  CHECK (type IN ('income', 'expense', 'saving', 'transfer_allocation'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'categories_type_check check constraint adjustment skipped: %', SQLERRM;
END $$;

-- 4. Ensure target_savings_account_id exists on categories for auto-directing savings
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS target_savings_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

-- 5. Ensure income_type exists on categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS income_type TEXT DEFAULT 'other';

-- 6. Add comment explaining period_end_date usage
COMMENT ON COLUMN public.journal_entries.period_end_date IS 'Optional end date for historical span entries or cumulative records (e.g., 2025-01-01 to 2026-12-31).';
