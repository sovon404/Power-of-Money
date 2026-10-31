-- ==============================================================================
-- MIGRATION: 20261031000003_banking_cards_loans.sql
-- DESCRIPTION: Credit card management, statement tracking, loans, debts, 
--              and money lent to others (receivables).
-- EXECUTION: Run in Supabase SQL Editor after migration 2.
-- ==============================================================================

-- 1. Credit Cards Register
CREATE TABLE IF NOT EXISTS public.credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE, -- Underlying liability account
    card_name TEXT NOT NULL,
    issuing_bank TEXT NOT NULL,
    card_network TEXT NOT NULL DEFAULT 'Visa' CHECK (card_network IN ('Visa', 'Mastercard', 'Amex', 'UnionPay', 'Other')),
    last_four_digits VARCHAR(4) NOT NULL CHECK (last_four_digits ~ '^[0-9]{4}$'),
    credit_limit NUMERIC(20, 2) NOT NULL CHECK (credit_limit > 0),
    statement_day INT NOT NULL CHECK (statement_day BETWEEN 1 AND 31),
    payment_due_day INT NOT NULL CHECK (payment_due_day BETWEEN 1 AND 31),
    interest_rate_apr NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    annual_fee NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_card_last_four UNIQUE (workspace_id, issuing_bank, last_four_digits)
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_workspace ON public.credit_cards(workspace_id);

-- 2. Credit Card Statements
CREATE TABLE IF NOT EXISTS public.credit_card_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    statement_period TEXT NOT NULL, -- e.g. 'Oct 2026'
    statement_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_amount_due NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    minimum_payment NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    statement_document_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_card_statements_card ON public.credit_card_statements(credit_card_id, statement_date DESC);

-- 3. Loans, Debts & Money Lent (Receivables)
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('borrowed', 'lent')), 
    -- 'borrowed' = Liability (money we owe others)
    -- 'lent' = Receivable / Asset (money others owe us)
    account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    counterparty_name TEXT NOT NULL,
    counterparty_phone TEXT,
    counterparty_relationship TEXT,
    principal_amount NUMERIC(20, 2) NOT NULL CHECK (principal_amount > 0),
    interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_interest_bearing BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    maturity_date DATE,
    installment_frequency TEXT DEFAULT 'monthly' CHECK (installment_frequency IN ('one_time', 'weekly', 'monthly', 'quarterly', 'irregular')),
    installment_amount NUMERIC(20, 2) DEFAULT 0.00,
    total_principal_repaid NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    total_interest_paid NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fully_paid', 'defaulted', 'written_off')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_loans_workspace ON public.loans(workspace_id, type, status);

-- 4. Loan Repayment Audit Ledger Records
CREATE TABLE IF NOT EXISTS public.loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    principal_amount NUMERIC(20, 2) NOT NULL DEFAULT 0.00 CHECK (principal_amount >= 0),
    interest_amount NUMERIC(20, 2) NOT NULL DEFAULT 0.00 CHECK (interest_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_positive_payment CHECK (principal_amount + interest_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON public.loan_payments(loan_id, payment_date DESC);
