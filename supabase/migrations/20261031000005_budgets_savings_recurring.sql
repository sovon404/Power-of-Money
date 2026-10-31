-- ==============================================================================
-- MIGRATION: 20261031000005_budgets_savings_recurring.sql
-- DESCRIPTION: Categories (with the 36 seed expense categories), Budgets,
--              DPS / Savings Goals, and Idempotent Recurring Transactions & Bills.
-- EXECUTION: Run in Supabase SQL Editor after migration 4.
-- ==============================================================================

-- 1. Categories Master
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer_allocation')),
    accounting_classification TEXT NOT NULL DEFAULT 'expense_operating' CHECK (accounting_classification IN (
        'expense_operating', 'expense_finance', 'liability_reduction', 'asset_transfer', 'receivable_outflow', 'income_operating'
    )),
    icon TEXT NOT NULL DEFAULT 'tag',
    color TEXT NOT NULL DEFAULT '#64748b',
    is_seed BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_category_name_workspace UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_workspace ON public.categories(workspace_id, type, is_archived);

-- Add foreign key constraint to journal_lines now that categories table exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_category'
    ) THEN
        ALTER TABLE public.journal_lines 
        ADD CONSTRAINT fk_journal_lines_category 
        FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Budgets
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'annual', 'custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    budget_amount NUMERIC(20, 2) NOT NULL CHECK (budget_amount > 0),
    alert_threshold_percentage INT NOT NULL DEFAULT 80 CHECK (alert_threshold_percentage BETWEEN 1 AND 100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_budget_category_period UNIQUE (workspace_id, category_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_budgets_workspace ON public.budgets(workspace_id, period_start, period_end);

-- 3. Savings, DPS & Financial Goals
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL, -- Dedicated savings or DPS asset account
    name TEXT NOT NULL,
    goal_type TEXT NOT NULL DEFAULT 'dps' CHECK (goal_type IN ('dps', 'fixed_deposit', 'emergency_fund', 'property_downpayment', 'hajj_umrah', 'education', 'general_savings')),
    target_amount NUMERIC(20, 2) NOT NULL CHECK (target_amount > 0),
    current_saved_amount NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    monthly_contribution NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    target_date DATE,
    expected_maturity_date DATE,
    expected_return_rate NUMERIC(5, 2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_workspace ON public.savings_goals(workspace_id, status);

-- 4. Recurring Transaction Rules & Bills
CREATE TABLE IF NOT EXISTS public.recurring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('expense', 'income', 'transfer', 'dps_installment', 'loan_installment', 'card_reminder')),
    amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'BDT',
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE,
    next_due_date DATE NOT NULL,
    source_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    destination_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    auto_post BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_workspace ON public.recurring_rules(workspace_id, is_active, next_due_date);

-- 5. Idempotent Execution Log (Guarantees zero duplicate postings)
CREATE TABLE IF NOT EXISTS public.recurring_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_rule_id UUID NOT NULL REFERENCES public.recurring_rules(id) ON DELETE CASCADE,
    occurrence_identifier TEXT NOT NULL UNIQUE, -- e.g. "RULE_UUID_2026-11-01"
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(20, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'skipped', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recurring_executions_rule ON public.recurring_executions(recurring_rule_id, execution_date);
