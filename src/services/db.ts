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
};

// Seed Categories specified by user
export const SEED_CATEGORIES_DATA: Array<{
  name: string;
  type: 'income' | 'expense' | 'transfer_allocation';
  accounting_classification: any;
  icon: string;
  color: string;
}> = [
  { name: 'Home Expense', type: 'expense', accounting_classification: 'expense_operating', icon: 'home', color: '#0284c7' },
  { name: 'Loan Repayment', type: 'expense', accounting_classification: 'liability_reduction', icon: 'shield-alert', color: '#e11d48' },
  { name: 'Dps', type: 'transfer_allocation', accounting_classification: 'asset_transfer', icon: 'piggy-bank', color: '#16a34a' },
  { name: 'Friends Fund Installment', type: 'expense', accounting_classification: 'liability_reduction', icon: 'users', color: '#ca8a04' },
  { name: 'Medical (Family)', type: 'expense', accounting_classification: 'expense_operating', icon: 'heart-pulse', color: '#dc2626' },
  { name: 'Investment', type: 'transfer_allocation', accounting_classification: 'asset_transfer', icon: 'trending-up', color: '#059669' },
  { name: 'Pop-Up Expenses', type: 'expense', accounting_classification: 'expense_operating', icon: 'sparkles', color: '#ea580c' },
  { name: 'Megabite', type: 'expense', accounting_classification: 'expense_operating', icon: 'wifi', color: '#2563eb' },
  { name: 'Dsp (BAF)', type: 'transfer_allocation', accounting_classification: 'asset_transfer', icon: 'landmark', color: '#0d9488' },
  { name: 'Los Fund (Installment)', type: 'expense', accounting_classification: 'liability_reduction', icon: 'layers', color: '#9333ea' },
  { name: 'Non-Interest Loan Repayment', type: 'expense', accounting_classification: 'liability_reduction', icon: 'handshake', color: '#475569' },
  { name: 'Leave', type: 'expense', accounting_classification: 'expense_operating', icon: 'calendar', color: '#64748b' },
  { name: 'Wifi (Home)', type: 'expense', accounting_classification: 'expense_operating', icon: 'wifi', color: '#0284c7' },
  { name: 'Electricity (Home)', type: 'expense', accounting_classification: 'expense_operating', icon: 'zap', color: '#f59e0b' },
  { name: 'Personal (Food)', type: 'expense', accounting_classification: 'expense_operating', icon: 'utensils', color: '#f97316' },
  { name: 'Mess Bill', type: 'expense', accounting_classification: 'expense_operating', icon: 'coffee', color: '#d97706' },
  { name: 'Lend Money (To Others)', type: 'transfer_allocation', accounting_classification: 'receivable_outflow', icon: 'arrow-up-right', color: '#6366f1' },
  { name: 'Bank & Card Charge', type: 'expense', accounting_classification: 'expense_finance', icon: 'credit-card', color: '#ef4444' },
  { name: 'Lend Money Return', type: 'income', accounting_classification: 'income_operating', icon: 'arrow-down-left', color: '#10b981' },
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
  { name: 'Unity Fund-2026', type: 'expense', accounting_classification: 'liability_reduction', icon: 'flag', color: '#eab308' },
  { name: 'Protein Target', type: 'expense', accounting_classification: 'expense_operating', icon: 'activity', color: '#10b981' },
  { name: 'Adjustment', type: 'expense', accounting_classification: 'expense_operating', icon: 'sliders', color: '#64748b' },
  { name: 'FITA', type: 'expense', accounting_classification: 'expense_operating', icon: 'award', color: '#f59e0b' },
  // Core Income Categories
  { name: 'Salary', type: 'income', accounting_classification: 'income_operating', icon: 'briefcase', color: '#10b981' },
  { name: 'Allowances & Bonus', type: 'income', accounting_classification: 'income_operating', icon: 'award', color: '#059669' },
  { name: 'Business / Freelance', type: 'income', accounting_classification: 'income_operating', icon: 'laptop', color: '#047857' },
  { name: 'Rental Income', type: 'income', accounting_classification: 'income_operating', icon: 'building', color: '#065f46' },
  { name: 'Investment Returns', type: 'income', accounting_classification: 'income_operating', icon: 'trending-up', color: '#064e3b' },
  { name: 'Other Income', type: 'income', accounting_classification: 'income_operating', icon: 'plus-circle', color: '#14b8a6' },
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
  getWorkspaces(): Workspace[] {
    return this.get<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
  }

  saveWorkspace(ws: Workspace): void {
    const list = this.getWorkspaces();
    const idx = list.findIndex(w => w.id === ws.id);
    if (idx >= 0) {
      list[idx] = ws;
    } else {
      list.push(ws);
    }
    this.set(STORAGE_KEYS.WORKSPACES, list);
  }

  // Seed default workspace if empty
  initializeDefaultWorkspace(): { workspace: Workspace; isNew: boolean } {
    let workspaces = this.getWorkspaces();
    if (workspaces.length === 0) {
      const personalWs: Workspace = {
        id: 'ws_personal_' + Date.now(),
        name: 'My Personal Workspace',
        type: 'personal',
        created_by: 'user_owner',
        currency: 'BDT',
        description: 'Primary personal financial workspace with double-entry ledger.',
        created_at: new Date().toISOString(),
      };
      this.saveWorkspace(personalWs);

      // Seed categories for this workspace
      this.seedCategoriesForWorkspace(personalWs.id);

      // Seed default accounts
      this.seedDefaultAccounts(personalWs.id);

      return { workspace: personalWs, isNew: true };
    }
    return { workspace: workspaces[0], isNew: false };
  }

  seedCategoriesForWorkspace(workspaceId: string): void {
    const existing = this.getCategories(workspaceId);
    if (existing.length === 0) {
      const newCats: Category[] = SEED_CATEGORIES_DATA.map((c, i) => ({
        id: `cat_${workspaceId}_${i + 1}`,
        workspace_id: workspaceId,
        name: c.name,
        type: c.type,
        accounting_classification: c.accounting_classification,
        icon: c.icon,
        color: c.color,
        is_seed: true,
        is_archived: false,
        sort_order: i + 1,
      }));
      const allCats = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
      this.set(STORAGE_KEYS.CATEGORIES, [...allCats, ...newCats]);
    }
  }

  seedDefaultAccounts(workspaceId: string): void {
    const existing = this.getAccounts(workspaceId);
    if (existing.length === 0) {
      const initialAccounts: FinancialAccount[] = [
        {
          id: `acc_cash_${workspaceId}`,
          workspace_id: workspaceId,
          name: 'Cash in Hand',
          account_type_id: 'cash',
          provider: 'Cash',
          currency: 'BDT',
          opening_balance: 0,
          opening_date: new Date().toISOString().split('T')[0],
          current_balance_cached: 0,
          is_archived: false,
          icon: 'banknote',
          color: '#10b981',
          created_at: new Date().toISOString(),
        },
        {
          id: `acc_bkash_${workspaceId}`,
          workspace_id: workspaceId,
          name: 'bKash Wallet',
          account_type_id: 'mfs',
          provider: 'bKash',
          account_number_masked: '•••• 7597',
          currency: 'BDT',
          opening_balance: 0,
          opening_date: new Date().toISOString().split('T')[0],
          current_balance_cached: 0,
          is_archived: false,
          icon: 'smartphone',
          color: '#e11d48',
          created_at: new Date().toISOString(),
        },
        {
          id: `acc_nagad_${workspaceId}`,
          workspace_id: workspaceId,
          name: 'Nagad Wallet',
          account_type_id: 'mfs',
          provider: 'Nagad',
          account_number_masked: '•••• 3791',
          currency: 'BDT',
          opening_balance: 0,
          opening_date: new Date().toISOString().split('T')[0],
          current_balance_cached: 0,
          is_archived: false,
          icon: 'smartphone',
          color: '#f97316',
          created_at: new Date().toISOString(),
        },
        {
          id: `acc_bank_${workspaceId}`,
          workspace_id: workspaceId,
          name: 'BRAC Bank Checking',
          account_type_id: 'bank',
          provider: 'BRAC Bank',
          account_number_masked: '•••• 4108',
          currency: 'BDT',
          opening_balance: 0,
          opening_date: new Date().toISOString().split('T')[0],
          current_balance_cached: 0,
          is_archived: false,
          icon: 'landmark',
          color: '#0284c7',
          created_at: new Date().toISOString(),
        },
        {
          id: `acc_equity_${workspaceId}`,
          workspace_id: workspaceId,
          name: 'Opening Balance Equity',
          account_type_id: 'opening_equity',
          provider: 'System',
          currency: 'BDT',
          opening_balance: 0,
          opening_date: new Date().toISOString().split('T')[0],
          current_balance_cached: 0,
          is_archived: false,
          icon: 'scale',
          color: '#64748b',
          created_at: new Date().toISOString(),
        },
      ];
      const allAccs = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);
      this.set(STORAGE_KEYS.ACCOUNTS, [...allAccs, ...initialAccounts]);
    }
  }

  // Financial Accounts
  getAccounts(workspaceId: string): FinancialAccount[] {
    const list = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);
    return list.filter(a => a.workspace_id === workspaceId);
  }

  saveAccount(account: FinancialAccount): void {
    const list = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);
    const idx = list.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      list[idx] = account;
    } else {
      list.push(account);
    }
    this.set(STORAGE_KEYS.ACCOUNTS, list);
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

    const entryId = 'je_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const currentEntries = this.get<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    const currentLines = this.get<JournalLine[]>(STORAGE_KEYS.JOURNAL_LINES, []);
    const accounts = this.get<FinancialAccount[]>(STORAGE_KEYS.ACCOUNTS, []);

    const newEntry: JournalEntry = {
      id: entryId,
      workspace_id: workspaceId,
      entry_number: currentEntries.length + 1,
      entry_date: params.entry_date,
      memo: params.memo,
      source_type: params.source_type,
      source_id: params.source_id,
      status: 'posted',
      is_reversal: false,
      posted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const newLines: JournalLine[] = params.lines.map((l, i) => ({
      id: `jl_${entryId}_${i}`,
      journal_entry_id: entryId,
      workspace_id: workspaceId,
      account_id: l.account_id,
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
      }
    }

    this.set(STORAGE_KEYS.JOURNAL_ENTRIES, [newEntry, ...currentEntries]);
    this.set(STORAGE_KEYS.JOURNAL_LINES, [...currentLines, ...newLines]);
    this.set(STORAGE_KEYS.ACCOUNTS, accounts);

    this.logAudit(workspaceId, 'POST_JOURNAL_ENTRY', 'journal_entry', entryId, {
      memo: params.memo,
      amount: totalDebit,
      source_type: params.source_type,
    });

    return { success: true, entryId };
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
    memo: string
  ): { success: boolean; error?: string } {
    if (sourceAccountId === destinationAccountId) {
      return { success: false, error: 'Source and destination accounts must be different.' };
    }
    return this.postJournalEntry(workspaceId, {
      memo: memo || 'Account Transfer',
      source_type: 'transfer',
      entry_date: date,
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

  // Categories
  getCategories(workspaceId: string): Category[] {
    const list = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    return list.filter(c => c.workspace_id === workspaceId && !c.is_archived);
  }

  saveCategory(cat: Category): void {
    const list = this.get<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const idx = list.findIndex(c => c.id === cat.id);
    if (idx >= 0) {
      list[idx] = cat;
    } else {
      list.push(cat);
    }
    this.set(STORAGE_KEYS.CATEGORIES, list);
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
}

export const db = new DatabaseEngine();
