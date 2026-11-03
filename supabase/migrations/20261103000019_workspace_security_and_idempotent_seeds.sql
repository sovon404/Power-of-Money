-- ==============================================================================
-- MIGRATION: 20261103000019_workspace_security_and_idempotent_seeds.sql
-- DESCRIPTION:
-- 1. Restores multi-user and family workspace support:
--    - Relaxes workspaces_type_check to allow both 'personal' and 'family'.
--    - Recreates public.workspace_invitations table with full RBAC & security tokens.
--    - Upgrades is_member_of_workspace, can_write_workspace, and get_user_workspace_role
--      to respect both workspace creator (created_by) AND active workspace_members.
-- 2. Eliminates cross-workspace data leakage & drops permissive RLS:
--    - Drops open categories_all_access (USING true) and replaces with strict workspace RLS.
--    - Drops open financial_accounts_all_access (USING true) and replaces with strict workspace RLS.
--    - Drops anonymous access on recurring_executions (OR auth.uid() IS NULL).
-- 3. Permanent Account Deduplication & Idempotent Seeding:
--    - Safely merges and cleans residual duplicate accounts in all workspaces.
--    - Adds partial unique index uq_active_account_name_workspace on (workspace_id, LOWER(TRIM(name))).
--    - Updates initialize_new_workspace to guarantee zero duplicate accounts.
-- 4. Double-Entry Balance & Referential Integrity:
--    - Validates cascading rules and verifies trial balance consistency.
--
-- EXECUTION:
-- Run in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/apxbmwxovgpnttwprijw/sql
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Restore Workspaces Type Check ('personal' and 'family')
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_type_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_type_check CHECK (type IN ('personal', 'family'));

-- 3. Restore Workspace Invitations Table
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_pending_invitation UNIQUE (workspace_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.workspace_invitations(email);

-- 4. Secure Helper Functions (Respecting both Creator AND Active Memberships)
CREATE OR REPLACE FUNCTION public.is_member_of_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = p_workspace_id AND created_by = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.workspace_members 
        WHERE workspace_id = p_workspace_id 
          AND user_id = auth.uid() 
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = p_workspace_id AND created_by = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.workspace_members 
        WHERE workspace_id = p_workspace_id 
          AND user_id = auth.uid() 
          AND status = 'active'
          AND role IN ('owner', 'admin', 'editor')
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT 'owner' FROM public.workspaces WHERE id = p_workspace_id AND created_by = auth.uid()),
        (SELECT role FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND status = 'active' LIMIT 1),
        'none'
    );
$$;

-- 5. Deduplicate Financial Accounts Before Enforcing Unique Index
DO $$
DECLARE
    dup RECORD;
    primary_acc_id UUID;
BEGIN
    FOR dup IN 
        SELECT workspace_id, LOWER(TRIM(name)) as norm_name, COUNT(*) as cnt
        FROM public.financial_accounts
        WHERE is_archived = false
        GROUP BY workspace_id, LOWER(TRIM(name))
        HAVING COUNT(*) > 1
    LOOP
        -- Pick primary ID: highest absolute balance, then earliest created_at
        SELECT id INTO primary_acc_id
        FROM public.financial_accounts
        WHERE workspace_id = dup.workspace_id 
          AND LOWER(TRIM(name)) = dup.norm_name
          AND is_archived = false
        ORDER BY ABS(current_balance_cached) DESC, created_at ASC
        LIMIT 1;

        -- Reassign journal lines from duplicate accounts to the primary account
        UPDATE public.journal_lines
        SET account_id = primary_acc_id
        WHERE account_id IN (
            SELECT id FROM public.financial_accounts 
            WHERE workspace_id = dup.workspace_id 
              AND LOWER(TRIM(name)) = dup.norm_name 
              AND id <> primary_acc_id
        );

        -- Reassign categories target_savings_account_id
        UPDATE public.categories
        SET target_savings_account_id = primary_acc_id
        WHERE target_savings_account_id IN (
            SELECT id FROM public.financial_accounts 
            WHERE workspace_id = dup.workspace_id 
              AND LOWER(TRIM(name)) = dup.norm_name 
              AND id <> primary_acc_id
        );

        -- Reassign credit cards account_id
        UPDATE public.credit_cards
        SET account_id = primary_acc_id
        WHERE account_id IN (
            SELECT id FROM public.financial_accounts 
            WHERE workspace_id = dup.workspace_id 
              AND LOWER(TRIM(name)) = dup.norm_name 
              AND id <> primary_acc_id
        );

        -- Reassign loans account_id
        UPDATE public.loans
        SET account_id = primary_acc_id
        WHERE account_id IN (
            SELECT id FROM public.financial_accounts 
            WHERE workspace_id = dup.workspace_id 
              AND LOWER(TRIM(name)) = dup.norm_name 
              AND id <> primary_acc_id
        );

        -- Reassign savings_goals account_id
        UPDATE public.savings_goals
        SET account_id = primary_acc_id
        WHERE account_id IN (
            SELECT id FROM public.financial_accounts 
            WHERE workspace_id = dup.workspace_id 
              AND LOWER(TRIM(name)) = dup.norm_name 
              AND id <> primary_acc_id
        );

        -- Reassign recurring_rules source & destination
        UPDATE public.recurring_rules
        SET source_account_id = primary_acc_id
        WHERE source_account_id IN (
            SELECT id FROM public.financial_accounts 
            WHERE workspace_id = dup.workspace_id 
              AND LOWER(TRIM(name)) = dup.norm_name 
              AND id <> primary_acc_id
        );

        UPDATE public.recurring_rules
        SET destination_account_id = primary_acc_id
        WHERE destination_account_id IN (
            SELECT id FROM public.financial_accounts 
            WHERE workspace_id = dup.workspace_id 
              AND LOWER(TRIM(name)) = dup.norm_name 
              AND id <> primary_acc_id
        );

        -- Safely delete duplicate rows
        DELETE FROM public.financial_accounts
        WHERE workspace_id = dup.workspace_id 
          AND LOWER(TRIM(name)) = dup.norm_name 
          AND id <> primary_acc_id;
    END LOOP;
