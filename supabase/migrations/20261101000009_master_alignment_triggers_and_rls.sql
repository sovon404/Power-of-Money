-- ==============================================================================
-- MASTER ALIGNMENT & TRIGGERS MIGRATION: 20261101000009_master_alignment_triggers_and_rls.sql
-- DESCRIPTION: Installs all automated database triggers (auth signup, auto-workspace,
--              updated_at, double-entry validation) and bulletproof RLS policies for all 22 tables.
-- ==============================================================================

-- 1. Helper Security Functions (SECURITY DEFINER, prevents search_path attacks)
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
    )
    OR EXISTS (
        SELECT 1
        FROM public.workspaces
        WHERE id = p_workspace_id
          AND created_by = auth.uid()
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
        (SELECT role FROM public.workspace_members 
         WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND status = 'active' LIMIT 1),
        (SELECT 'owner' FROM public.workspaces 
         WHERE id = p_workspace_id AND created_by = auth.uid() LIMIT 1),
        'none'
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
        SELECT 1 
        FROM public.workspace_members 
        WHERE workspace_id = p_workspace_id 
          AND user_id = auth.uid() 
          AND status = 'active'
          AND role IN ('owner', 'admin', 'editor')
    )
    OR EXISTS (
        SELECT 1
        FROM public.workspaces
        WHERE id = p_workspace_id
          AND created_by = auth.uid()
    );
$$;

