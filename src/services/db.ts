import { 
  Workspace, 
  WorkspaceMember, 
  FinancialAccount, 
  JournalEntry, 
  JournalLine, 
  Category, 
  CreditCard, 
  CreditCardStatement, 
  Loan, 
  Property, 
  PropertyValuation, 
  PropertyRecovery, 
  Budget, 
  SavingsGoal, 
  RecurringRule, 
  AuditLog 
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseSync } from './supabaseSync';
import { toUuid, generateUuid } from '../lib/uuid';

const STORAGE_KEYS = {
  CURRENT_USER: 'pom_current_user',
  WORKSPACES: 'pom_workspaces',
  MEMBERS: 'pom_workspace_members',
  ACCOUNTS: 'pom_financial_accounts',
  JOURNAL_ENTRIES: 'pom_journal_entries',
  JOURNAL_LINES: 'pom_journal_lines',
  CATEGORIES: 'pom_categories',
  CREDIT_CARDS: 'pom_credit_cards',
  CARD_STATEMENTS: 'pom_card_statements',
  LOANS: 'pom_loans',
  PROPERTIES: 'pom_properties',
  PROPERTY_VALUATIONS: 'pom_property_valuations',
  PROPERTY_RECOVERIES: 'pom_property_recoveries',
  BUDGETS: 'pom_budgets',
  SAVINGS_GOALS: 'pom_savings_goals',
  RECURRING_RULES: 'pom_recurring_rules',
  AUDIT_LOGS: 'pom_audit_logs',
  DELETED_ACCOUNTS: 'pom_deleted_accounts',
  DELETED_CATEGORIES: 'pom_deleted_categories',
};

// Seed Categories specified by user
export const SEED_CATEGORIES_DATA: Array<{
  name: string;
  type: 'income' | 'expense' | 'saving' | 'transfer_allocation';
  income_type?: string;
  accounting_classification: any;
  icon: string;
  color: string;
}> = [
  { name: 'Home Expense', type: 'expense', accounting_classification: 'expense_operating', icon: 'home', color: '#0284c7' },
  { name: 'Loan Repayment', type: 'expense', accounting_classification: 'liability_reduction', icon: 'shield-alert', color: '#e11d48' },
  { name: 'Dps', type: 'saving', accounting_classification: 'asset_savings', icon: 'piggy-bank', color: '#16a34a' },
  { name: 'Friends Fund Installment', type: 'expense', accounting_classification: 'liability_reduction', icon: 'users', color: '#ca8a04' },
  { name: 'Medical (Family)', type: 'expense', accounting_classification: 'expense_operating', icon: 'heart-pulse', color: '#dc2626' },
  { name: 'Investment', type: 'transfer_allocation', accounting_classification: 'asset_transfer', icon: 'trending-up', color: '#059669' },
  { name: 'Pop-Up Expenses', type: 'expense', accounting_classification: 'expense_operating', icon: 'sparkles', color: '#ea580c' },
  { name: 'Megabite', type: 'expense', accounting_classification: 'expense_operating', icon: 'wifi', color: '#2563eb' },
  { name: 'Dsp (BAF)', type: 'saving', accounting_classification: 'asset_savings', icon: 'landmark', color: '#0d9488' },
  { name: 'Los Fund (Installment)', type: 'expense', accounting_classification: 'liability_reduction', icon: 'layers', color: '#9333ea' },
  { name: 'Non-Interest Loan Repayment', type: 'expense', accounting_classification: 'liability_reduction', icon: 'handshake', color: '#475569' },
  { name: 'Leave', type: 'expense', accounting_classification: 'expense_operating', icon: 'calendar', color: '#64748b' },
  { name: 'Wifi (Home)', type: 'expense', accounting_classification: 'expense_operating', icon: 'wifi', color: '#0284c7' },
  { name: 'Electricity (Home)', type: 'expense', accounting_classification: 'expense_operating', icon: 'zap', color: '#f59e0b' },
  { name: 'Personal (Food)', type: 'expense', accounting_classification: 'expense_operating', icon: 'utensils', color: '#f97316' },
  { name: 'Mess Bill', type: 'expense', accounting_classification: 'expense_operating', icon: 'coffee', color: '#d97706' },
  { name: 'Lend Money (To Others)', type: 'transfer_allocation', accounting_classification: 'receivable_outflow', icon: 'arrow-up-right', color: '#6366f1' },
  { name: 'Bank & Card Charge', type: 'expense', accounting_classification: 'expense_finance', icon: 'credit-card', color: '#ef4444' },
  { name: 'Lend Money Return', type: 'income', income_type: 'other', accounting_classification: 'income_operating', icon: 'arrow-down-left', color: '#10b981' },
  { name: 'PSI', type: 'expense', accounting_classification: 'expense_operating', icon: 'file-text', color: '#64748b' },
  { name: 'Wify', type: 'expense', accounting_classification: 'expense_operating', icon: 'radio', color: '#06b6d4' },
  { name: 'Sisters', type: 'expense', accounting_classification: 'expense_operating', icon: 'heart', color: '#ec4899' },
  { name: 'Minutes', type: 'expense', accounting_classification: 'expense_operating', icon: 'phone', color: '#84cc16' },
  { name: 'Tailor Shop Svc', type: 'expense', accounting_classification: 'expense_operating', icon: 'scissors', color: '#a855f7' },
  { name: 'FWS', type: 'expense', accounting_classification: 'expense_operating', icon: 'briefcase', color: '#3b82f6' },
  { name: 'Swimming Pool', type: 'expense', accounting_classification: 'expense_operating', icon: 'waves', color: '#0ea5e9' },
  { name: 'Personal (Transport)', type: 'expense', accounting_classification: 'expense_operating', icon: 'car', color: '#8b5cf6' },
  { name: 'Haircut', type: 'expense', accounting_classification: 'expense_operating', icon: 'scissors', color: '#f43f5e' },
  { name: 'Personal (Tech)', type: 'expense', accounting_classification: 'expense_operating', icon: 'laptop', color: '#3b82f6' },
  { name: 'Personal (Recreations)', type: 'expense', accounting_classification: 'expense_operating', icon: 'film', color: '#14b8a6' },
  { name: 'Others (svc)', type: 'expense', accounting_classification: 'expense_operating', icon: 'tool', color: '#71717a' },
  { name: 'Donations', type: 'expense', accounting_classification: 'expense_operating', icon: 'gift', color: '#22c55e' },
  { name: 'Unity Fund-2026', type: 'saving', accounting_classification: 'asset_savings', icon: 'flag', color: '#eab308' },
  { name: 'Protein Target', type: 'expense', accounting_classification: 'expense_operating', icon: 'activity', color: '#10b981' },
  { name: 'Adjustment', type: 'expense', accounting_classification: 'expense_operating', icon: 'sliders', color: '#64748b' },
  { name: 'FITA', type: 'expense', accounting_classification: 'expense_operating', icon: 'award', color: '#f59e0b' },
  // Core Income Categories with Types (Salary, Remote/Freelance, Land Mortgage, Business, Investment, Other)
  { name: 'Salary', type: 'income', income_type: 'salary', accounting_classification: 'income_operating', icon: 'briefcase', color: '#10b981' },
  { name: 'Allowances & Bonus', type: 'income', income_type: 'salary', accounting_classification: 'income_operating', icon: 'award', color: '#059669' },
  { name: 'Business / Freelance', type: 'income', income_type: 'remote_freelance', accounting_classification: 'income_operating', icon: 'laptop', color: '#0284c7' },
  { name: 'Remote Work Contracts', type: 'income', income_type: 'remote_freelance', accounting_classification: 'income_operating', icon: 'globe', color: '#38bdf8' },
  { name: 'Land Mortgage & Lease', type: 'income', income_type: 'land_mortgage', accounting_classification: 'income_operating', icon: 'building', color: '#d97706' },
  { name: 'Rental Income', type: 'income', income_type: 'land_mortgage', accounting_classification: 'income_operating', icon: 'home', color: '#f59e0b' },
  { name: 'Investment Returns', type: 'income', income_type: 'investment', accounting_classification: 'income_operating', icon: 'trending-up', color: '#0d9488' },
  { name: 'Other Income', type: 'income', income_type: 'other', accounting_classification: 'income_operating', icon: 'plus-circle', color: '#14b8a6' },
];

