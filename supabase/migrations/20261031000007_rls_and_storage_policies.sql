-- ==============================================================================
-- MIGRATION: 20261031000007_rls_and_storage_policies.sql
-- DESCRIPTION: Row Level Security (RLS) policies for all tables, secure helper
--              functions, role/permission enforcement, and private Storage policies.
-- EXECUTION: Run in Supabase SQL Editor after migration 6.
-- ==============================================================================

-- 1. Helper Security Functions (SECURITY DEFINER with safe search_path)
CREATE OR REPLACE FUNCTION public.is_member_of_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.workspace_members 
        WHERE workspace_id = p_workspace_id 
          AND user_id = auth.uid() 
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT role 
    FROM public.workspace_members 
    WHERE workspace_id = p_workspace_id 
      AND user_id = auth.uid() 
      AND status = 'active'
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.workspace_members 
        WHERE workspace_id = p_workspace_id 
          AND user_id = auth.uid() 
          AND status = 'active'
          AND role IN ('owner', 'admin', 'editor')
    );
$$;

-- 2. Enable RLS on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_executions ENABLE ROW LEVEL SECURITY;

-- 3. Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 4. Workspaces Policies
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces"
    ON public.workspaces FOR SELECT
    USING (public.is_member_of_workspace(id));

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspaces"
    ON public.workspaces FOR INSERT
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON public.workspaces;
CREATE POLICY "Owners and admins can update workspaces"
    ON public.workspaces FOR UPDATE
    USING (public.get_user_workspace_role(id) IN ('owner', 'admin'));

-- 5. Workspace Members Policies
DROP POLICY IF EXISTS "Members can view other members of their workspace" ON public.workspace_members;
CREATE POLICY "Members can view other members of their workspace"
    ON public.workspace_members FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Owners and admins can manage memberships" ON public.workspace_members;
CREATE POLICY "Owners and admins can manage memberships"
    ON public.workspace_members FOR ALL
    USING (public.get_user_workspace_role(workspace_id) IN ('owner', 'admin'));

-- 6. Financial Accounts Policies
DROP POLICY IF EXISTS "Members can view accounts in their workspace" ON public.financial_accounts;
CREATE POLICY "Members can view accounts in their workspace"
    ON public.financial_accounts FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage accounts" ON public.financial_accounts;
CREATE POLICY "Authorized members can manage accounts"
    ON public.financial_accounts FOR ALL
    USING (public.can_write_workspace(workspace_id));

-- 7. Journal Entries & Lines Policies
DROP POLICY IF EXISTS "Members can view journal entries in their workspace" ON public.journal_entries;
CREATE POLICY "Members can view journal entries in their workspace"
    ON public.journal_entries FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can insert journal entries" ON public.journal_entries;
CREATE POLICY "Authorized members can insert journal entries"
    ON public.journal_entries FOR INSERT
    WITH CHECK (public.can_write_workspace(workspace_id));

DROP POLICY IF EXISTS "Members can view journal lines in their workspace" ON public.journal_lines;
CREATE POLICY "Members can view journal lines in their workspace"
    ON public.journal_lines FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can insert journal lines" ON public.journal_lines;
CREATE POLICY "Authorized members can insert journal lines"
    ON public.journal_lines FOR INSERT
    WITH CHECK (public.can_write_workspace(workspace_id));

-- 8. Credit Cards Policies
DROP POLICY IF EXISTS "Members can view credit cards in their workspace" ON public.credit_cards;
CREATE POLICY "Members can view credit cards in their workspace"
    ON public.credit_cards FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage credit cards" ON public.credit_cards;
CREATE POLICY "Authorized members can manage credit cards"
    ON public.credit_cards FOR ALL
    USING (public.can_write_workspace(workspace_id));

-- 9. Loans & Debts Policies
DROP POLICY IF EXISTS "Members can view loans in their workspace" ON public.loans;
CREATE POLICY "Members can view loans in their workspace"
    ON public.loans FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage loans" ON public.loans;
CREATE POLICY "Authorized members can manage loans"
    ON public.loans FOR ALL
    USING (public.can_write_workspace(workspace_id));

-- 10. Properties Policies
DROP POLICY IF EXISTS "Members can view properties in their workspace" ON public.properties;
CREATE POLICY "Members can view properties in their workspace"
    ON public.properties FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage properties" ON public.properties;
CREATE POLICY "Authorized members can manage properties"
    ON public.properties FOR ALL
    USING (public.can_write_workspace(workspace_id));

-- 11. Categories, Budgets, Savings Goals, Recurring Rules
DROP POLICY IF EXISTS "Members can view categories in their workspace" ON public.categories;
CREATE POLICY "Members can view categories in their workspace"
    ON public.categories FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage categories" ON public.categories;
CREATE POLICY "Authorized members can manage categories"
    ON public.categories FOR ALL
    USING (public.can_write_workspace(workspace_id));

DROP POLICY IF EXISTS "Members can view budgets" ON public.budgets;
CREATE POLICY "Members can view budgets"
    ON public.budgets FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage budgets" ON public.budgets;
CREATE POLICY "Authorized members can manage budgets"
    ON public.budgets FOR ALL
    USING (public.can_write_workspace(workspace_id));

DROP POLICY IF EXISTS "Members can view savings goals" ON public.savings_goals;
CREATE POLICY "Members can view savings goals"
    ON public.savings_goals FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage savings goals" ON public.savings_goals;
CREATE POLICY "Authorized members can manage savings goals"
    ON public.savings_goals FOR ALL
    USING (public.can_write_workspace(workspace_id));

DROP POLICY IF EXISTS "Members can view recurring rules" ON public.recurring_rules;
CREATE POLICY "Members can view recurring rules"
    ON public.recurring_rules FOR SELECT
    USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Authorized members can manage recurring rules" ON public.recurring_rules;
CREATE POLICY "Authorized members can manage recurring rules"
    ON public.recurring_rules FOR ALL
    USING (public.can_write_workspace(workspace_id));

-- 12. Storage Vault Bucket & Storage Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'power_of_money_vault', 
    'power_of_money_vault', 
    false, 
    20971520, -- 20MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage object RLS: folder path format = "{workspace_id}/{module}/{filename}"
DROP POLICY IF EXISTS "Workspace members can access vault objects" ON storage.objects;
CREATE POLICY "Workspace members can access vault objects"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'power_of_money_vault' AND
        public.is_member_of_workspace((storage.foldername(name))[1]::UUID)
    );

DROP POLICY IF EXISTS "Authorized workspace members can upload vault objects" ON storage.objects;
CREATE POLICY "Authorized workspace members can upload vault objects"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'power_of_money_vault' AND
        public.can_write_workspace((storage.foldername(name))[1]::UUID)
    );