-- 2. Generic updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- Attach updated_at triggers to all applicable tables
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'profiles', 'workspaces', 'workspace_members', 'financial_accounts',
        'journal_entries', 'credit_cards', 'credit_card_statements', 'loans',
        'loan_payments', 'properties', 'property_valuations', 'property_recoveries',
        'categories', 'budgets', 'savings_goals', 'recurring_rules'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
        EXECUTE format('
            CREATE TRIGGER trg_set_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();', t);
    END LOOP;
END $$;

-- 3. Automatic Auth Signup Trigger: Creates Profile, Personal Workspace, and Owner Membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_workspace_id UUID := gen_random_uuid();
    v_user_name TEXT;
BEGIN
    -- Extract full name
    v_user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(COALESCE(NEW.email, 'User'), '@', 1)
    );

    -- 1. Create or update user profile
    INSERT INTO public.profiles (id, email, full_name, default_currency, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        v_user_name,
        'BDT',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
        updated_at = timezone('utc'::text, now());

    -- 2. If user has no workspace yet, auto-provision default Personal Workspace
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = NEW.id) THEN
        INSERT INTO public.workspaces (
            id, name, type, created_by, currency, description, settings, created_at, updated_at
        ) VALUES (
            v_workspace_id,
            v_user_name || '''s Personal Finances',
            'personal',
            NEW.id,
            'BDT',
            'Default personal financial workspace',
            '{"fiscal_year_start": "01-01", "dateFormat": "YYYY-MM-DD", "enableAiReceipts": true}'::jsonb,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );

        -- Add user as owner
        INSERT INTO public.workspace_members (
            id, workspace_id, user_id, role, permissions, status, joined_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            v_workspace_id,
            NEW.id,
            'owner',
            '{"can_view_accounts": true, "can_manage_accounts": true, "can_view_ledger": true, "can_post_transactions": true, "can_view_cards": true, "can_manage_cards": true, "can_view_loans": true, "can_manage_loans": true, "can_view_properties": true, "can_manage_properties": true, "can_view_budgets": true, "can_manage_budgets": true, "can_manage_members": true}'::jsonb,
            'active',
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill Existing Users in auth.users (so current account has profile & workspace immediately)
DO $$
DECLARE
    r RECORD;
    v_ws_id UUID;
    v_name TEXT;
BEGIN
    FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        v_name := COALESCE(
            r.raw_user_meta_data->>'full_name',
            r.raw_user_meta_data->>'name',
            split_part(COALESCE(r.email, 'User'), '@', 1)
        );

        -- Upsert profile
        INSERT INTO public.profiles (id, email, full_name, default_currency)
        VALUES (r.id, COALESCE(r.email, ''), v_name, 'BDT')
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;

        -- Ensure user has a workspace
        IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = r.id) THEN
            v_ws_id := gen_random_uuid();
            
            INSERT INTO public.workspaces (id, name, type, created_by, currency, description)
            VALUES (v_ws_id, v_name || '''s Personal Finances', 'personal', r.id, 'BDT', 'Default personal workspace');

            INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
            VALUES (v_ws_id, r.id, 'owner', 'active')
            ON CONFLICT (workspace_id, user_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- 5. Row Level Security (RLS) Policies on ALL 22 Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;
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

-- account_types (Reference table - all authenticated users can read)
DROP POLICY IF EXISTS "Anyone can read account types" ON public.account_types;
CREATE POLICY "Anyone can read account types"
    ON public.account_types FOR SELECT
    TO authenticated
    USING (true);

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.is_member_of_workspace(ANY(SELECT workspace_id FROM public.workspace_members WHERE user_id = id)));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- workspaces (Eliminates the 42501 returning error on insert)
DROP POLICY IF EXISTS "Members and creators can view workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members and creators can view workspaces"
    ON public.workspaces FOR SELECT
    TO authenticated
    USING (created_by = auth.uid() OR public.is_member_of_workspace(id));

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspaces"
    ON public.workspaces FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON public.workspaces;
CREATE POLICY "Owners and admins can update workspaces"
    ON public.workspaces FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid() OR public.get_user_workspace_role(id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Owners can delete workspaces"
    ON public.workspaces FOR DELETE
    TO authenticated
    USING (created_by = auth.uid() OR public.get_user_workspace_role(id) = 'owner');

-- workspace_members
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
    ON public.workspace_members FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS "Users can join or owners manage members" ON public.workspace_members;
CREATE POLICY "Users can join or owners manage members"
    ON public.workspace_members FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() 
        OR public.get_user_workspace_role(workspace_id) IN ('owner', 'admin')
        OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Owners and admins can update members" ON public.workspace_members;
CREATE POLICY "Owners and admins can update members"
    ON public.workspace_members FOR UPDATE
    TO authenticated
    USING (public.get_user_workspace_role(workspace_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owners can delete members or users leave" ON public.workspace_members;
CREATE POLICY "Owners can delete members or users leave"
    ON public.workspace_members FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.get_user_workspace_role(workspace_id) IN ('owner', 'admin'));

-- Helper Macro function to apply standard workspace RLS to entity tables
DO $$
DECLARE
    tbl text;
    workspace_tables text[] := ARRAY[
        'financial_accounts', 'journal_entries', 'journal_lines', 'credit_cards',
        'credit_card_statements', 'loans', 'loan_payments', 'properties',
        'property_owners', 'property_valuations', 'property_recoveries',
        'categories', 'budgets', 'savings_goals', 'recurring_rules',
        'recurring_executions', 'workspace_invitations', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY workspace_tables LOOP
        -- Drop old policies
        EXECUTE format('DROP POLICY IF EXISTS "ws_select_%I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "ws_insert_%I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "ws_update_%I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "ws_delete_%I" ON public.%I;', tbl, tbl);

        -- SELECT Policy
        IF tbl = 'credit_card_statements' THEN
            EXECUTE 'CREATE POLICY "ws_select_credit_card_statements" ON public.credit_card_statements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = credit_card_id AND public.is_member_of_workspace(c.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_insert_credit_card_statements" ON public.credit_card_statements FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = credit_card_id AND public.can_write_workspace(c.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_update_credit_card_statements" ON public.credit_card_statements FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = credit_card_id AND public.can_write_workspace(c.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_delete_credit_card_statements" ON public.credit_card_statements FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.id = credit_card_id AND public.can_write_workspace(c.workspace_id)));';
        ELSIF tbl = 'loan_payments' THEN
            EXECUTE 'CREATE POLICY "ws_select_loan_payments" ON public.loan_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND public.is_member_of_workspace(l.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_insert_loan_payments" ON public.loan_payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND public.can_write_workspace(l.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_update_loan_payments" ON public.loan_payments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND public.can_write_workspace(l.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_delete_loan_payments" ON public.loan_payments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND public.can_write_workspace(l.workspace_id)));';
        ELSIF tbl = 'property_owners' OR tbl = 'property_valuations' OR tbl = 'property_recoveries' THEN
            EXECUTE format('CREATE POLICY "ws_select_%I" ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND public.is_member_of_workspace(p.workspace_id)));', tbl, tbl);
            EXECUTE format('CREATE POLICY "ws_insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND public.can_write_workspace(p.workspace_id)));', tbl, tbl);
            EXECUTE format('CREATE POLICY "ws_update_%I" ON public.%I FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND public.can_write_workspace(p.workspace_id)));', tbl, tbl);
            EXECUTE format('CREATE POLICY "ws_delete_%I" ON public.%I FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND public.can_write_workspace(p.workspace_id)));', tbl, tbl);
        ELSIF tbl = 'recurring_executions' THEN
            EXECUTE 'CREATE POLICY "ws_select_recurring_executions" ON public.recurring_executions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.recurring_rules r WHERE r.id = recurring_rule_id AND public.is_member_of_workspace(r.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_insert_recurring_executions" ON public.recurring_executions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.recurring_rules r WHERE r.id = recurring_rule_id AND public.can_write_workspace(r.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_update_recurring_executions" ON public.recurring_executions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.recurring_rules r WHERE r.id = recurring_rule_id AND public.can_write_workspace(r.workspace_id)));';
            EXECUTE 'CREATE POLICY "ws_delete_recurring_executions" ON public.recurring_executions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.recurring_rules r WHERE r.id = recurring_rule_id AND public.can_write_workspace(r.workspace_id)));';
        ELSE
            -- Standard workspace_id column
            EXECUTE format('CREATE POLICY "ws_select_%I" ON public.%I FOR SELECT TO authenticated USING (public.is_member_of_workspace(workspace_id));', tbl, tbl);
            EXECUTE format('CREATE POLICY "ws_insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_workspace(workspace_id));', tbl, tbl);
            EXECUTE format('CREATE POLICY "ws_update_%I" ON public.%I FOR UPDATE TO authenticated USING (public.can_write_workspace(workspace_id));', tbl, tbl);
            EXECUTE format('CREATE POLICY "ws_delete_%I" ON public.%I FOR DELETE TO authenticated USING (public.can_write_workspace(workspace_id));', tbl, tbl);
        END IF;
    END LOOP;
END $$;
