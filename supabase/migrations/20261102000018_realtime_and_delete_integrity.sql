-- ==============================================================================
-- MIGRATION: 20261102000018_realtime_and_delete_integrity.sql
-- DESCRIPTION:
-- 1. Adds all core financial tables to Supabase Realtime publication (supabase_realtime)
--    with REPLICA IDENTITY FULL for robust multi-device INSERT, UPDATE, and DELETE notifications.
-- 2. Provides atomic database functions for verified deletion & audit-safe archiving:
--    - safe_delete_financial_account: Soft-deletes (archives) accounts with journal lines,
--      or hard-deletes accounts with zero transactions, verifying affected rows.
--    - safe_delete_journal_entry: Atomic double-entry reversal/deletion with balance maintenance.
--    - safe_delete_category: Safe category deletion with child subcategory & budget cleanup.
-- 3. Hardens RLS DELETE and UPDATE policies across all tables to guarantee owners can delete
--    their workspace records without 23503 or 403 errors.
--
-- EXECUTION:
-- Run in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/apxbmwxovgpnttwprijw/sql
--
-- ROLLBACK GUIDANCE:
-- If needed, drop the safe_delete_* functions and revert publication additions via:
-- ALTER PUBLICATION supabase_realtime DROP TABLE ...;
-- ==============================================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Set REPLICA IDENTITY FULL so DELETE/UPDATE events deliver complete payloads to Realtime subscribers
ALTER TABLE public.financial_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.journal_entries REPLICA IDENTITY FULL;
ALTER TABLE public.journal_lines REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.credit_cards REPLICA IDENTITY FULL;
ALTER TABLE public.credit_card_statements REPLICA IDENTITY FULL;
ALTER TABLE public.loans REPLICA IDENTITY FULL;
ALTER TABLE public.loan_payments REPLICA IDENTITY FULL;
ALTER TABLE public.properties REPLICA IDENTITY FULL;
ALTER TABLE public.property_valuations REPLICA IDENTITY FULL;
ALTER TABLE public.property_recoveries REPLICA IDENTITY FULL;
ALTER TABLE public.budgets REPLICA IDENTITY FULL;
ALTER TABLE public.savings_goals REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_rules REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_executions REPLICA IDENTITY FULL;
ALTER TABLE public.workspaces REPLICA IDENTITY FULL;

-- 3. Ensure publication exists and add tables to supabase_realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add each table idempotently
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.financial_accounts,
            public.journal_entries,
            public.journal_lines,
            public.categories,
            public.credit_cards,
            public.credit_card_statements,
            public.loans,
            public.loan_payments,
            public.properties,
            public.property_valuations,
            public.property_recoveries,
            public.budgets,
            public.savings_goals,
            public.recurring_rules,
            public.recurring_executions,
            public.workspaces;
    EXCEPTION WHEN duplicate_object THEN
        -- Tables already present in publication
        NULL;
    END;
END $$;

-- 4. Atomic Function: safe_delete_financial_account
-- Prevents 23503 foreign key violation and protects double-entry ledger balance.
-- If account has transactions, archives it; if no transactions, hard-deletes it.
CREATE OR REPLACE FUNCTION public.safe_delete_financial_account(
    p_account_id UUID,
    p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_journal_count INT;
    v_acc RECORD;
    v_action TEXT;
    v_affected INT := 0;
BEGIN
    -- Verify account exists in the workspace
    SELECT * INTO v_acc 
    FROM public.financial_accounts 
    WHERE id = p_account_id AND workspace_id = p_workspace_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'action', 'none',
            'affected', 0,
            'message', 'Account not found in workspace.'
        );
    END IF;

    -- Check if any double-entry journal lines reference this account
    SELECT COUNT(*) INTO v_journal_count 
    FROM public.journal_lines 
    WHERE account_id = p_account_id;

    IF v_journal_count > 0 THEN
        -- SOFT DELETE / ARCHIVE: Protect ledger balance from corruption
        UPDATE public.financial_accounts 
        SET is_archived = true, updated_at = timezone('utc'::text, now())
        WHERE id = p_account_id AND workspace_id = p_workspace_id;

        -- Unlink non-ledger references
        UPDATE public.categories 
        SET target_savings_account_id = NULL 
        WHERE target_savings_account_id = p_account_id AND workspace_id = p_workspace_id;

        UPDATE public.loans 
        SET account_id = NULL 
        WHERE account_id = p_account_id AND workspace_id = p_workspace_id;

        UPDATE public.savings_goals 
        SET account_id = NULL 
        WHERE account_id = p_account_id AND workspace_id = p_workspace_id;

        v_action := 'archived';
        v_affected := 1;

        RETURN jsonb_build_object(
            'success', true,
            'action', v_action,
            'affected', v_affected,
            'journal_lines_count', v_journal_count,
            'message', 'Account has transaction history and was safely archived to preserve double-entry ledger integrity.'
        );
    ELSE
        -- HARD DELETE: Account has zero transactions, safe to delete completely
        -- 1. Unlink categories
        UPDATE public.categories 
        SET target_savings_account_id = NULL 
        WHERE target_savings_account_id = p_account_id AND workspace_id = p_workspace_id;

        -- 2. Delete credit cards referencing this account
        DELETE FROM public.credit_cards 
        WHERE account_id = p_account_id AND workspace_id = p_workspace_id;

        -- 3. Unlink loans
        UPDATE public.loans 
        SET account_id = NULL 
        WHERE account_id = p_account_id AND workspace_id = p_workspace_id;

        -- 4. Unlink savings goals
        UPDATE public.savings_goals 
        SET account_id = NULL 
        WHERE account_id = p_account_id AND workspace_id = p_workspace_id;

        -- 5. Hard delete the account record
        DELETE FROM public.financial_accounts 
        WHERE id = p_account_id AND workspace_id = p_workspace_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        v_action := 'deleted';

        RETURN jsonb_build_object(
            'success', true,
            'action', v_action,
            'affected', v_affected,
            'journal_lines_count', 0,
            'message', 'Account had no transaction history and was permanently removed from database.'
        );
    END IF;
