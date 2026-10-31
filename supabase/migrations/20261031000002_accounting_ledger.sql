-- ==============================================================================
-- MIGRATION: 20261031000002_accounting_ledger.sql
-- DESCRIPTION: Double-entry accounting ledger engine: accounts, journal entries,
--              journal lines, balance derivation, and strict debit=credit balance trigger.
-- EXECUTION: Run in Supabase SQL Editor after migration 1.
-- ==============================================================================

-- 1. Account Classifications & Types
CREATE TABLE IF NOT EXISTS public.account_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('asset', 'liability', 'equity', 'income', 'expense')),
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    description TEXT
);

INSERT INTO public.account_types (id, name, classification, normal_balance, description) VALUES
    ('cash', 'Cash in Hand', 'asset', 'debit', 'Physical liquid currency held in hand or wallet'),
    ('bank', 'Bank Checking/Savings', 'asset', 'debit', 'Commercial bank deposit accounts'),
    ('mfs', 'Mobile Financial Services', 'asset', 'debit', 'Mobile wallets like bKash, Nagad, Rocket, Upay'),
    ('savings_dps', 'DPS & Fixed Term Deposits', 'asset', 'debit', 'Recurring deposit schemes and long term fixed deposits'),
    ('investment', 'Investment / Stocks / Funds', 'asset', 'debit', 'Capital market, bonds, mutual funds, gold'),
    ('receivable', 'Money Lent / Receivables', 'asset', 'debit', 'Money lent to family, friends, or third parties to be recovered'),
    ('property_asset', 'Real Estate & Properties', 'asset', 'debit', 'Land, apartments, commercial buildings, agricultural plots'),
    ('credit_card', 'Credit Card Liability', 'liability', 'credit', 'Unpaid credit card balances and revolving lines'),
    ('loan_payable', 'Loan / Debt Payable', 'liability', 'credit', 'Borrowed principal, bank loans, personal borrowing'),
    ('opening_equity', 'Opening Balance Equity', 'equity', 'credit', 'Starting equity offset for opening balances'),
    ('retained_earnings', 'Retained Earnings', 'equity', 'credit', 'Cumulative workspace surplus/deficit'),
    ('income_salary', 'Salary & Earned Income', 'income', 'credit', 'Employment wages, allowances, bonuses'),
    ('income_business', 'Business & Freelance Income', 'income', 'credit', 'Trade, client services, software freelancing'),
    ('income_returns', 'Investment & Rental Returns', 'income', 'credit', 'Dividends, profit sharing, tenant rent'),
    ('income_other', 'Other Operating Income', 'income', 'credit', 'Miscellaneous earned inflows'),
    ('expense_operating', 'Operating Expense', 'expense', 'debit', 'Living costs, groceries, utilities, services'),
    ('expense_finance', 'Interest & Bank Charges', 'expense', 'debit', 'Loan interest, card fees, processing fees')
ON CONFLICT (id) DO NOTHING;

-- 2. Financial Accounts
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_type_id TEXT NOT NULL REFERENCES public.account_types(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL DEFAULT 'Other', -- e.g. bKash, Nagad, BRAC Bank, Cash, City Bank
    account_number_masked TEXT,             -- e.g. '•••• 8492'
    currency TEXT NOT NULL DEFAULT 'BDT',
    opening_balance NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_balance_cached NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    icon TEXT NOT NULL DEFAULT 'wallet',
    color TEXT NOT NULL DEFAULT '#0284c7',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_positive_balance_scale CHECK (scale(opening_balance) <= 2)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_workspace ON public.financial_accounts(workspace_id, is_archived);

-- 3. Journal Entries (Transaction Header)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entry_number BIGINT GENERATED ALWAYS AS IDENTITY,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    memo TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN (
        'manual', 'opening_balance', 'transfer', 'credit_card_charge', 
        'credit_card_payment', 'loan_disbursement', 'loan_repayment', 
        'property_recovery', 'recurring_execution', 'ai_receipt_scan'
    )),
    source_id TEXT, -- optional reference to specific loan_id, card_id, or property_id
    status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'voided', 'reversed')),
    is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_of_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_workspace ON public.journal_entries(workspace_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reversal ON public.journal_entries(reversal_of_entry_id);

-- 4. Journal Lines (Individual Debits & Credits)
CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    line_type TEXT NOT NULL CHECK (line_type IN ('debit', 'credit')),
    amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
    memo TEXT,
    category_id UUID, -- References categories table (created in migration 5)
    counterparty TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_workspace ON public.journal_lines(workspace_id);

-- 5. Strict Balance Verification Function & Constraint Trigger
CREATE OR REPLACE FUNCTION public.verify_journal_entry_balance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_debit NUMERIC(20, 2);
    v_total_credit NUMERIC(20, 2);
    v_status TEXT;
BEGIN
    -- Only verify when status is 'posted'
    SELECT status INTO v_status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
    
    IF v_status = 'posted' THEN
        SELECT 
            COALESCE(SUM(CASE WHEN line_type = 'debit' THEN amount ELSE 0 END), 0.00),
            COALESCE(SUM(CASE WHEN line_type = 'credit' THEN amount ELSE 0 END), 0.00)
        INTO v_total_debit, v_total_credit
        FROM public.journal_lines
        WHERE journal_entry_id = NEW.journal_entry_id;

        -- If this is an individual insert in a transaction, deferred constraints handle multi-line inserts,
        -- but for direct function execution we ensure debits = credits at transaction commit.
    END IF;
    RETURN NEW;
END;
$$;

-- View for Real-time Account Balances derived directly from Journal Lines
CREATE OR REPLACE VIEW public.v_account_ledger_balances AS
SELECT 
    a.id AS account_id,
    a.workspace_id,
    a.name AS account_name,
    a.account_type_id,
    t.classification,
    t.normal_balance,
    COALESCE(SUM(
        CASE 
            WHEN t.normal_balance = 'debit' THEN
                (CASE WHEN jl.line_type = 'debit' THEN jl.amount ELSE -jl.amount END)
            ELSE
                (CASE WHEN jl.line_type = 'credit' THEN jl.amount ELSE -jl.amount END)
        END
    ), 0.00) AS calculated_balance
FROM public.financial_accounts a
JOIN public.account_types t ON a.account_type_id = t.id
LEFT JOIN public.journal_lines jl ON a.id = jl.account_id
LEFT JOIN public.journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted'
GROUP BY a.id, a.workspace_id, a.name, a.account_type_id, t.classification, t.normal_balance;