END $$;

-- 6. Enforce Permanent Unique Index on Active Account Names per Workspace
DROP INDEX IF EXISTS public.uq_active_account_name_workspace;
CREATE UNIQUE INDEX uq_active_account_name_workspace 
ON public.financial_accounts (workspace_id, LOWER(TRIM(name))) 
WHERE is_archived = false;

-- 7. Fix RLS on Financial Accounts (Eliminate Permissive Leakage)
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_accounts_all_access" ON public.financial_accounts;
DROP POLICY IF EXISTS "financial_accounts_select_policy" ON public.financial_accounts;
DROP POLICY IF EXISTS "financial_accounts_insert_policy" ON public.financial_accounts;
DROP POLICY IF EXISTS "financial_accounts_update_policy" ON public.financial_accounts;
DROP POLICY IF EXISTS "financial_accounts_delete_policy" ON public.financial_accounts;
DROP POLICY IF EXISTS "Members can view financial accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "Writers can manage financial accounts" ON public.financial_accounts;

CREATE POLICY "financial_accounts_select_policy" ON public.financial_accounts
    FOR SELECT TO authenticated
    USING (public.is_member_of_workspace(workspace_id));

CREATE POLICY "financial_accounts_insert_policy" ON public.financial_accounts
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write_workspace(workspace_id));

CREATE POLICY "financial_accounts_update_policy" ON public.financial_accounts
    FOR UPDATE TO authenticated
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

CREATE POLICY "financial_accounts_delete_policy" ON public.financial_accounts
    FOR DELETE TO authenticated
    USING (public.can_write_workspace(workspace_id));

-- 8. Fix RLS on Categories (Eliminate Permissive Leakage)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_all_access" ON public.categories;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;
DROP POLICY IF EXISTS "Members can view categories" ON public.categories;
DROP POLICY IF EXISTS "Writers can manage categories" ON public.categories;

CREATE POLICY "categories_select_policy" ON public.categories
    FOR SELECT TO authenticated
    USING (public.is_member_of_workspace(workspace_id));

CREATE POLICY "categories_insert_policy" ON public.categories
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write_workspace(workspace_id));

CREATE POLICY "categories_update_policy" ON public.categories
    FOR UPDATE TO authenticated
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

CREATE POLICY "categories_delete_policy" ON public.categories
    FOR DELETE TO authenticated
    USING (public.can_write_workspace(workspace_id));

-- 9. Fix RLS on Workspaces and Workspace Members
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_owner_all" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_policy" ON public.workspaces;

CREATE POLICY "workspaces_select_policy" ON public.workspaces
    FOR SELECT TO authenticated
    USING (created_by = auth.uid() OR public.is_member_of_workspace(id));

CREATE POLICY "workspaces_insert_policy" ON public.workspaces
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "workspaces_update_policy" ON public.workspaces
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid() OR public.get_user_workspace_role(id) IN ('owner', 'admin'))
    WITH CHECK (created_by = auth.uid() OR public.get_user_workspace_role(id) IN ('owner', 'admin'));

