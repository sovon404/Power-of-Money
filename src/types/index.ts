export type WorkspaceType = 'personal' | 'family';
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type AccountClassification = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface AuthUser {
  id: string; // real Supabase UUID
  email: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  created_by: string;
  currency: string;
  description?: string;
  settings?: {
    fiscal_year_start?: string;
    dateFormat?: string;
    enableAiReceipts?: boolean;
  };
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  user_email: string;
  user_name: string;
  permissions: {
    can_view_accounts: boolean;
    can_manage_accounts: boolean;
    can_view_ledger: boolean;
    can_post_transactions: boolean;
    can_view_cards: boolean;
    can_manage_cards: boolean;
    can_view_loans: boolean;
    can_manage_loans: boolean;
    can_view_properties: boolean;
    can_manage_properties: boolean;
    can_view_budgets: boolean;
    can_manage_budgets: boolean;
    can_manage_members: boolean;
  };
  status: 'active' | 'invited' | 'revoked';
  joined_at: string;
}

export interface AccountType {
  id: string;
  name: string;
  classification: AccountClassification;
  normal_balance: NormalBalance;
  description?: string;
}

export interface FinancialAccount {
  id: string;
  workspace_id: string;
  name: string;
  account_type_id: string;
  provider: string; // Cash, BRAC Bank, bKash, Nagad, Rocket, Upay, City Bank, etc.
  account_number_masked?: string;
  currency: string;
  opening_balance: number;
  opening_date: string;
  current_balance_cached: number;
  is_archived: boolean;
  icon: string;
  color: string;
  notes?: string;
  created_at: string;
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  workspace_id: string;
  account_id: string;
  line_type: 'debit' | 'credit';
  amount: number;
  memo?: string;
  category_id?: string;
  counterparty?: string;
  tags?: string[];
  created_at: string;
}

export interface JournalEntry {
  id: string;
  workspace_id: string;
  entry_number: number;
  entry_date: string;
  memo: string;
  source_type: 
    | 'manual'
    | 'opening_balance'
    | 'transfer'
    | 'credit_card_charge'
    | 'credit_card_payment'
    | 'loan_disbursement'
    | 'loan_repayment'
    | 'property_recovery'
    | 'recurring_execution'
    | 'ai_receipt_scan';
  source_id?: string;
  status: 'draft' | 'posted' | 'voided' | 'reversed';
  is_reversal: boolean;
  reversal_of_entry_id?: string;
  created_by?: string;
  posted_at?: string;
  created_at: string;
  lines?: JournalLine[];
}

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer_allocation';
  accounting_classification: 
    | 'expense_operating'
    | 'expense_finance'
    | 'liability_reduction'
    | 'asset_transfer'
    | 'receivable_outflow'
    | 'income_operating';
  icon: string;
  color: string;
  is_seed: boolean;
  is_archived: boolean;
  sort_order: number;
}

export interface CreditCard {
  id: string;
  workspace_id: string;
  account_id: string;
  card_name: string;
  issuing_bank: string;
  card_network: 'Visa' | 'Mastercard' | 'Amex' | 'Other';
  last_four_digits: string;
  credit_limit: number;
  statement_day: number;
  payment_due_day: number;
  interest_rate_apr: number;
  annual_fee: number;
  status: 'active' | 'inactive' | 'blocked';
  notes?: string;
  created_at: string;
}

export interface CreditCardStatement {
  id: string;
  credit_card_id: string;
  statement_period: string;
  statement_date: string;
  due_date: string;
  total_amount_due: number;
  minimum_payment: number;
  paid_amount: number;
  is_settled: boolean;
}

export interface Loan {
  id: string;
  workspace_id: string;
  type: 'borrowed' | 'lent';
  account_id?: string;
  title: string;
  counterparty_name: string;
  counterparty_phone?: string;
  counterparty_relationship?: string;
  principal_amount: number;
  interest_rate: number;
  is_interest_bearing: boolean;
  start_date: string;
  maturity_date?: string;
  installment_frequency: 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'irregular';
  installment_amount?: number;
  total_principal_repaid: number;
  total_interest_paid: number;
  status: 'active' | 'fully_paid' | 'defaulted' | 'written_off';
  notes?: string;
  created_at: string;
}

export interface Property {
  id: string;
  workspace_id: string;
  property_code: string;
  name: string;
  category: string; // e.g. Agricultural Land, Residential Plot, Commercial Building, Pond/Fishery, Apartment/Flat
  property_type: string;
  original_size_description: string; // e.g. '75 Khara', '20/4 Khara', '100–150 Khara', 'N/A'
  normalized_size?: number;
  measurement_unit: string;
  original_ownership_description: string; // e.g. 'Full ownership', '6 Ana', '3 Share', 'Mass Share', '50%'
  normalized_ownership_percentage?: number;
  ownership_uncertainty: boolean;
  ownership_type: 'sole_member' | 'multiple_members' | 'family_joint' | 'disputed' | 'uncertain';
  location_address: string;
  district?: string;
  mouza?: string;
  khatian_number?: string;
  dag_number?: string;
  acquisition_date?: string;
  acquisition_cost?: number;
  current_market_valuation: number;
  valuation_date: string;
  recovery_amount_required: number;
  expected_recovery_date?: string;
  actual_recovery_received: number;
  remaining_recovery_balance: number;
  status: 'active' | 'under_recovery' | 'disputed' | 'sold' | 'recovered' | 'pending_partition';
  remarks?: string;
  document_urls?: string[];
  image_urls?: string[];
  created_at: string;
}

export interface PropertyValuation {
  id: string;
  property_id: string;
  valuation_date: string;
  full_market_value: number;
  ownership_adjusted_value: number;
  valuer_name?: string;
  valuation_method: string;
  notes?: string;
}

export interface PropertyRecovery {
  id: string;
  property_id: string;
  journal_entry_id?: string;
  recovery_date: string;
  amount_received: number;
  payment_destination_account_id?: string;
  received_from: string;
  receipt_reference?: string;
  remaining_balance_after: number;
  notes?: string;
}

export interface Budget {
  id: string;
  workspace_id: string;
  category_id: string;
  period_type: 'monthly' | 'annual' | 'custom';
  period_start: string;
  period_end: string;
  budget_amount: number;
  alert_threshold_percentage: number;
  notes?: string;
}

export interface SavingsGoal {
  id: string;
  workspace_id: string;
  account_id?: string;
  name: string;
  goal_type: 'dps' | 'fixed_deposit' | 'emergency_fund' | 'property_downpayment' | 'hajj_umrah' | 'education' | 'general_savings';
  target_amount: number;
  current_saved_amount: number;
  monthly_contribution: number;
  target_date?: string;
  expected_maturity_date?: string;
  expected_return_rate?: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  notes?: string;
  created_at?: string;
}

export interface RecurringRule {
  id: string;
  workspace_id: string;
  name: string;
  rule_type: 'expense' | 'income' | 'transfer' | 'dps_installment' | 'loan_installment' | 'card_reminder';
  amount: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string;
  next_due_date: string;
  source_account_id?: string;
  destination_account_id?: string;
  category_id?: string;
  auto_post: boolean;
  is_active: boolean;
  notes?: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  created_at: string;
}

export interface ReceiptScanResult {
  merchant: string;
  date: string;
  amount: number;
  currency: string;
  categorySuggestion: string;
  paymentMethod?: string;
  summary?: string;
  items?: Array<{ name: string; price: number }>;
}
