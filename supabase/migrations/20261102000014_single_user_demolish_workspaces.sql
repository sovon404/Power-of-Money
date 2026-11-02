-- ==============================================================================
-- MIGRATION: 20261102000014_single_user_demolish_workspaces.sql
-- DESCRIPTION: Transition to pure single-user personal vault architecture.
--              Demolishes multi-user workspace memberships and invitations.
--              Updates security functions so all 22 tables seamlessly authenticate
--              strictly via auth.uid() and single-user personal vault ownership.
-- EXECUTION: Copy and paste into the Supabase SQL Editor and click "Run".
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop multi-user invitations table (no longer needed in single-user architecture)
DROP TABLE IF EXISTS public.workspace_invitations CASCADE;

-- 3. Constrain workspaces type to 'personal' only
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_type_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_type_check CHECK (type IN ('personal'));

-- 4. Streamline Security Helper Functions for Single-User Isolation
-- These functions govern the RLS policies across all 22 tables in the database.
-- By updating these, all tables immediately require ownership by auth.uid().
CREATE OR REPLACE FUNCTION public.is_member_of_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspaces
        WHERE id = p_workspace_id
          AND created_by = auth.uid()
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
    SELECT CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM public.workspaces 
            WHERE id = p_workspace_id 
              AND created_by = auth.uid()
        ) THEN 'owner' 
        ELSE 'none' 
    END;
$$;

-- 5. Auto-provision single-user personal vault on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_name TEXT;
    v_vault_id UUID;
BEGIN
    v_user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(COALESCE(NEW.email, 'User'), '@', 1)
    );

    -- 1. Upsert profile
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

    -- 2. Deterministic Personal Vault for the single user
    -- Uses uuid_generate_v5 to deterministically map 'ws_' + user_id to match the app client
    v_vault_id := extensions.uuid_generate_v5(
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 
        'ws_' || NEW.id::text
    );

    INSERT INTO public.workspaces (
        id, name, type, created_by, currency, description, settings, created_at, updated_at
    ) VALUES (
        v_vault_id,
        v_user_name || '''s Personal Vault',
        'personal',
        NEW.id,
        'BDT',
        'Single-user personal financial vault',
        '{"fiscal_year_start": "01-01", "dateFormat": "YYYY-MM-DD", "enableAiReceipts": true}'::jsonb,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        created_by = EXCLUDED.created_by,
        updated_at = timezone('utc'::text, now());

    -- Legacy membership record for referential safety
    INSERT INTO public.workspace_members (
        id, workspace_id, user_id, role, permissions, status, joined_at, updated_at
    ) VALUES (
        extensions.uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'wm_' || NEW.id::text),
        v_vault_id,
        NEW.id,
        'owner',
        '{"can_view_accounts": true, "can_manage_accounts": true, "can_view_ledger": true, "can_post_transactions": true, "can_view_cards": true, "can_manage_cards": true, "can_view_loans": true, "can_manage_loans": true, "can_view_properties": true, "can_manage_properties": true, "can_view_budgets": true, "can_manage_budgets": true, "can_manage_members": true}'::jsonb,
        'active',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 6. Backfill existing user account with personal vault
DO $$
DECLARE
    r RECORD;
    v_vault_id UUID;
    v_name TEXT;
BEGIN
    FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        v_name := COALESCE(
            r.raw_user_meta_data->>'full_name',
            r.raw_user_meta_data->>'name',
            split_part(COALESCE(r.email, 'User'), '@', 1)
        );

        INSERT INTO public.profiles (id, email, full_name, default_currency)
        VALUES (r.id, COALESCE(r.email, ''), v_name, 'BDT')
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;

        v_vault_id := extensions.uuid_generate_v5(
            '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 
            'ws_' || r.id::text
        );

        INSERT INTO public.workspaces (
            id, name, type, created_by, currency, description, settings
        ) VALUES (
            v_vault_id,
            v_name || '''s Personal Vault',
            'personal',
            r.id,
            'BDT',
            'Single-user personal financial vault',
            '{"fiscal_year_start": "01-01", "dateFormat": "YYYY-MM-DD", "enableAiReceipts": true}'::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
            created_by = r.id;

        INSERT INTO public.workspace_members (
            id, workspace_id, user_id, role, permissions, status
        ) VALUES (
            extensions.uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'wm_' || r.id::text),
            v_vault_id,
            r.id,
            'owner',
            '{"can_view_accounts": true, "can_manage_accounts": true, "can_view_ledger": true, "can_post_transactions": true, "can_view_cards": true, "can_manage_cards": true, "can_view_loans": true, "can_manage_loans": true, "can_view_properties": true, "can_manage_properties": true, "can_view_budgets": true, "can_manage_budgets": true, "can_manage_members": true}'::jsonb,
            'active'
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

-- 7. Streamline Workspaces RLS
DROP POLICY IF EXISTS "workspaces_owner_all" ON public.workspaces;
DROP POLICY IF EXISTS "Members and creators can view workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;

CREATE POLICY "workspaces_owner_all" ON public.workspaces 
    FOR ALL 
    TO authenticated
    USING (created_by = auth.uid()) 
    WITH CHECK (created_by = auth.uid());

-- 8. Clean up unused workspace_members table policies
DROP POLICY IF EXISTS "workspace_members_owner_all" ON public.workspace_members;
CREATE POLICY "workspace_members_owner_all" ON public.workspace_members
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 9. Realtime publication subscriptions
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_accounts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_rules;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
