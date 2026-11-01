-- ==============================================================================
-- MIGRATION: 20261101000010_historical_entries_and_crud_support.sql
-- DESCRIPTION: 
-- 1. Adds 'is_historical' and 'historical_note' to 'journal_entries' for prior-period legacy entries.
-- 2. Grants full UPDATE and DELETE permissions on journal_entries and journal_lines to authorized workspace members.
-- 3. Ensures CASCADE on foreign keys for clean deletion of cards, loans, properties, budgets, and savings goals.
-- EXECUTION: Run this script directly in your Supabase Project SQL Editor.
-- ==============================================================================

-- 1. Add historical tracking columns to journal_entries
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;

ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS historical_note TEXT;

-- Create index for high-performance period queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_historical 
ON public.journal_entries(workspace_id, is_historical, entry_date);

-- 2. Grant full CRUD (INSERT, UPDATE, DELETE) to authorized workspace members
-- Journal Entries
DROP POLICY IF EXISTS "Authorized members can insert journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Authorized members can manage journal entries" ON public.journal_entries;

CREATE POLICY "Authorized members can manage journal entries"
    ON public.journal_entries FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Journal Lines
DROP POLICY IF EXISTS "Authorized members can insert journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Authorized members can manage journal lines" ON public.journal_lines;

CREATE POLICY "Authorized members can manage journal lines"
    ON public.journal_lines FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Categories
DROP POLICY IF EXISTS "Authorized members can manage categories" ON public.categories;
CREATE POLICY "Authorized members can manage categories"
    ON public.categories FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Credit Cards
DROP POLICY IF EXISTS "Authorized members can manage credit cards" ON public.credit_cards;
CREATE POLICY "Authorized members can manage credit cards"
    ON public.credit_cards FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Financial Accounts
DROP POLICY IF EXISTS "Authorized members can manage accounts" ON public.financial_accounts;
CREATE POLICY "Authorized members can manage accounts"
    ON public.financial_accounts FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Loans
DROP POLICY IF EXISTS "Authorized members can manage loans" ON public.loans;
CREATE POLICY "Authorized members can manage loans"
    ON public.loans FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Properties
DROP POLICY IF EXISTS "Authorized members can manage properties" ON public.properties;
CREATE POLICY "Authorized members can manage properties"
    ON public.properties FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Budgets
DROP POLICY IF EXISTS "Authorized members can manage budgets" ON public.budgets;
CREATE POLICY "Authorized members can manage budgets"
    ON public.budgets FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- Savings Goals
DROP POLICY IF EXISTS "Authorized members can manage savings goals" ON public.savings_goals;
CREATE POLICY "Authorized members can manage savings goals"
    ON public.savings_goals FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));
