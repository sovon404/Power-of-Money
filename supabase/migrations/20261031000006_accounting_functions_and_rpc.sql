-- ==============================================================================
-- MIGRATION: 20261031000006_accounting_functions_and_rpc.sql
-- DESCRIPTION: Core double-entry ledger functions, idempotent category seeder
--              for the 36 user categories, transfer RPC, opening balance RPC,
--              and transaction reversal RPC.
-- EXECUTION: Run in Supabase SQL Editor after migration 5.
-- ==============================================================================

-- 1. Idempotent Seed Function for the 36 User-Specified Categories
CREATE OR REPLACE FUNCTION public.seed_workspace_categories(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.categories (workspace_id, name, type, accounting_classification, icon, color, is_seed, sort_order)
    VALUES
        (p_workspace_id, 'Home Expense', 'expense', 'expense_operating', 'home', '#0284c7', true, 1),
        (p_workspace_id, 'Loan Repayment', 'expense', 'liability_reduction', 'shield-alert', '#e11d48', true, 2),
        (p_workspace_id, 'Dps', 'transfer_allocation', 'asset_transfer', 'piggy-bank', '#16a34a', true, 3),
        (p_workspace_id, 'Friends Fund Installment', 'expense', 'liability_reduction', 'users', '#ca8a04', true, 4),
        (p_workspace_id, 'Medical (Family)', 'expense', 'expense_operating', 'heart-pulse', '#dc2626', true, 5),
        (p_workspace_id, 'Investment', 'transfer_allocation', 'asset_transfer', 'trending-up', '#059669', true, 6),
        (p_workspace_id, 'Pop-Up Expenses', 'expense', 'expense_operating', 'sparkles', '#ea580c', true, 7),
        (p_workspace_id, 'Megabite', 'expense', 'expense_operating', 'wifi', '#2563eb', true, 8),
        (p_workspace_id, 'Dsp (BAF)', 'transfer_allocation', 'asset_transfer', 'landmark', '#0d9488', true, 9),
        (p_workspace_id, 'Los Fund (Installment)', 'expense', 'liability_reduction', 'layers', '#9333ea', true, 10),
        (p_workspace_id, 'Non-Interest Loan Repayment', 'expense', 'liability_reduction', 'handshake', '#475569', true, 11),
        (p_workspace_id, 'Leave', 'expense', 'expense_operating', 'calendar', '#64748b', true, 12),
        (p_workspace_id, 'Wifi (Home)', 'expense', 'expense_operating', 'wifi', '#0284c7', true, 13),
        (p_workspace_id, 'Electricity (Home)', 'expense', 'expense_operating', 'zap', '#f59e0b', true, 14),
        (p_workspace_id, 'Personal (Food)', 'expense', 'expense_operating', 'utensils', '#f97316', true, 15),
        (p_workspace_id, 'Mess Bill', 'expense', 'expense_operating', 'coffee', '#d97706', true, 16),
        (p_workspace_id, 'Lend Money (To Others)', 'transfer_allocation', 'receivable_outflow', 'arrow-up-right', '#6366f1', true, 17),
        (p_workspace_id, 'Bank & Card Charge', 'expense', 'expense_finance', 'credit-card', '#ef4444', true, 18),
        (p_workspace_id, 'Lend Money Return', 'income', 'income_operating', 'arrow-down-left', '#10b981', true, 19),
        (p_workspace_id, 'PSI', 'expense', 'expense_operating', 'file-text', '#64748b', true, 20),
        (p_workspace_id, 'Wify', 'expense', 'expense_operating', 'radio', '#06b6d4', true, 21),
        (p_workspace_id, 'Sisters', 'expense', 'expense_operating', 'heart', '#ec4899', true, 22),
        (p_workspace_id, 'Minutes', 'expense', 'expense_operating', 'phone', '#84cc16', true, 23),
        (p_workspace_id, 'Tailor Shop Svc', 'expense', 'expense_operating', 'scissors', '#a855f7', true, 24),
        (p_workspace_id, 'FWS', 'expense', 'expense_operating', 'briefcase', '#3b82f6', true, 25),
        (p_workspace_id, 'Swimming Pool', 'expense', 'expense_operating', 'waves', '#0ea5e9', true, 26),
        (p_workspace_id, 'Personal (Transport)', 'expense', 'expense_operating', 'car', '#8b5cf6', true, 27),
        (p_workspace_id, 'Haircut', 'expense', 'expense_operating', 'smile', '#f43f5e', true, 28),
        (p_workspace_id, 'Personal (Tech)', 'expense', 'expense_operating', 'laptop', '#3b82f6', true, 29),
        (p_workspace_id, 'Personal (Recreations)', 'expense', 'expense_operating', 'film', '#14b8a6', true, 30),
        (p_workspace_id, 'Others (svc)', 'expense', 'expense_operating', 'tool', '#71717a', true, 31),
        (p_workspace_id, 'Donations', 'expense', 'expense_operating', 'gift', '#22c55e', true, 32),
        (p_workspace_id, 'Unity Fund-2026', 'expense', 'liability_reduction', 'flag', '#eab308', true, 33),
        (p_workspace_id, 'Protein Target', 'expense', 'expense_operating', 'activity', '#10b981', true, 34),
        (p_workspace_id, 'Adjustment', 'expense', 'expense_operating', 'sliders', '#64748b', true, 35),
        (p_workspace_id, 'FITA', 'expense', 'expense_operating', 'award', '#f59e0b', true, 36)
    ON CONFLICT (workspace_id, name) DO NOTHING;

    -- Also seed common default Income categories
    INSERT INTO public.categories (workspace_id, name, type, accounting_classification, icon, color, is_seed, sort_order)
    VALUES
        (p_workspace_id, 'Salary', 'income', 'income_operating', 'briefcase', '#10b981', true, 101),
        (p_workspace_id, 'Allowances & Bonus', 'income', 'income_operating', 'award', '#059669', true, 102),
        (p_workspace_id, 'Business / Freelance', 'income', 'income_operating', 'laptop', '#047857', true, 103),
        (p_workspace_id, 'Rental Income', 'income', 'income_operating', 'building', '#065f46', true, 104),
        (p_workspace_id, 'Investment Returns', 'income', 'income_operating', 'trending-up', '#064e3b', true, 105),
        (p_workspace_id, 'Other Income', 'income', 'income_operating', 'plus-circle', '#14b8a6', true, 106)
    ON CONFLICT (workspace_id, name) DO NOTHING;
END;
$$;

-- 2. Idempotent Workspace Initializer Function
CREATE OR REPLACE FUNCTION public.initialize_new_workspace(p_workspace_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Ensure user profile exists
    INSERT INTO public.profiles (id, email, full_name)
    SELECT p_user_id, 'user@example.com', 'Account Owner'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id);

    -- 2. Ensure membership
    INSERT INTO public.workspace_members (workspace_id, user_id, role, permissions, status)
    VALUES (
        p_workspace_id,
        p_user_id,
        'owner',
        '{"can_view_accounts": true, "can_manage_accounts": true, "can_view_ledger": true, "can_post_transactions": true, "can_view_cards": true, "can_manage_cards": true, "can_view_loans": true, "can_manage_loans": true, "can_view_properties": true, "can_manage_properties": true, "can_view_budgets": true, "can_manage_budgets": true, "can_manage_members": true}'::jsonb,
        'active'
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner', status = 'active';

    -- 3. Seed default financial accounts if none exist
    INSERT INTO public.financial_accounts (workspace_id, name, account_type_id, provider, current_balance_cached, icon, color)
    VALUES 
        (p_workspace_id, 'Cash in Hand', 'cash', 'Cash', 0.00, 'banknote', '#10b981'),
        (p_workspace_id, 'bKash Wallet', 'mfs', 'bKash', 0.00, 'smartphone', '#e11d48'),
        (p_workspace_id, 'Nagad Wallet', 'mfs', 'Nagad', 0.00, 'smartphone', '#f97316'),
        (p_workspace_id, 'BRAC Bank Checking', 'bank', 'BRAC Bank', 0.00, 'landmark', '#0284c7'),
        (p_workspace_id, 'Opening Balance Equity', 'opening_equity', 'System', 0.00, 'scale', '#64748b')
    ON CONFLICT DO NOTHING;

    -- 4. Seed the 36 categories
    PERFORM public.seed_workspace_categories(p_workspace_id);
END;
$$;

-- 3. Strict Double-Entry Posting RPC
CREATE OR REPLACE FUNCTION public.post_journal_entry(
    p_workspace_id UUID,
    p_memo TEXT,
    p_source_type TEXT,
    p_source_id TEXT,
    p_entry_date DATE,
    p_lines JSONB -- Array of { "account_id": UUID, "line_type": "debit"|"credit", "amount": 100.00, "memo": "", "category_id": UUID|null }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entry_id UUID;
    v_line JSONB;
    v_total_debit NUMERIC(20, 2) := 0.00;
    v_total_credit NUMERIC(20, 2) := 0.00;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Calculate sums to enforce exact balance
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        IF (v_line->>'line_type') = 'debit' THEN
            v_total_debit := v_total_debit + (v_line->>'amount')::NUMERIC(20, 2);
        ELSIF (v_line->>'line_type') = 'credit' THEN
            v_total_credit := v_total_credit + (v_line->>'amount')::NUMERIC(20, 2);
        ELSE
            RAISE EXCEPTION 'Invalid line_type: %. Must be debit or credit.', (v_line->>'line_type');
        END IF;
    END LOOP;

    -- Strict balance requirement: Total Debits == Total Credits
    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'Unbalanced journal entry rejected. Total debits (%) must equal total credits (%).', v_total_debit, v_total_credit;
    END IF;

    IF v_total_debit <= 0 THEN
        RAISE EXCEPTION 'Journal entry amounts must be strictly greater than zero.';
    END IF;

    -- Create Header
    INSERT INTO public.journal_entries (
        workspace_id, entry_date, memo, source_type, source_id, status, created_by
    ) VALUES (
        p_workspace_id, p_entry_date, p_memo, p_source_type, p_source_id, 'posted', v_user_id
    ) RETURNING id INTO v_entry_id;

    -- Insert Lines & Update Account Cached Balances
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO public.journal_lines (
            journal_entry_id, workspace_id, account_id, line_type, amount, memo, category_id
        ) VALUES (
            v_entry_id,
            p_workspace_id,
            (v_line->>'account_id')::UUID,
            v_line->>'line_type',
            (v_line->>'amount')::NUMERIC(20, 2),
            v_line->>'memo',
            (v_line->>'category_id')::UUID
        );

        -- Adjust account cached balance according to account classification
        UPDATE public.financial_accounts fa
        SET 
            current_balance_cached = fa.current_balance_cached + (
                CASE 
                    WHEN at.normal_balance = 'debit' THEN
                        (CASE WHEN (v_line->>'line_type') = 'debit' THEN (v_line->>'amount')::NUMERIC(20, 2) ELSE -(v_line->>'amount')::NUMERIC(20, 2) END)
                    ELSE
                        (CASE WHEN (v_line->>'line_type') = 'credit' THEN (v_line->>'amount')::NUMERIC(20, 2) ELSE -(v_line->>'amount')::NUMERIC(20, 2) END)
                END
            ),
            updated_at = timezone('utc'::text, now())
        FROM public.account_types at
        WHERE fa.id = (v_line->>'account_id')::UUID AND fa.account_type_id = at.id;
    END LOOP;

    -- Audit trail
    INSERT INTO public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, details)
    VALUES (
        p_workspace_id, 
        v_user_id, 
        'POST_JOURNAL_ENTRY', 
        'journal_entry', 
        v_entry_id::TEXT, 
        jsonb_build_object('memo', p_memo, 'amount', v_total_debit, 'source_type', p_source_type)
    );

    RETURN v_entry_id;
END;
$$;

-- 4. Transfer RPC (Account to Account without Income/Expense Distortion)
CREATE OR REPLACE FUNCTION public.post_account_transfer(
    p_workspace_id UUID,
    p_source_account_id UUID,
    p_destination_account_id UUID,
    p_amount NUMERIC(20, 2),
    p_date DATE,
    p_memo TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lines JSONB;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be positive.';
    END IF;

    IF p_source_account_id = p_destination_account_id THEN
        RAISE EXCEPTION 'Source and destination accounts cannot be identical.';
    END IF;

    -- Double-entry rule:
    -- Debit Destination Account (Increases Asset)
    -- Credit Source Account (Decreases Asset)
    v_lines := jsonb_build_array(
        jsonb_build_object(
            'account_id', p_destination_account_id,
            'line_type', 'debit',
            'amount', p_amount,
            'memo', COALESCE(p_memo, 'Transfer received')
        ),
        jsonb_build_object(
            'account_id', p_source_account_id,
            'line_type', 'credit',
            'amount', p_amount,
            'memo', COALESCE(p_memo, 'Transfer sent')
        )
    );

    RETURN public.post_journal_entry(
        p_workspace_id,
        COALESCE(p_memo, 'Account Transfer'),
        'transfer',
        NULL,
        p_date,
        v_lines
    );
END;
$$;

-- 5. Reversal RPC (Audit-compliant correction, never silent edit)
CREATE OR REPLACE FUNCTION public.post_transaction_reversal(
    p_journal_entry_id UUID,
    p_reversal_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig RECORD;
    v_line RECORD;
    v_reversal_lines JSONB := '[]'::jsonb;
    v_reversal_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    SELECT * INTO v_orig FROM public.journal_entries WHERE id = p_journal_entry_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original journal entry % not found.', p_journal_entry_id;
    END IF;

    IF v_orig.status = 'reversed' THEN
        RAISE EXCEPTION 'Journal entry is already reversed.';
    END IF;

    -- Mirror every line: swap debit to credit, credit to debit
    FOR v_line IN SELECT * FROM public.journal_lines WHERE journal_entry_id = p_journal_entry_id
    LOOP
        v_reversal_lines := v_reversal_lines || jsonb_build_object(
            'account_id', v_line.account_id,
            'line_type', CASE WHEN v_line.line_type = 'debit' THEN 'credit' ELSE 'debit' END,
            'amount', v_line.amount,
            'memo', 'REVERSAL: ' || COALESCE(v_line.memo, v_orig.memo),
            'category_id', v_line.category_id
        );
    END LOOP;

    -- Post the mirror entry
    v_reversal_id := public.post_journal_entry(
        v_orig.workspace_id,
        'REVERSAL: ' || v_orig.memo || ' (' || p_reversal_reason || ')',
        v_orig.source_type,
        v_orig.source_id,
        CURRENT_DATE,
        v_reversal_lines
    );

    -- Link reversal
    UPDATE public.journal_entries 
    SET 
        status = 'reversed',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_journal_entry_id;

    UPDATE public.journal_entries 
    SET 
        is_reversal = TRUE,
        reversal_of_entry_id = p_journal_entry_id
    WHERE id = v_reversal_id;

    -- Audit trail
    INSERT INTO public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, details)
    VALUES (
        v_orig.workspace_id,
        v_user_id,
        'REVERSE_JOURNAL_ENTRY',
        'journal_entry',
        p_journal_entry_id::TEXT,
        jsonb_build_object('reversal_entry_id', v_reversal_id, 'reason', p_reversal_reason)
    );

    RETURN v_reversal_id;
END;
$$;
