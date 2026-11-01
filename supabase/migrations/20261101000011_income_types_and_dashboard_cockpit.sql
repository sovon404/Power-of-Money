-- ==============================================================================
-- MIGRATION: 20261101000011_income_types_and_dashboard_cockpit.sql
-- DESCRIPTION: 
-- 1. Adds 'income_type' column to public.categories for macro stream classification
--    (e.g., 'salary', 'remote_freelance', 'land_mortgage', 'business', 'investment', 'other').
-- 2. Creates automated Postgres trigger to recalculate financial_accounts.current_balance_cached
--    in real time on every journal_lines insertion, modification, or deletion.
-- 3. Ensures RLS policies allow authorized members to manage categories and settings.
-- 4. Initial balance reconciliation for all existing accounts from journal lines.
-- EXECUTION: Run this script directly in your Supabase Project SQL Editor (https://supabase.com/dashboard/project/_/sql).
-- ==============================================================================

-- 1. Add income_type column to categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS income_type TEXT DEFAULT 'other';

-- Index for speedy filtering by income type
CREATE INDEX IF NOT EXISTS idx_categories_income_type 
ON public.categories(workspace_id, type, income_type);

-- 2. Populate default income types on existing categories
UPDATE public.categories
SET income_type = CASE
    WHEN LOWER(name) LIKE '%salary%' OR LOWER(name) LIKE '%allowance%' OR LOWER(name) LIKE '%employment%' THEN 'salary'
    WHEN LOWER(name) LIKE '%remote%' OR LOWER(name) LIKE '%freelance%' OR LOWER(name) LIKE '%software%' OR LOWER(name) LIKE '%tech%' THEN 'remote_freelance'
    WHEN LOWER(name) LIKE '%mortgage%' OR LOWER(name) LIKE '%land%' OR LOWER(name) LIKE '%rent%' OR LOWER(name) LIKE '%lease%' THEN 'land_mortgage'
    WHEN LOWER(name) LIKE '%business%' OR LOWER(name) LIKE '%trade%' OR LOWER(name) LIKE '%sales%' THEN 'business'
    WHEN LOWER(name) LIKE '%dividend%' OR LOWER(name) LIKE '%interest%' OR LOWER(name) LIKE '%profit%' OR LOWER(name) LIKE '%dps%' OR LOWER(name) LIKE '%invest%' THEN 'investment'
    ELSE 'other'
END
WHERE type = 'income' AND (income_type IS NULL OR income_type = 'other');

-- 3. Real-time Account Balance Recalculation Trigger on Journal Lines
CREATE OR REPLACE FUNCTION public.recalculate_account_balance_on_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_account_id UUID;
BEGIN
    v_account_id := COALESCE(NEW.account_id, OLD.account_id);
    IF v_account_id IS NOT NULL THEN
        UPDATE public.financial_accounts fa
        SET current_balance_cached = COALESCE((
            SELECT SUM(
                CASE 
                    WHEN act.normal_balance = 'debit' THEN
                        (CASE WHEN jl.line_type = 'debit' THEN jl.amount ELSE -jl.amount END)
                    ELSE
                        (CASE WHEN jl.line_type = 'credit' THEN jl.amount ELSE -jl.amount END)
                END
            )
            FROM public.journal_lines jl
            JOIN public.journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted'
            JOIN public.account_types act ON fa.account_type_id = act.id
            WHERE jl.account_id = v_account_id
        ), fa.opening_balance, 0.00),
        updated_at = timezone('utc'::text, now())
        WHERE fa.id = v_account_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_account_balance ON public.journal_lines;
CREATE TRIGGER trg_recalculate_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_account_balance_on_line();

-- 4. Initial Balance Synchronization for all Existing Accounts
UPDATE public.financial_accounts fa
SET current_balance_cached = COALESCE((
    SELECT SUM(
        CASE 
            WHEN act.normal_balance = 'debit' THEN
                (CASE WHEN jl.line_type = 'debit' THEN jl.amount ELSE -jl.amount END)
            ELSE
                (CASE WHEN jl.line_type = 'credit' THEN jl.amount ELSE -jl.amount END)
        END
    )
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted'
    JOIN public.account_types act ON fa.account_type_id = act.id
    WHERE jl.account_id = fa.id
), fa.opening_balance, 0.00);

-- 5. Confirm RLS policy on categories allows authorized members to insert, update, delete
DROP POLICY IF EXISTS "Authorized members can manage categories" ON public.categories;
CREATE POLICY "Authorized members can manage categories"
    ON public.categories FOR ALL
    USING (public.can_write_workspace(workspace_id))
    WITH CHECK (public.can_write_workspace(workspace_id));

-- 6. Verification queries
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'income_type';
-- SELECT id, name, current_balance_cached FROM public.financial_accounts LIMIT 10;