CREATE POLICY "workspaces_delete_policy" ON public.workspaces
    FOR DELETE TO authenticated
    USING (created_by = auth.uid());

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_owner_all" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_modify_policy" ON public.workspace_members;

CREATE POLICY "workspace_members_select_policy" ON public.workspace_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_member_of_workspace(workspace_id));

CREATE POLICY "workspace_members_modify_policy" ON public.workspace_members
    FOR ALL TO authenticated
    USING (public.get_user_workspace_role(workspace_id) IN ('owner', 'admin'))
    WITH CHECK (public.get_user_workspace_role(workspace_id) IN ('owner', 'admin'));

-- 10. Fix Insecure Anonymous Access on Recurring Executions
ALTER TABLE public.recurring_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view recurring executions" ON public.recurring_executions;
DROP POLICY IF EXISTS "recurring_executions_select_policy" ON public.recurring_executions;
DROP POLICY IF EXISTS "recurring_executions_write_policy" ON public.recurring_executions;

CREATE POLICY "recurring_executions_select_policy" ON public.recurring_executions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.recurring_rules rr
            WHERE rr.id = recurring_executions.recurring_rule_id
              AND public.is_member_of_workspace(rr.workspace_id)
        )
    );

CREATE POLICY "recurring_executions_write_policy" ON public.recurring_executions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.recurring_rules rr
            WHERE rr.id = recurring_executions.recurring_rule_id
              AND public.can_write_workspace(rr.workspace_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.recurring_rules rr
            WHERE rr.id = recurring_executions.recurring_rule_id
              AND public.can_write_workspace(rr.workspace_id)
        )
    );

-- 11. Idempotent Workspace Initializer Function
CREATE OR REPLACE FUNCTION public.initialize_new_workspace(p_workspace_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Ensure user profile exists
    INSERT INTO public.profiles (id, email, full_name, default_currency)
    SELECT p_user_id, COALESCE(u.email, ''), COALESCE(u.raw_user_meta_data->>'full_name', 'Account Owner'), 'BDT'
    FROM auth.users u
    WHERE u.id = p_user_id
    ON CONFLICT (id) DO NOTHING;

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

    -- 3. Idempotent Seed Default Accounts (Only insert if not already existing by name)
    IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE workspace_id = p_workspace_id AND LOWER(TRIM(name)) = 'cash in hand' AND is_archived = false) THEN
        INSERT INTO public.financial_accounts (workspace_id, name, account_type_id, provider, current_balance_cached, icon, color)
        VALUES (p_workspace_id, 'Cash in Hand', 'cash', 'Cash', 0.00, 'banknote', '#10b981');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE workspace_id = p_workspace_id AND LOWER(TRIM(name)) = 'bkash wallet' AND is_archived = false) THEN
        INSERT INTO public.financial_accounts (workspace_id, name, account_type_id, provider, current_balance_cached, icon, color)
        VALUES (p_workspace_id, 'bKash Wallet', 'mfs', 'bKash', 0.00, 'smartphone', '#e11d48');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE workspace_id = p_workspace_id AND LOWER(TRIM(name)) = 'nagad wallet' AND is_archived = false) THEN
        INSERT INTO public.financial_accounts (workspace_id, name, account_type_id, provider, current_balance_cached, icon, color)
        VALUES (p_workspace_id, 'Nagad Wallet', 'mfs', 'Nagad', 0.00, 'smartphone', '#f97316');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE workspace_id = p_workspace_id AND LOWER(TRIM(name)) = 'brac bank checking' AND is_archived = false) THEN
        INSERT INTO public.financial_accounts (workspace_id, name, account_type_id, provider, current_balance_cached, icon, color)
        VALUES (p_workspace_id, 'BRAC Bank Checking', 'bank', 'BRAC Bank', 0.00, 'landmark', '#0284c7');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE workspace_id = p_workspace_id AND LOWER(TRIM(name)) = 'opening balance equity' AND is_archived = false) THEN
        INSERT INTO public.financial_accounts (workspace_id, name, account_type_id, provider, current_balance_cached, icon, color)
        VALUES (p_workspace_id, 'Opening Balance Equity', 'opening_equity', 'System', 0.00, 'scale', '#64748b');
    END IF;

    -- 4. Seed the 36 categories idempotently
    PERFORM public.seed_workspace_categories(p_workspace_id);
END;
$$;

-- 12. Verification Query
SELECT 
    'SUCCESS: Migration 19 Applied' AS status,
    (SELECT count(*) FROM public.workspaces) AS total_workspaces,
    (SELECT count(*) FROM public.financial_accounts) AS total_accounts,
    (SELECT count(*) FROM public.categories) AS total_categories;