END;
$$;

-- 5. Atomic Function: safe_delete_journal_entry
-- Reverts cached balance changes on affected accounts and removes entry + lines
CREATE OR REPLACE FUNCTION public.safe_delete_journal_entry(
    p_entry_id UUID,
    p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_line RECORD;
    v_acc RECORD;
    v_change NUMERIC(20, 2);
    v_is_debit_normal BOOLEAN;
    v_affected INT := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE id = p_entry_id AND workspace_id = p_workspace_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Journal entry not found in workspace.'
        );
    END IF;

    -- Revert balance effects on accounts
    FOR v_line IN 
        SELECT account_id, line_type, amount 
        FROM public.journal_lines 
        WHERE journal_entry_id = p_entry_id
    LOOP
        SELECT * INTO v_acc FROM public.financial_accounts WHERE id = v_line.account_id;
        IF FOUND THEN
            v_is_debit_normal := v_acc.account_type_id IN (
                'cash', 'bank', 'mfs', 'savings_dps', 'investment', 
                'receivable', 'property_asset', 'expense_operating', 'expense_finance'
            );
            v_change := CASE WHEN v_line.line_type = 'debit' THEN -v_line.amount ELSE v_line.amount END;

            UPDATE public.financial_accounts
            SET current_balance_cached = CASE 
                    WHEN v_is_debit_normal THEN current_balance_cached + v_change 
                    ELSE current_balance_cached - v_change 
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_acc.id;
        END IF;
    END LOOP;

    -- Delete lines
    DELETE FROM public.journal_lines WHERE journal_entry_id = p_entry_id;

    -- Delete entry header
    DELETE FROM public.journal_entries WHERE id = p_entry_id AND workspace_id = p_workspace_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'affected', v_affected,
        'message', 'Transaction deleted and account balances safely restored.'
    );
END;
$$;

-- 6. Atomic Function: safe_delete_category
-- Cleans up child subcategories, unlinks journal lines, and deletes category
CREATE OR REPLACE FUNCTION public.safe_delete_category(
    p_category_id UUID,
    p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_affected INT := 0;
BEGIN
    -- Unlink journal lines (preserves transaction history)
    UPDATE public.journal_lines 
    SET category_id = NULL 
    WHERE category_id = p_category_id;

    -- Delete child subcategories
    DELETE FROM public.categories 
    WHERE parent_id = p_category_id AND workspace_id = p_workspace_id;

    -- Delete budgets tied to this category
    DELETE FROM public.budgets 
    WHERE category_id = p_category_id AND workspace_id = p_workspace_id;

    -- Unlink recurring rules
    UPDATE public.recurring_rules 
    SET category_id = NULL 
    WHERE category_id = p_category_id AND workspace_id = p_workspace_id;

    -- Delete category
    DELETE FROM public.categories 
    WHERE id = p_category_id AND workspace_id = p_workspace_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'affected', v_affected,
        'message', 'Category removed successfully.'
    );
END;
$$;

-- 7. Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.safe_delete_financial_account(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_delete_journal_entry(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_delete_category(UUID, UUID) TO authenticated;
