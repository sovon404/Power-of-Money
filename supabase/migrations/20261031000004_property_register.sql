-- ==============================================================================
-- MIGRATION: 20261031000004_property_register.sql
-- DESCRIPTION: Property & asset register supporting personal & family properties,
--              complex ownership shares (e.g. 6 Ana, Mass Share), exact original size
--              descriptions (e.g. 75 Khara, 20/4 Khara, N/A), valuations, and recoveries.
-- EXECUTION: Run in Supabase SQL Editor after migration 3.
-- ==============================================================================

-- 1. Properties Master
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    property_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Residential Plot', 
    -- e.g. 'Agricultural Land', 'Residential Plot', 'Commercial Building', 'Apartment/Flat', 'Pond/Fishery', 'Inherited Estate', 'Other'
    property_type TEXT NOT NULL DEFAULT 'Freehold',
    
    -- Exact original size descriptions preserved verbatim (e.g. '75 Khara', '20/4 Khara', '100–150 Khara', 'N/A')
    original_size_description TEXT NOT NULL,
    normalized_size NUMERIC(14, 4), -- Optional parsed decimal if known reliably
    measurement_unit TEXT NOT NULL DEFAULT 'Khara', -- 'Khara', 'Decimal', 'Katha', 'Bigha', 'Sq. Ft', 'Acre', 'Other'
    
    -- Exact original ownership share preserved verbatim (e.g. 'Full ownership', '6 Ana', '3 Share', 'Mass Share', '50%', 'Unknown')
    original_ownership_description TEXT NOT NULL,
    normalized_ownership_percentage NUMERIC(6, 3), -- Stored ONLY when reliably known, NEVER fabricated
    ownership_uncertainty BOOLEAN NOT NULL DEFAULT FALSE,
    ownership_type TEXT NOT NULL DEFAULT 'sole_member' CHECK (ownership_type IN ('sole_member', 'multiple_members', 'family_joint', 'disputed', 'uncertain')),
    
    -- Location & Registry Identifiers
    location_address TEXT NOT NULL,
    district TEXT,
    mouza TEXT,
    khatian_number TEXT,
    dag_number TEXT,
    
    -- Acquisition & Valuations
    acquisition_date DATE,
    acquisition_cost NUMERIC(20, 2),
    current_market_valuation NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Recovery Tracking
    recovery_amount_required NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    expected_recovery_date DATE,
    actual_recovery_received NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    remaining_recovery_balance NUMERIC(20, 2) GENERATED ALWAYS AS (recovery_amount_required - actual_recovery_received) STORED,
    
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_recovery', 'disputed', 'sold', 'recovered', 'pending_partition')),
    remarks TEXT,
    document_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_property_code UNIQUE (workspace_id, property_code)
);

CREATE INDEX IF NOT EXISTS idx_properties_workspace ON public.properties(workspace_id, status);

-- 2. Property Co-Owners / Share Partition Ledger
CREATE TABLE IF NOT EXISTS public.property_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    owner_name TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('workspace_member', 'family_external', 'third_party')),
    member_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    share_description_raw TEXT NOT NULL, -- e.g. '6 Ana', '1/3 Share', 'Inherited Share'
    share_percentage NUMERIC(6, 3),      -- NULL if ambiguous or disputed
    is_disputed BOOLEAN NOT NULL DEFAULT FALSE,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_property_owners_prop ON public.property_owners(property_id);

-- 3. Historical Property Valuations (Audit & Market Re-assessments)
CREATE TABLE IF NOT EXISTS public.property_valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    full_market_value NUMERIC(20, 2) NOT NULL CHECK (full_market_value >= 0),
    ownership_adjusted_value NUMERIC(20, 2) NOT NULL CHECK (ownership_adjusted_value >= 0),
    valuer_name TEXT,
    valuation_method TEXT NOT NULL DEFAULT 'market_comparables' CHECK (valuation_method IN ('market_comparables', 'government_mouza_rate', 'formal_appraisal', 'owner_estimate')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_property_valuations_prop ON public.property_valuations(property_id, valuation_date DESC);

-- 4. Property Recovery Payments / Receipts
CREATE TABLE IF NOT EXISTS public.property_recoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    recovery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_received NUMERIC(20, 2) NOT NULL CHECK (amount_received > 0),
    payment_destination_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    received_from TEXT NOT NULL,
    receipt_reference TEXT,
    remaining_balance_after NUMERIC(20, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_property_recoveries_prop ON public.property_recoveries(property_id, recovery_date DESC);