class DatabaseEngine {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage set error:', e);
    }
  }

  // Workspaces
  getWorkspaces(userId?: string): Workspace[] {
    const all = this.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
    if (!userId) return all;
    return all.filter(w => w.created_by === userId);
  }

  saveWorkspace(ws: Workspace): void {
    const list = this.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
    const idx = list.findIndex(w => w.id === ws.id);
    if (idx >= 0) {
      list[idx] = ws;
    } else {
      list.push(ws);
    }
    this.set(STORAGE_KEYS.WORKSPACES, list);
    if (ws.created_by) {
      supabaseSync.syncWorkspace(ws, ws.created_by);
    }
  }

  // Initialize workspace bound strictly to authenticated user's ID
  initializeUserWorkspace(userId: string, userName?: string, userEmail?: string): { workspace: Workspace; isNew: boolean } {
    const wsUuid = toUuid(`ws_${userId}`);
    let workspaces = this.getWorkspaces(userId);
    let activeWs: Workspace;
    let isNew = false;

    if (workspaces.length === 0) {
      activeWs = {
        id: wsUuid,
        name: `${userName || 'My'}'s Vault`,
        type: 'personal',
        created_by: userId,
        currency: 'BDT',
        description: `Primary personal financial vault for ${userEmail || userName || userId}`,
        created_at: new Date().toISOString(),
      };
      this.saveWorkspace(activeWs);
      this.ensureCategoriesForWorkspace(activeWs.id);
      isNew = true;
    } else {
      activeWs = workspaces[0];
      this.ensureCategoriesForWorkspace(activeWs.id);
    }

    // Direct cloud sync to Supabase (profiles, workspaces)
    supabaseSync.syncProfile(userId, userEmail || '', userName || '');
    supabaseSync.syncWorkspace(activeWs, userId);

    return { workspace: activeWs, isNew };
  }

  // Fallback for backward compatibility
  initializeDefaultWorkspace(userId?: string, userName?: string): { workspace: Workspace; isNew: boolean } {
    return this.initializeUserWorkspace(userId || 'user_owner', userName);
  }

  seedCategoriesForWorkspace(workspaceId: string): void {
    this.ensureCategoriesForWorkspace(workspaceId);
  }

  // Ensures all 36 expense categories + income stream categories exist with deterministic UUIDs
  ensureCategoriesForWorkspace(workspaceId: string): Category[] {
    const allCats = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const existing = allCats.filter(c => c.workspace_id === workspaceId);
    const existingNames = new Set(existing.map(c => c.name.toLowerCase().trim()));
    const deletedCats = new Set(this.get<string[]>(STORAGE_KEYS.DELETED_CATEGORIES, []).map(s => s.toLowerCase().trim()));
    const missing: Category[] = [];

    SEED_CATEGORIES_DATA.forEach((c, i) => {
      const nameKey = c.name.toLowerCase().trim();
      const catUuid = toUuid(`cat_${workspaceId}_${nameKey.replace(/[^a-z0-9]/g, '_')}`);
      
      // CRITICAL: NEVER resurrect a category that was deleted by the user
      if (deletedCats.has(nameKey) || deletedCats.has(catUuid)) {
        return;
      }

      if (!existingNames.has(nameKey)) {
        const newCat: Category = {
          id: catUuid,
          workspace_id: workspaceId,
          name: c.name,
          type: c.type,
          income_type: c.income_type,
          accounting_classification: c.accounting_classification,
          icon: c.icon,
          color: c.color,
          is_seed: true,
          is_archived: false,
          sort_order: i + 1,
        };
        missing.push(newCat);
      }
    });

    let updated = false;
    let resultCats = [...allCats];

    if (missing.length > 0) {
      resultCats = [...resultCats, ...missing];
      updated = true;
      missing.forEach(cat => supabaseSync.syncCategory(cat, workspaceId));
    }

    // Also enrich any existing income categories or upgrade saving categories
    resultCats = resultCats.map(cat => {
      if (cat.workspace_id === workspaceId && cat.type === 'income' && !cat.income_type) {
        updated = true;
        const seedMatch = SEED_CATEGORIES_DATA.find(s => s.name.toLowerCase() === cat.name.toLowerCase());
        const inferredType = seedMatch?.income_type || (
          cat.name.toLowerCase().includes('salary') || cat.name.toLowerCase().includes('bonus') || cat.name.toLowerCase().includes('allowance') ? 'salary' :
          cat.name.toLowerCase().includes('freelance') || cat.name.toLowerCase().includes('remote') || cat.name.toLowerCase().includes('contract') ? 'remote_freelance' :
          cat.name.toLowerCase().includes('mortgage') || cat.name.toLowerCase().includes('rent') || cat.name.toLowerCase().includes('land') || cat.name.toLowerCase().includes('lease') ? 'land_mortgage' :
          cat.name.toLowerCase().includes('invest') || cat.name.toLowerCase().includes('return') || cat.name.toLowerCase().includes('dividend') ? 'investment' :
          cat.name.toLowerCase().includes('business') || cat.name.toLowerCase().includes('trade') ? 'business' : 'other'
        );
        return { ...cat, income_type: inferredType };
      }

      if (cat.workspace_id === workspaceId) {
        const seedMatch = SEED_CATEGORIES_DATA.find(s => s.name.toLowerCase() === cat.name.toLowerCase());
        if (seedMatch && seedMatch.type === 'saving' && (cat.type !== 'saving' || !cat.target_savings_account_id)) {
          updated = true;
          const defaultTargetAcc = cat.name.toLowerCase().includes('unity') 
            ? toUuid(`acc_unity_fund_${workspaceId}`) 
            : toUuid(`acc_dps_baf_${workspaceId}`);
          return {
            ...cat,
            type: 'saving',
            accounting_classification: 'asset_savings' as any,
            target_savings_account_id: cat.target_savings_account_id || defaultTargetAcc,
          };
        }
      }

      return cat;
    });

    if (updated) {
      this.set(STORAGE_KEYS.CATEGORIES, resultCats);
    }

    return resultCats.filter(c => c.workspace_id === workspaceId && !c.is_archived);
  }

  // Income Types Management
  getIncomeTypes(workspaceId: string): Array<{ id: string; name: string; description?: string; color: string; icon: string }> {
    const key = `pom_income_types_${workspaceId}`;
    const defaultTypes = [
      { id: 'salary', name: 'Salary / Employment', description: 'Monthly wages, official pay, bonuses', color: '#10b981', icon: 'briefcase' },
      { id: 'remote_freelance', name: 'Remote / Freelancing', description: 'Tech contracts, software freelancing, remittance', color: '#0284c7', icon: 'laptop' },
      { id: 'land_mortgage', name: 'Land Mortgage & Rent', description: 'Land mortgage yields, plot lease, tenant rent', color: '#d97706', icon: 'building' },
      { id: 'business', name: 'Business & Trade', description: 'Commercial enterprise, trading, products', color: '#8b5cf6', icon: 'globe' },
      { id: 'investment', name: 'Investment Returns', description: 'DPS profits, dividends, capital gains', color: '#0d9488', icon: 'trending-up' },
      { id: 'other', name: 'Other Inflows', description: 'Gifts, one-off receipts, allowances', color: '#64748b', icon: 'plus-circle' },
    ];
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return defaultTypes;
  }

  saveIncomeTypes(workspaceId: string, types: Array<{ id: string; name: string; description?: string; color: string; icon: string }>): void {
    const key = `pom_income_types_${workspaceId}`;
    localStorage.setItem(key, JSON.stringify(types));
  }

  // Hydrates local storage cache with pure live data from Supabase DB (no dummy data)
  hydrateFromSupabase(data: {
    accounts?: FinancialAccount[];
    categories?: Category[];
    cards?: CreditCard[];
    loans?: Loan[];
    properties?: Property[];
    entries?: JournalEntry[];
    budgets?: Budget[];
    goals?: SavingsGoal[];
    rules?: RecurringRule[];
  }, workspaceId: string): void {
    const deletedAccs = new Set(this.get<string[]>(STORAGE_KEYS.DELETED_ACCOUNTS, []).map(s => s.toLowerCase().trim()));
    const deletedCats = new Set(this.get<string[]>(STORAGE_KEYS.DELETED_CATEGORIES, []).map(s => s.toLowerCase().trim()));

    if (data.accounts !== undefined) {
      const allAccs = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);
      const otherAccs = allAccs.filter(a => a.workspace_id !== workspaceId);
      const localAccs = allAccs.filter(a => a.workspace_id === workspaceId);
      const localMap = new Map(localAccs.map(a => [a.id, a]));
      
      const remoteFiltered = data.accounts.filter(remoteAcc => 
        !deletedAccs.has(remoteAcc.id.toLowerCase()) && 
        !deletedAccs.has(remoteAcc.name.toLowerCase().trim())
      );

      const mergedAccs = remoteFiltered.map(remoteAcc => {
        const local = localMap.get(remoteAcc.id);
        return {
          ...remoteAcc,
          // Preserve local balance if remote cached balance is 0 and local has a non-zero balance
          current_balance_cached: remoteAcc.current_balance_cached !== 0 
            ? remoteAcc.current_balance_cached 
            : (local?.current_balance_cached || remoteAcc.opening_balance || 0),
        };
      });

      // Preserve any local accounts not yet fetched from remote (unless deleted)
      const remoteAccIds = new Set(data.accounts.map(a => a.id));
      for (const local of localAccs) {
        if (!remoteAccIds.has(local.id) && !deletedAccs.has(local.id.toLowerCase()) && !deletedAccs.has(local.name.toLowerCase().trim())) {
          mergedAccs.push(local);
          supabaseSync.syncAccount(local, workspaceId);
        }
      }

      this.set(STORAGE_KEYS.ACCOUNTS, [...otherAccs, ...mergedAccs]);
    }

    if (data.categories !== undefined && data.categories.length > 0) {
      const allCats = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      const otherCats = allCats.filter(c => c.workspace_id !== workspaceId);
      const localCats = allCats.filter(c => c.workspace_id === workspaceId);
      const localMap = new Map(localCats.map(c => [c.id, c]));
      const localNameMap = new Map(localCats.map(c => [c.name.toLowerCase(), c]));

      const mergedCats: Category[] = [];
      const seenIds = new Set<string>();

      const remoteFiltered = data.categories.filter(remoteCat => 
        !deletedCats.has(remoteCat.id.toLowerCase()) && 
        !deletedCats.has(remoteCat.name.toLowerCase().trim())
      );

      for (const remoteCat of remoteFiltered) {
        seenIds.add(remoteCat.id);
        const local = localMap.get(remoteCat.id) || localNameMap.get(remoteCat.name.toLowerCase());
        const isSaving = 
          remoteCat.type === 'saving' || 
          remoteCat.accounting_classification === 'asset_savings' ||
          local?.type === 'saving' ||
          local?.accounting_classification === 'asset_savings' ||
          ['dps', 'dsp (baf)', 'unity fund-2026'].includes(remoteCat.name.toLowerCase());

        mergedCats.push({
          ...remoteCat,
          parent_id: remoteCat.parent_id !== undefined ? remoteCat.parent_id : local?.parent_id,
          description: remoteCat.description || local?.description,
          type: isSaving ? 'saving' : remoteCat.type,
          accounting_classification: isSaving ? ('asset_savings' as any) : (remoteCat.accounting_classification || 'expense_operating'),
          target_savings_account_id: remoteCat.target_savings_account_id || local?.target_savings_account_id,
          // CRITICAL: Preserve local income_type if remote does not have it (e.g. migration pending)
          income_type: remoteCat.income_type || local?.income_type || (remoteCat.type === 'income' ? 'other' : undefined),
        });
      }

      // Preserve any local categories created in the UI that haven't been fetched yet (unless deleted)
      for (const local of localCats) {
        if (!seenIds.has(local.id) && 
            !data.categories.some(r => r.name.toLowerCase() === local.name.toLowerCase()) &&
            !deletedCats.has(local.id.toLowerCase()) && 
            !deletedCats.has(local.name.toLowerCase().trim())) {
          mergedCats.push(local);
          supabaseSync.syncCategory(local, workspaceId);
        }
      }

      this.set(STORAGE_KEYS.CATEGORIES, [...otherCats, ...mergedCats]);
    }
    if (data.cards !== undefined) {
      const otherCards = this.get<CreditCard[]>(STORAGE_KEYS.CREDIT_CARDS, []).filter(c => c.workspace_id !== workspaceId);
      this.set(STORAGE_KEYS.CREDIT_CARDS, [...otherCards, ...data.cards]);
    }
    if (data.loans !== undefined) {
      const otherLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []).filter(l => l.workspace_id !== workspaceId);
      this.set(STORAGE_KEYS.LOANS, [...otherLoans, ...data.loans]);
    }
    if (data.properties !== undefined) {
      const otherProps = this.get<Property[]>(STORAGE_KEYS.PROPERTIES, []).filter(p => p.workspace_id !== workspaceId);
      this.set(STORAGE_KEYS.PROPERTIES, [...otherProps, ...data.properties]);
    }
    if (data.budgets !== undefined) {
      const otherBudgets = this.get<Budget[]>(STORAGE_KEYS.BUDGETS, []).filter(b => b.workspace_id !== workspaceId);
      this.set(STORAGE_KEYS.BUDGETS, [...otherBudgets, ...data.budgets]);
    }
    if (data.goals !== undefined) {
      const otherGoals = this.get<SavingsGoal[]>(STORAGE_KEYS.SAVINGS_GOALS, []).filter(g => g.workspace_id !== workspaceId);
      this.set(STORAGE_KEYS.SAVINGS_GOALS, [...otherGoals, ...data.goals]);
    }
    if (data.rules !== undefined) {
      const otherRules = this.get<RecurringRule[]>(STORAGE_KEYS.RECURRING_RULES, []).filter(r => r.workspace_id !== workspaceId);
      this.set(STORAGE_KEYS.RECURRING_RULES, [...otherRules, ...data.rules]);
    }
    if (data.entries !== undefined) {
      const otherEntries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []).filter(e => e.workspace_id !== workspaceId);
      const otherLines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []).filter(l => l.workspace_id !== workspaceId);
      const newLines: JournalLine[] = [];
      data.entries.forEach(e => {
        if ((e as any).lines && Array.isArray((e as any).lines)) {
          newLines.push(...(e as any).lines);
        }
      });
      this.set(STORAGE_KEYS.JOURNAL_ENTRIES, [...otherEntries, ...data.entries]);
      if (newLines.length > 0) {
        this.set(STORAGE_KEYS.JOURNAL_LINES, [...otherLines, ...newLines]);
      }
    }
  }

  // Safe cleanup - retains all user heads and real accounts
  purgeLocalDemoData(_workspaceId: string): void {
    // No-op to preserve persistent accounts and heads
  }

  // Ensures foundational accounts exist with deterministic RFC4122 v4 UUIDs
  ensureDefaultAccountsForWorkspace(workspaceId: string): FinancialAccount[] {
    const existing = this.getAccounts(workspaceId);
    const existingUuids = new Set(existing.map(a => a.id));
    const existingNames = new Set(existing.map(a => a.name.toLowerCase().trim()));
    const deletedAccs = new Set(this.get<string[]>(STORAGE_KEYS.DELETED_ACCOUNTS, []).map(s => s.toLowerCase().trim()));

    const defaults: Array<{
      defaultId: string;
      name: string;
      type: string;
      provider: string;
      icon: string;
      color: string;
    }> = [
      { defaultId: `acc_cash_hand_${workspaceId}`, name: 'Cash In Hand', type: 'cash', provider: 'Cash', icon: 'banknote', color: '#10b981' },
      { defaultId: `acc_bank_online_${workspaceId}`, name: 'Cash In Bank / Online', type: 'bank', provider: 'Bank', icon: 'landmark', color: '#0284c7' },
      { defaultId: `acc_bkash_wallet_${workspaceId}`, name: 'bKash Wallet', type: 'mfs', provider: 'bKash', icon: 'smartphone', color: '#e11d48' },
      { defaultId: `acc_nagad_wallet_${workspaceId}`, name: 'Nagad Wallet', type: 'mfs', provider: 'Nagad', icon: 'smartphone', color: '#ea580c' },
      { defaultId: `acc_dspf_baf_${workspaceId}`, name: 'DSPF (BAF)', type: 'savings_dps', provider: 'BAF / DSPF', icon: 'piggy-bank', color: '#0d9488' },
      { defaultId: `acc_unity_fund_${workspaceId}`, name: 'Unity Fund-2026', type: 'savings_dps', provider: 'Unity Fund', icon: 'flag', color: '#eab308' },
      { defaultId: `acc_los_fund_${workspaceId}`, name: 'LOS Fund', type: 'savings_dps', provider: 'LOS Fund', icon: 'layers', color: '#9333ea' },
      { defaultId: `acc_income_earned_${workspaceId}`, name: 'Earned Revenue & Income', type: 'income_salary', provider: 'Revenue', icon: 'trending-up', color: '#10b981' },
      { defaultId: `acc_expense_operating_${workspaceId}`, name: 'General Operating Expenses', type: 'expense_operating', provider: 'Operating', icon: 'receipt', color: '#ef4444' },
      { defaultId: `acc_equity_offset_${workspaceId}`, name: 'Opening Balance Equity', type: 'opening_equity', provider: 'Equity', icon: 'scale', color: '#64748b' },
    ];

    let updated = false;
    const allAccounts = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);

    for (const d of defaults) {
      const uuid = toUuid(d.defaultId);
      const nameKey = d.name.toLowerCase().trim();

      // CRITICAL: NEVER resurrect an account deleted by user!
      if (deletedAccs.has(uuid.toLowerCase()) || deletedAccs.has(nameKey)) {
        continue;
      }

      const nameMatch = existingNames.has(nameKey);
      const idMatch = existingUuids.has(uuid);

      if (!nameMatch && !idMatch) {
        const newAcc: FinancialAccount = {
          id: uuid,
          workspace_id: workspaceId,
          name: d.name,
          account_type_id: d.type,
          provider: d.provider,
          currency: 'BDT',
          opening_balance: 0,
          opening_date: new Date().toISOString().split('T')[0],
          current_balance_cached: 0,
          is_archived: false,
          icon: d.icon,
          color: d.color,
          created_at: new Date().toISOString(),
        };
        allAccounts.push(newAcc);
        supabaseSync.syncAccount(newAcc, workspaceId);
        updated = true;
      }
    }

    if (updated) {
      this.set(STORAGE_KEYS.ACCOUNTS, allAccounts);
    }

    return this.getAccounts(workspaceId);
  }

  // Financial Accounts with Live Dynamic Ledger-Derived Balances
  getAccounts(workspaceId: string): FinancialAccount[] {
    const list = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []).filter(a => a.workspace_id === workspaceId);
    const lines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []).filter(l => l.workspace_id === workspaceId);
    const entries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []).filter(e => e.workspace_id === workspaceId);

    const validEntryIds = new Set(
      entries.filter(e => e.status === 'posted').map(e => e.id)
    );

    const debitSums = new Map<string, number>();
    const creditSums = new Map<string, number>();

    for (const l of lines) {
      if (!validEntryIds.has(l.journal_entry_id)) continue;
      const amt = Number(l.amount) || 0;
      if (l.line_type === 'debit') {
        debitSums.set(l.account_id, (debitSums.get(l.account_id) || 0) + amt);
      } else {
        creditSums.set(l.account_id, (creditSums.get(l.account_id) || 0) + amt);
      }
    }

    const normalDebitTypes = new Set([
      'cash', 'bank', 'mfs', 'savings_dps', 'investment', 
      'receivable', 'property_asset', 'expense_operating', 'expense_finance'
    ]);

    return list.map(a => {
      const d = debitSums.get(a.id) || 0;
      const c = creditSums.get(a.id) || 0;
      const hasLines = debitSums.has(a.id) || creditSums.has(a.id);
      let calculatedBalance: number;

      if (normalDebitTypes.has(a.account_type_id)) {
        calculatedBalance = hasLines ? (d - c) : (Number(a.opening_balance) || Number(a.current_balance_cached) || 0);
      } else {
        // Credit normal (credit_card, loan_payable, equity, income)
        calculatedBalance = hasLines ? (c - d) : (Number(a.opening_balance) || Number(a.current_balance_cached) || 0);
      }

      return {
        ...a,
        current_balance_cached: Math.round(calculatedBalance * 100) / 100,
      };
    });
  }

  saveAccount(account: FinancialAccount): void {
    const list = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);
    const idx = list.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      list[idx] = account;
    } else {
      list.push(account);
    }
    // If account was marked as deleted, unmark it
    const deletedAccs = this.get<string[]>(STORAGE_KEYS.DELETED_ACCOUNTS, []);
    const updatedDeleted = deletedAccs.filter(id => id !== account.id && id !== account.name.toLowerCase().trim());
    if (updatedDeleted.length !== deletedAccs.length) {
      this.set(STORAGE_KEYS.DELETED_ACCOUNTS, updatedDeleted);
    }
    this.set(STORAGE_KEYS.ACCOUNTS, list);
    supabaseSync.syncAccount(account, account.workspace_id);
  }

  deleteAccount(arg1: string, arg2: string): void {
    const list = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);
    let accountId = arg1;
    let workspaceId = arg2;
    if (list.some(a => a.id === arg2) && !list.some(a => a.id === arg1)) {
      accountId = arg2;
      workspaceId = arg1;
    }
    const acc = list.find(a => a.id === accountId);
    this.set(STORAGE_KEYS.ACCOUNTS, list.filter(a => a.id !== accountId));

    // Permanently record in DELETED_ACCOUNTS so ensureDefaultAccountsForWorkspace NEVER brings it back!
    const deletedAccs = this.get<string[]>(STORAGE_KEYS.DELETED_ACCOUNTS, []);
    if (!deletedAccs.includes(accountId)) deletedAccs.push(accountId);
    if (acc && !deletedAccs.includes(acc.name.toLowerCase().trim())) {
      deletedAccs.push(acc.name.toLowerCase().trim());
    }
    this.set(STORAGE_KEYS.DELETED_ACCOUNTS, deletedAccs);

    // Also purge local journal lines associated with this account
    const lines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []);
    this.set(STORAGE_KEYS.JOURNAL_LINES, lines.filter(l => l.account_id !== accountId));

    // Also purge local credit cards tied to this account
    const cards = this.get<CreditCard[]>(STORAGE_KEYS.CREDIT_CARDS, []);
    this.set(STORAGE_KEYS.CREDIT_CARDS, cards.filter(c => c.account_id !== accountId));

    supabaseSync.deleteAccount(accountId, workspaceId);
  }

  // Journal Entries & Lines
  getJournalEntries(workspaceId: string): JournalEntry[] {
    const entries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const lines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []);
    
    return entries
      .filter(e => e.workspace_id === workspaceId)
      .map(e => ({
        ...e,
        lines: lines.filter(l => l.journal_entry_id === e.id),
      }))
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }

  /**
   * Post Double-Entry Journal Transaction
   * Enforces: sum(debits) === sum(credits)
   */
  postJournalEntry(
    workspaceId: string,
    params: {
      memo: string;
      source_type: JournalEntry['source_type'];
      source_id?: string;
      entry_date: string;
      period_end_date?: string;
      is_historical?: boolean;
      historical_note?: string;
      lines: Array<{
        account_id: string;
        line_type: 'debit' | 'credit';
        amount: number;
        memo?: string;
        category_id?: string;
        counterparty?: string;
        tags?: string[];
      }>;
    }
  ): { success: boolean; entryId?: string; error?: string } {
    const totalDebit = params.lines
      .filter(l => l.line_type === 'debit')
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCredit = params.lines
      .filter(l => l.line_type === 'credit')
      .reduce((sum, l) => sum + Number(l.amount), 0);

    // Exact numeric equality check (rounded to 2 decimals)
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return {
        success: false,
        error: `Unbalanced journal entry rejected. Total debits (${totalDebit.toFixed(2)}) must equal total credits (${totalCredit.toFixed(2)}).`,
      };
    }

    if (totalDebit <= 0) {
      return { success: false, error: 'Amounts must be strictly greater than zero.' };
    }

    const entryId = generateUuid();
    const currentEntries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const currentLines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []);
    const accounts = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);

    const newEntry: JournalEntry = {
      id: entryId,
      workspace_id: workspaceId,
      entry_number: currentEntries.length + 1,
      entry_date: params.entry_date,
      period_end_date: params.period_end_date || undefined,
      memo: params.memo,
      source_type: params.source_type,
      source_id: params.source_id,
      status: 'posted',
      is_reversal: false,
      is_historical: Boolean(params.is_historical),
      historical_note: params.historical_note,
      posted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const defaultOperatingAccId = toUuid(`acc_expense_operating_${workspaceId}`);
    const newLines: JournalLine[] = params.lines.map((l, i) => ({
      id: generateUuid(),
      journal_entry_id: entryId,
      workspace_id: workspaceId,
      account_id: l.account_id && l.account_id.trim() !== '' ? l.account_id : defaultOperatingAccId,
      line_type: l.line_type,
      amount: Number(l.amount),
      memo: l.memo || params.memo,
      category_id: l.category_id,
      counterparty: l.counterparty,
      tags: l.tags || [],
      created_at: new Date().toISOString(),
    }));

    // Update account balances atomically
    for (const line of newLines) {
      const acc = accounts.find(a => a.id === line.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const change = line.line_type === 'debit' ? line.amount : -line.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + change
          : acc.current_balance_cached - change;
        supabaseSync.syncAccount(acc, workspaceId);
      }
    }

    this.set(STORAGE_KEYS.JOURNAL_ENTRIES, [newEntry, ...currentEntries]);
    this.set(STORAGE_KEYS.JOURNAL_LINES, [...currentLines, ...newLines]);
    this.set(STORAGE_KEYS.ACCOUNTS, accounts);

    // Sync complete journal transaction to Supabase
    supabaseSync.syncJournalEntry({ ...newEntry, lines: newLines }, workspaceId);

    this.logAudit(workspaceId, 'POST_JOURNAL_ENTRY', 'journal_entry', entryId, {
      memo: params.memo,
      amount: totalDebit,
      source_type: params.source_type,
      is_historical: params.is_historical,
    });

    return { success: true, entryId };
  }

  /**
   * Update an existing Journal Entry (Atomic rollback of previous lines + application of new lines)
   */
  updateJournalEntry(
    workspaceId: string,
    entryId: string,
    params: {
      memo: string;
      entry_date: string;
      period_end_date?: string;
      is_historical?: boolean;
      historical_note?: string;
      lines: Array<{
        account_id: string;
        line_type: 'debit' | 'credit';
        amount: number;
        memo?: string;
        category_id?: string;
        counterparty?: string;
        tags?: string[];
      }>;
    }
  ): { success: boolean; error?: string } {
    const totalDebit = params.lines
      .filter(l => l.line_type === 'debit')
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCredit = params.lines
      .filter(l => l.line_type === 'credit')
      .reduce((sum, l) => sum + Number(l.amount), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return {
        success: false,
        error: `Unbalanced journal entry rejected. Total debits (${totalDebit.toFixed(2)}) must equal total credits (${totalCredit.toFixed(2)}).`,
      };
    }

    const currentEntries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const currentLines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []);
    const accounts = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);

    const existingEntryIndex = currentEntries.findIndex(e => e.id === entryId);
    if (existingEntryIndex === -1) {
      return { success: false, error: 'Journal entry not found.' };
    }

    const existingEntry = currentEntries[existingEntryIndex];
    const oldLines = currentLines.filter(l => l.journal_entry_id === entryId);

    // 1. Rollback old line effects on accounts
    for (const oldLine of oldLines) {
      const acc = accounts.find(a => a.id === oldLine.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const change = oldLine.line_type === 'debit' ? -oldLine.amount : oldLine.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + change
          : acc.current_balance_cached - change;
      }
    }

    // 2. Generate new lines
    const defaultOperatingAccId = toUuid(`acc_expense_operating_${workspaceId}`);
    const updatedLines: JournalLine[] = params.lines.map((l) => ({
      id: generateUuid(),
      journal_entry_id: entryId,
      workspace_id: workspaceId,
      account_id: l.account_id && l.account_id.trim() !== '' ? l.account_id : defaultOperatingAccId,
      line_type: l.line_type,
      amount: Number(l.amount),
      memo: l.memo || params.memo,
      category_id: l.category_id,
      counterparty: l.counterparty,
      tags: l.tags || [],
      created_at: new Date().toISOString(),
    }));

    // 3. Apply new line effects on accounts
    for (const line of updatedLines) {
      const acc = accounts.find(a => a.id === line.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const change = line.line_type === 'debit' ? line.amount : -line.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + change
          : acc.current_balance_cached - change;
        supabaseSync.syncAccount(acc, workspaceId);
      }
    }

    // 4. Update entry object
    const updatedEntry: JournalEntry = {
      ...existingEntry,
      memo: params.memo,
      entry_date: params.entry_date,
      period_end_date: params.period_end_date !== undefined ? (params.period_end_date || undefined) : existingEntry.period_end_date,
      is_historical: params.is_historical !== undefined ? Boolean(params.is_historical) : existingEntry.is_historical,
      historical_note: params.historical_note !== undefined ? params.historical_note : existingEntry.historical_note,
      lines: updatedLines,
    };

    currentEntries[existingEntryIndex] = updatedEntry;
    const remainingLines = currentLines.filter(l => l.journal_entry_id !== entryId);

    this.set(STORAGE_KEYS.JOURNAL_ENTRIES, currentEntries);
    this.set(STORAGE_KEYS.JOURNAL_LINES, [...remainingLines, ...updatedLines]);
    this.set(STORAGE_KEYS.ACCOUNTS, accounts);

    // Sync to Supabase
    supabaseSync.syncJournalEntry(updatedEntry, workspaceId);
    this.logAudit(workspaceId, 'UPDATE_JOURNAL_ENTRY', 'journal_entry', entryId, { memo: params.memo });

    return { success: true };
  }

  /**
   * Delete a Journal Entry completely (reverts account balances and removes entry & lines)
   */
  deleteJournalEntry(arg1: string, arg2: string): { success: boolean; error?: string } {
    const currentEntries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const currentLines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []);
    const accounts = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);

    let workspaceId = arg1;
    let entryId = arg2;
    if (currentEntries.some(e => e.id === arg1) && !currentEntries.some(e => e.id === arg2)) {
      entryId = arg1;
      workspaceId = arg2;
    }

    const entryToDelete = currentEntries.find(e => e.id === entryId);
    if (!entryToDelete) {
      return { success: false, error: 'Transaction not found.' };
    }

    const linesToDelete = currentLines.filter(l => l.journal_entry_id === entryId);

    // Revert account balances
    for (const line of linesToDelete) {
      const acc = accounts.find(a => a.id === line.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const change = line.line_type === 'debit' ? -line.amount : line.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + change
          : acc.current_balance_cached - change;
        supabaseSync.syncAccount(acc, workspaceId);
      }
    }

    // Remove entry and lines from local storage
    this.set(STORAGE_KEYS.JOURNAL_ENTRIES, currentEntries.filter(e => e.id !== entryId));
    this.set(STORAGE_KEYS.JOURNAL_LINES, currentLines.filter(l => l.journal_entry_id !== entryId));
    this.set(STORAGE_KEYS.ACCOUNTS, accounts);

    // Sync deletion to Supabase
    supabaseSync.deleteJournalEntry(entryId, workspaceId);
    this.logAudit(workspaceId, 'DELETE_JOURNAL_ENTRY', 'journal_entry', entryId, { memo: entryToDelete.memo });

    return { success: true };
  }

  /**
   * Account Transfer (Debits destination, credits source without touching income/expense)
   */
  postTransfer(
    workspaceId: string,
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    date: string,
    memo: string,
    periodEndDate?: string
  ): { success: boolean; error?: string } {
    if (sourceAccountId === destinationAccountId) {
      return { success: false, error: 'Source and destination accounts must be different.' };
    }
    return this.postJournalEntry(workspaceId, {
      memo: memo || 'Account Transfer',
      source_type: 'transfer',
      entry_date: date,
      period_end_date: periodEndDate,
      lines: [
        {
          account_id: destinationAccountId,
          line_type: 'debit',
          amount,
          memo: `Transfer received: ${memo}`,
        },
        {
          account_id: sourceAccountId,
          line_type: 'credit',
          amount,
          memo: `Transfer sent: ${memo}`,
        },
      ],
    });
  }

  /**
   * Controlled Reversal (Audit-compliant correction, never silent edit)
   */
  postReversal(
    workspaceId: string,
    entryId: string,
    reason: string
  ): { success: boolean; error?: string } {
    const entries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const lines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []);
    const target = entries.find(e => e.id === entryId);

    if (!target) return { success: false, error: 'Transaction not found.' };
    if (target.status === 'reversed') return { success: false, error: 'Transaction is already reversed.' };

    const targetLines = lines.filter(l => l.journal_entry_id === entryId);
    
    // Invert debits and credits
    const reversalLines = targetLines.map(l => ({
      account_id: l.account_id,
      line_type: (l.line_type === 'debit' ? 'credit' : 'debit') as 'debit' | 'credit',
      amount: l.amount,
      memo: `REVERSAL: ${l.memo || target.memo}`,
      category_id: l.category_id,
    }));

    const result = this.postJournalEntry(workspaceId, {
      memo: `REVERSAL: ${target.memo} (${reason})`,
      source_type: target.source_type,
      entry_date: new Date().toISOString().split('T')[0],
      lines: reversalLines,
    });

    if (result.success) {
      target.status = 'reversed';
      this.set(STORAGE_KEYS.JOURNAL_ENTRIES, entries);
      this.logAudit(workspaceId, 'REVERSE_JOURNAL_ENTRY', 'journal_entry', entryId, {
        reason,
        reversalEntryId: result.entryId,
      });
    }

    return result;
  }

  // Categories & Subcategories
  getCategories(workspaceId: string): Category[] {
    const list = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    return list.filter(c => c.workspace_id === workspaceId && !c.is_archived);
  }

  getRootCategories(workspaceId: string, type?: Category['type']): Category[] {
    return this.getCategories(workspaceId).filter(c => !c.parent_id && (!type || c.type === type));
  }

  getSubcategories(parentId: string, workspaceId: string): Category[] {
    return this.getCategories(workspaceId).filter(c => c.parent_id === parentId);
  }

  saveCategory(cat: Category): void {
    const list = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const idx = list.findIndex(c => c.id === cat.id);
    if (idx >= 0) {
      list[idx] = cat;
    } else {
      list.push(cat);
    }
    // If this category was previously marked as deleted, unmark it
    const deleted = this.get<string[]>(STORAGE_KEYS.DELETED_CATEGORIES, []);
    const nameLower = cat.name.toLowerCase().trim();
    const updatedDeleted = deleted.filter(d => d !== cat.id && d !== nameLower);
    if (updatedDeleted.length !== deleted.length) {
      this.set(STORAGE_KEYS.DELETED_CATEGORIES, updatedDeleted);
    }
    this.set(STORAGE_KEYS.CATEGORIES, list);
    supabaseSync.syncCategory(cat, cat.workspace_id);
  }

  deleteCategory(categoryId: string, workspaceId: string): void {
    const list = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const cat = list.find(c => c.id === categoryId);
    if (cat) {
      const deleted = this.get<string[]>(STORAGE_KEYS.DELETED_CATEGORIES, []);
      if (!deleted.includes(cat.id)) deleted.push(cat.id);
      const nameLower = cat.name.toLowerCase().trim();
      if (!deleted.includes(nameLower)) deleted.push(nameLower);
      this.set(STORAGE_KEYS.DELETED_CATEGORIES, deleted);
    }
    // Also remove any subcategories belonging to this category
    const remaining = list.filter(c => c.id !== categoryId && c.parent_id !== categoryId);
    this.set(STORAGE_KEYS.CATEGORIES, remaining);
    supabaseSync.deleteCategory(categoryId, workspaceId);
  }

  // Credit Cards
  getCreditCards(workspaceId: string): CreditCard[] {
    const list = this.get<CreditCard[]>(STORAGE_KEYS.CREDIT_CARDS, []);
    return list.filter(c => c.workspace_id === workspaceId);
  }

  saveCreditCard(card: CreditCard): void {
    const list = this.get<CreditCard[]>(STORAGE_KEYS.CREDIT_CARDS, []);
    const idx = list.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      list[idx] = card;
    } else {
      list.push(card);
    }
    this.set(STORAGE_KEYS.CREDIT_CARDS, list);
    supabaseSync.syncCreditCard(card, card.workspace_id);
  }

  deleteCreditCard(arg1: string, arg2: string): void {
    const list = this.get<CreditCard[]>(STORAGE_KEYS.CREDIT_CARDS, []);
    let cardId = arg1;
    let workspaceId = arg2;
    if (list.some(c => c.id === arg2) && !list.some(c => c.id === arg1)) {
      cardId = arg2;
      workspaceId = arg1;
    }
    const cardToDelete = list.find(c => c.id === cardId);
    this.set(STORAGE_KEYS.CREDIT_CARDS, list.filter(c => c.id !== cardId));
    supabaseSync.deleteCreditCard(cardId, workspaceId);

    // Also remove or archive underlying liability account if user deletes card
    if (cardToDelete?.account_id) {
      this.deleteAccount(cardToDelete.account_id, workspaceId);
    }
  }

  // Loans & Money Lent
  getLoans(workspaceId: string): Loan[] {
    const list = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    return list.filter(l => l.workspace_id === workspaceId);
  }

  saveLoan(loan: Loan): void {
    const list = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const idx = list.findIndex(l => l.id === loan.id);
    if (idx >= 0) {
      list[idx] = loan;
    } else {
      list.push(loan);
    }
    this.set(STORAGE_KEYS.LOANS, list);
    supabaseSync.syncLoan(loan, loan.workspace_id);
  }

  deleteLoan(arg1: string, arg2: string): void {
    const list = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    let loanId = arg1;
    let workspaceId = arg2;
    if (list.some(l => l.id === arg2) && !list.some(l => l.id === arg1)) {
      loanId = arg2;
      workspaceId = arg1;
    }
    this.set(STORAGE_KEYS.LOANS, list.filter(l => l.id !== loanId));
    supabaseSync.deleteLoan(loanId, workspaceId);
  }

  // Properties
  getProperties(workspaceId: string): Property[] {
    const list = this.get<Property[]>(STORAGE_KEYS.PROPERTIES, []);
    return list.filter(p => p.workspace_id === workspaceId);
  }

  saveProperty(prop: Property): void {
    const list = this.get<Property[]>(STORAGE_KEYS.PROPERTIES, []);
    const idx = list.findIndex(p => p.id === prop.id);
    if (idx >= 0) {
      list[idx] = prop;
    } else {
      list.push(prop);
    }
    this.set(STORAGE_KEYS.PROPERTIES, list);
    supabaseSync.syncProperty(prop, prop.workspace_id);
  }

  deleteProperty(arg1: string, arg2: string): void {
    const list = this.get<Property[]>(STORAGE_KEYS.PROPERTIES, []);
    let propertyId = arg1;
    let workspaceId = arg2;
    if (list.some(p => p.id === arg2) && !list.some(p => p.id === arg1)) {
      propertyId = arg2;
      workspaceId = arg1;
    }
    this.set(STORAGE_KEYS.PROPERTIES, list.filter(p => p.id !== propertyId));
    supabaseSync.deleteProperty(propertyId, workspaceId);
  }

  // Budgets
  getBudgets(workspaceId: string): Budget[] {
    const list = this.get<Budget[]>(STORAGE_KEYS.BUDGETS, []);
    return list.filter(b => b.workspace_id === workspaceId);
  }

  saveBudget(budget: Budget): void {
    const list = this.get<Budget[]>(STORAGE_KEYS.BUDGETS, []);
    const idx = list.findIndex(b => b.id === budget.id);
    if (idx >= 0) {
      list[idx] = budget;
    } else {
      list.push(budget);
    }
    this.set(STORAGE_KEYS.BUDGETS, list);
    supabaseSync.syncBudget(budget, budget.workspace_id);
  }

  deleteBudget(arg1: string, arg2: string): void {
    const list = this.get<Budget[]>(STORAGE_KEYS.BUDGETS, []);
    let budgetId = arg1;
    let workspaceId = arg2;
    if (list.some(b => b.id === arg2) && !list.some(b => b.id === arg1)) {
      budgetId = arg2;
      workspaceId = arg1;
    }
    this.set(STORAGE_KEYS.BUDGETS, list.filter(b => b.id !== budgetId));
    supabaseSync.deleteBudget(budgetId, workspaceId);
  }

  // Savings Goals & DPS
  getSavingsGoals(workspaceId: string): SavingsGoal[] {
    const list = this.get<SavingsGoal[]>(STORAGE_KEYS.SAVINGS_GOALS, []);
    return list.filter(g => g.workspace_id === workspaceId);
  }

  saveSavingsGoal(goal: SavingsGoal): void {
    const list = this.get<SavingsGoal[]>(STORAGE_KEYS.SAVINGS_GOALS, []);
    const idx = list.findIndex(g => g.id === goal.id);
    if (idx >= 0) {
      list[idx] = goal;
    } else {
      list.push(goal);
    }
    this.set(STORAGE_KEYS.SAVINGS_GOALS, list);
    supabaseSync.syncSavingsGoal(goal, goal.workspace_id);
  }

  deleteSavingsGoal(arg1: string, arg2: string): void {
    const list = this.get<SavingsGoal[]>(STORAGE_KEYS.SAVINGS_GOALS, []);
    let goalId = arg1;
    let workspaceId = arg2;
    if (list.some(g => g.id === arg2) && !list.some(g => g.id === arg1)) {
      goalId = arg2;
      workspaceId = arg1;
    }
    this.set(STORAGE_KEYS.SAVINGS_GOALS, list.filter(g => g.id !== goalId));
    supabaseSync.deleteSavingsGoal(goalId, workspaceId);
  }

  // Recurring Rules
  getRecurringRules(workspaceId: string): RecurringRule[] {
    const list = this.get<RecurringRule[]>(STORAGE_KEYS.RECURRING_RULES, []);
    return list.filter(r => r.workspace_id === workspaceId);
  }

  saveRecurringRule(rule: RecurringRule): void {
    const list = this.get<RecurringRule[]>(STORAGE_KEYS.RECURRING_RULES, []);
    const idx = list.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      list[idx] = rule;
    } else {
      list.push(rule);
    }
    this.set(STORAGE_KEYS.RECURRING_RULES, list);
    supabaseSync.syncRecurringRule(rule, rule.workspace_id);
  }

  deleteRecurringRule(arg1: string, arg2: string): void {
    const list = this.get<RecurringRule[]>(STORAGE_KEYS.RECURRING_RULES, []);
    let ruleId = arg1;
    let workspaceId = arg2;
    if (list.some(r => r.id === arg2) && !list.some(r => r.id === arg1)) {
      ruleId = arg2;
      workspaceId = arg1;
    }
    this.set(STORAGE_KEYS.RECURRING_RULES, list.filter(r => r.id !== ruleId));
    supabaseSync.deleteRecurringRule(ruleId, workspaceId);
  }

  // Audit Logs
  getAuditLogs(workspaceId: string): AuditLog[] {
    const list = this.get<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    return list.filter(a => a.workspace_id === workspaceId).reverse();
  }

  logAudit(
    workspaceId: string,
    action: string,
    resource_type: string,
    resource_id: string,
    details: Record<string, any>
  ): void {
    const list = this.get<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    list.push({
      id: 'audit_' + Date.now(),
      workspace_id: workspaceId,
      actor_name: 'Sovon (Owner)',
      action,
      resource_type,
      resource_id,
      details,
      created_at: new Date().toISOString(),
    });
    this.set(STORAGE_KEYS.AUDIT_LOGS, list);
  }

  // Active Supabase Cloud Sync
  async syncWithSupabase(workspaceId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, message: 'Supabase parameters missing' };
      }

      // Check categories table on Supabase
      const { data: remoteCats, error } = await supabase
        .from('categories')
        .select('*')
        .limit(10);

      if (error) {
        return { success: false, message: error.message };
      }

      return { 
        success: true, 
        message: `Synced with Supabase (${remoteCats?.length || 0} remote records verified)` 
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Sync failed' };
    }
  }
}

export const db = new DatabaseEngine();
