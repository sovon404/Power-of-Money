import { 
  Workspace, 
  FinancialAccount, 
  JournalEntry, 
  JournalLine, 
  Category, 
  CreditCard, 
  Loan, 
  Property, 
  Budget, 
  SavingsGoal, 
  RecurringRule, 
  AuditLog,
  IncomeTypeItem 
} from '../types';
import { supabaseSync, DeleteResult } from './supabaseSync';
import { toUuid, generateUuid } from '../lib/uuid';

// Legacy keys to purge completely to eliminate device-specific state & cache leaks
const LEGACY_STORAGE_KEYS = [
  'pom_financial_accounts',
  'pom_journal_entries',
  'pom_journal_lines',
  'pom_categories',
  'pom_credit_cards',
  'pom_card_statements',
  'pom_loans',
  'pom_properties',
  'pom_property_valuations',
  'pom_property_recoveries',
  'pom_budgets',
  'pom_savings_goals',
  'pom_recurring_rules',
  'pom_audit_logs',
  'pom_deleted_accounts',
  'pom_deleted_categories',
  'pom_deleted_cards',
  'pom_deleted_loans',
  'pom_deleted_properties',
  'pom_deleted_budgets',
  'pom_deleted_goals',
  'pom_deleted_rules',
  'pom_deleted_entries',
  'pom_workspaces',
  'pom_workspace_members'
];

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
  { name: 'Salary', type: 'income', income_type: 'salary', accounting_classification: 'income_operating', icon: 'briefcase', color: '#10b981' },
  { name: 'Allowances & Bonus', type: 'income', income_type: 'salary', accounting_classification: 'income_operating', icon: 'award', color: '#059669' },
  { name: 'Business / Freelance', type: 'income', income_type: 'remote_freelance', accounting_classification: 'income_operating', icon: 'laptop', color: '#0284c7' },
  { name: 'Remote Work Contracts', type: 'income', income_type: 'remote_freelance', accounting_classification: 'income_operating', icon: 'globe', color: '#38bdf8' },
  { name: 'Land Mortgage & Lease', type: 'income', income_type: 'land_mortgage', accounting_classification: 'income_operating', icon: 'building', color: '#d97706' },
  { name: 'Rental Income', type: 'income', income_type: 'land_mortgage', accounting_classification: 'income_operating', icon: 'home', color: '#f59e0b' },
  { name: 'Investment Returns', type: 'income', income_type: 'investment', accounting_classification: 'income_operating', icon: 'trending-up', color: '#0d9488' },
  { name: 'Other Income', type: 'income', income_type: 'other', accounting_classification: 'income_operating', icon: 'plus-circle', color: '#14b8a6' },
];

export interface InMemoryStore {
  workspaces: Workspace[];
  accounts: FinancialAccount[];
  categories: Category[];
  entries: JournalEntry[];
  lines: JournalLine[];
  cards: CreditCard[];
  loans: Loan[];
  properties: Property[];
  budgets: Budget[];
  goals: SavingsGoal[];
  rules: RecurringRule[];
  auditLogs: AuditLog[];
}

class CentralizedDatabaseEngine {
  // Pure In-Memory State: Never persisted to localStorage/sessionStorage/IndexedDB
  private store: InMemoryStore = {
    workspaces: [],
    accounts: [],
    categories: [],
    entries: [],
    lines: [],
    cards: [],
    loans: [],
    properties: [],
    budgets: [],
    goals: [],
    rules: [],
    auditLogs: [],
  };

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.purgeLegacyDeviceStorage();
  }

  // Purge any old localStorage financial data to prevent cross-device or stale cache leakage
  private purgeLegacyDeviceStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      LEGACY_STORAGE_KEYS.forEach(k => {
        try {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        } catch {}
      });
      // Purge any income types stored locally
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('pom_income_types_') || key.startsWith('pom_seeded_workspace_'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Storage purge notice:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  // ==========================================
  // Remote Hydration from Supabase (Source of Truth)
  // ==========================================
  public hydrateFromRemote(data: {
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
    if (data.accounts !== undefined) {
      const other = this.store.accounts.filter(a => a.workspace_id !== workspaceId);
      this.store.accounts = [...other, ...data.accounts];
    }

    if (data.categories !== undefined) {
      const other = this.store.categories.filter(c => c.workspace_id !== workspaceId);
      this.store.categories = [...other, ...data.categories];
    }

    if (data.cards !== undefined) {
      const other = this.store.cards.filter(c => c.workspace_id !== workspaceId);
      this.store.cards = [...other, ...data.cards];
    }

    if (data.loans !== undefined) {
      const other = this.store.loans.filter(l => l.workspace_id !== workspaceId);
      this.store.loans = [...other, ...data.loans];
    }

    if (data.properties !== undefined) {
      const other = this.store.properties.filter(p => p.workspace_id !== workspaceId);
      this.store.properties = [...other, ...data.properties];
    }

    if (data.budgets !== undefined) {
      const other = this.store.budgets.filter(b => b.workspace_id !== workspaceId);
      this.store.budgets = [...other, ...data.budgets];
    }

    if (data.goals !== undefined) {
      const other = this.store.goals.filter(g => g.workspace_id !== workspaceId);
      this.store.goals = [...other, ...data.goals];
    }

    if (data.rules !== undefined) {
      const other = this.store.rules.filter(r => r.workspace_id !== workspaceId);
      this.store.rules = [...other, ...data.rules];
    }

    if (data.entries !== undefined) {
      const otherEntries = this.store.entries.filter(e => e.workspace_id !== workspaceId);
      const otherLines = this.store.lines.filter(l => l.workspace_id !== workspaceId);
      const newLines: JournalLine[] = [];

      data.entries.forEach(e => {
        if ((e as any).lines && Array.isArray((e as any).lines)) {
          newLines.push(...(e as any).lines);
        }
      });

      this.store.entries = [...otherEntries, ...data.entries];
      this.store.lines = [...otherLines, ...newLines];
    }

    this.notify();
  }

  // Workspaces
  getWorkspaces(userId?: string): Workspace[] {
    if (!userId) return this.store.workspaces;
    return this.store.workspaces.filter(w => w.created_by === userId);
  }

  async saveWorkspace(ws: Workspace): Promise<void> {
    const idx = this.store.workspaces.findIndex(w => w.id === ws.id);
    if (idx >= 0) {
      this.store.workspaces[idx] = ws;
    } else {
      this.store.workspaces.push(ws);
    }
    if (ws.created_by) {
      await supabaseSync.syncWorkspace(ws, ws.created_by);
    }
    this.notify();
  }

  initializeUserWorkspace(userId: string, userName?: string, userEmail?: string): { workspace: Workspace; isNew: boolean } {
    const wsUuid = toUuid(`ws_${userId}`);
    const existing = this.store.workspaces.find(w => w.id === wsUuid || w.created_by === userId);
    if (existing) {
      return { workspace: existing, isNew: false };
    }

    const newWs: Workspace = {
      id: wsUuid,
      name: `${userName || 'My'}'s Vault`,
      type: 'personal',
      created_by: userId,
      currency: 'BDT',
      description: `Primary personal financial vault for ${userEmail || userName || userId}`,
      created_at: new Date().toISOString(),
    };
    this.store.workspaces.push(newWs);
    return { workspace: newWs, isNew: true };
  }

  // ==========================================
  // Financial Accounts with Live Ledger Calculations
  // ==========================================
  getAccounts(workspaceId: string): FinancialAccount[] {
    const list = this.store.accounts.filter(a => a.workspace_id === workspaceId);
    const lines = this.store.lines.filter(l => l.workspace_id === workspaceId);
    const entries = this.store.entries.filter(e => e.workspace_id === workspaceId);

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
        calculatedBalance = hasLines ? (c - d) : (Number(a.opening_balance) || Number(a.current_balance_cached) || 0);
      }

      return {
        ...a,
        current_balance_cached: Math.round(calculatedBalance * 100) / 100,
      };
    });
  }

  async saveAccount(account: FinancialAccount): Promise<FinancialAccount> {
    const saved = await supabaseSync.syncAccount(account, account.workspace_id);
    const idx = this.store.accounts.findIndex(a => a.id === saved.id);
    if (idx >= 0) {
      this.store.accounts[idx] = saved;
    } else {
      this.store.accounts.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteAccount(arg1: string, arg2: string): Promise<DeleteResult> {
    const list = this.store.accounts;
    let accountId = arg1;
    let workspaceId = arg2;
    if (list.some(a => a.id === arg2) && !list.some(a => a.id === arg1)) {
      accountId = arg2;
      workspaceId = arg1;
    }

    const result = await supabaseSync.deleteAccount(accountId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete account');
    }

    if (result.action === 'archived') {
      const acc = this.store.accounts.find(a => a.id === accountId);
      if (acc) acc.is_archived = true;
    } else {
      this.store.accounts = this.store.accounts.filter(a => a.id !== accountId);
    }

    this.notify();
    return result;
  }

  // ==========================================
  // Journal Entries & Double-Entry Posting
  // ==========================================
  getJournalEntries(workspaceId: string): JournalEntry[] {
    const entries = this.store.entries.filter(e => e.workspace_id === workspaceId);
    const lines = this.store.lines.filter(l => l.workspace_id === workspaceId);

    return entries
      .map(e => ({
        ...e,
        lines: lines.filter(l => l.journal_entry_id === e.id),
      }))
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }

  async postJournalEntry(
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
  ): Promise<{ success: boolean; entryId?: string; error?: string }> {
    const totalDebit = params.lines
      .filter(l => l.line_type === 'debit')
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCredit = params.lines
      .filter(l => l.line_type === 'credit')
      .reduce((sum, l) => sum + Number(l.amount), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return {
        success: false,
        error: `Unbalanced journal entry rejected. Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)}).`,
      };
    }

    if (totalDebit <= 0) {
      return { success: false, error: 'Amounts must be strictly greater than zero.' };
    }

    const entryId = generateUuid();
    const newEntry: JournalEntry = {
      id: entryId,
      workspace_id: workspaceId,
      entry_number: this.store.entries.length + 1,
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

    // Authoritative persist to Supabase
    await supabaseSync.syncJournalEntry({ ...newEntry, lines: newLines }, workspaceId);

    // Update in-memory state
    this.store.entries.unshift(newEntry);
    this.store.lines.push(...newLines);

    // Update account balances atomically in memory
    for (const line of newLines) {
      const acc = this.store.accounts.find(a => a.id === line.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const change = line.line_type === 'debit' ? line.amount : -line.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + change
          : acc.current_balance_cached - change;
      }
    }

    this.notify();
    return { success: true, entryId };
  }

  async updateJournalEntry(
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
  ): Promise<{ success: boolean; error?: string }> {
    const totalDebit = params.lines
      .filter(l => l.line_type === 'debit')
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCredit = params.lines
      .filter(l => l.line_type === 'credit')
      .reduce((sum, l) => sum + Number(l.amount), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return { success: false, error: 'Unbalanced journal entry rejected. Debits must equal credits.' };
    }

    const existingEntryIndex = this.store.entries.findIndex(e => e.id === entryId);
    if (existingEntryIndex === -1) {
      return { success: false, error: 'Transaction not found.' };
    }

    const existingEntry = this.store.entries[existingEntryIndex];
    const previousLines = this.store.lines.filter(l => l.journal_entry_id === entryId);

    // Rollback previous line effects
    for (const line of previousLines) {
      const acc = this.store.accounts.find(a => a.id === line.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const rollback = line.line_type === 'debit' ? -line.amount : line.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + rollback
          : acc.current_balance_cached - rollback;
      }
    }

    const defaultOperatingAccId = toUuid(`acc_expense_operating_${workspaceId}`);
    const updatedLines: JournalLine[] = params.lines.map((l, i) => ({
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

    // Apply new line effects
    for (const line of updatedLines) {
      const acc = this.store.accounts.find(a => a.id === line.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const change = line.line_type === 'debit' ? line.amount : -line.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + change
          : acc.current_balance_cached - change;
      }
    }

    const updatedEntry: JournalEntry = {
      ...existingEntry,
      memo: params.memo,
      entry_date: params.entry_date,
      period_end_date: params.period_end_date !== undefined ? (params.period_end_date || undefined) : existingEntry.period_end_date,
      is_historical: params.is_historical !== undefined ? Boolean(params.is_historical) : existingEntry.is_historical,
      historical_note: params.historical_note !== undefined ? params.historical_note : existingEntry.historical_note,
      lines: updatedLines,
    };

    // Authoritative persist to Supabase
    await supabaseSync.syncJournalEntry(updatedEntry, workspaceId);

    this.store.entries[existingEntryIndex] = updatedEntry;
    this.store.lines = this.store.lines.filter(l => l.journal_entry_id !== entryId).concat(updatedLines);
    this.notify();
    return { success: true };
  }

  async deleteJournalEntry(arg1: string, arg2: string): Promise<DeleteResult> {
    let workspaceId = arg1;
    let entryId = arg2;
    if (this.store.entries.some(e => e.id === arg1) && !this.store.entries.some(e => e.id === arg2)) {
      entryId = arg1;
      workspaceId = arg2;
    }

    const entryToDelete = this.store.entries.find(e => e.id === entryId);
    if (!entryToDelete) {
      return { success: false, error: 'Transaction not found.' };
    }

    const result = await supabaseSync.deleteJournalEntry(entryId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete transaction from database');
    }

    // Revert balance in memory
    const linesToDelete = this.store.lines.filter(l => l.journal_entry_id === entryId);
    for (const line of linesToDelete) {
      const acc = this.store.accounts.find(a => a.id === line.account_id);
      if (acc) {
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable', 'property_asset', 'expense_operating', 'expense_finance'].includes(acc.account_type_id);
        const change = line.line_type === 'debit' ? -line.amount : line.amount;
        acc.current_balance_cached = isDebitNormal
          ? acc.current_balance_cached + change
          : acc.current_balance_cached - change;
      }
    }

    this.store.entries = this.store.entries.filter(e => e.id !== entryId);
    this.store.lines = this.store.lines.filter(l => l.journal_entry_id !== entryId);
    this.notify();
    return result;
  }

  async postTransfer(
    workspaceId: string,
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    date: string,
    memo: string,
    periodEndDate?: string
  ): Promise<{ success: boolean; error?: string }> {
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

  async postReversal(
    workspaceId: string,
    entryId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const target = this.store.entries.find(e => e.id === entryId);
    if (!target) return { success: false, error: 'Transaction not found.' };
    if (target.status === 'reversed') return { success: false, error: 'Transaction is already reversed.' };

    const targetLines = this.store.lines.filter(l => l.journal_entry_id === entryId);
    const reversalLines = targetLines.map(l => ({
      account_id: l.account_id,
      line_type: (l.line_type === 'debit' ? 'credit' : 'debit') as 'debit' | 'credit',
      amount: l.amount,
      memo: `REVERSAL: ${l.memo || target.memo}`,
      category_id: l.category_id,
    }));

    const result = await this.postJournalEntry(workspaceId, {
      memo: `REVERSAL: ${target.memo} (${reason})`,
      source_type: target.source_type,
      entry_date: new Date().toISOString().split('T')[0],
      lines: reversalLines,
    });

    if (result.success) {
      target.status = 'reversed';
      this.notify();
    }

    return result;
  }

  // ==========================================
  // Categories & Subcategories
  // ==========================================
  getCategories(workspaceId: string): Category[] {
    return this.store.categories
      .filter(c => c.workspace_id === workspaceId && !c.is_archived)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  getRootCategories(workspaceId: string, type?: Category['type']): Category[] {
    return this.getCategories(workspaceId).filter(c => !c.parent_id && (!type || c.type === type));
  }

  getSubcategories(parentId: string, workspaceId: string): Category[] {
    return this.getCategories(workspaceId).filter(c => c.parent_id === parentId);
  }

  async saveCategory(cat: Category): Promise<Category> {
    const saved = await supabaseSync.syncCategory(cat, cat.workspace_id);
    const idx = this.store.categories.findIndex(c => c.id === saved.id);
    if (idx >= 0) {
      this.store.categories[idx] = saved;
    } else {
      this.store.categories.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteCategory(categoryId: string, workspaceId: string): Promise<DeleteResult> {
    const result = await supabaseSync.deleteCategory(categoryId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete category from database');
    }

    // Remove category and child subcategories from in-memory store
    this.store.categories = this.store.categories.filter(c => c.id !== categoryId && c.parent_id !== categoryId);
    this.notify();
    return result;
  }

  // ==========================================
  // Credit Cards
  // ==========================================
  getCreditCards(workspaceId: string): CreditCard[] {
    return this.store.cards.filter(c => c.workspace_id === workspaceId);
  }

  async saveCreditCard(card: CreditCard): Promise<CreditCard> {
    const saved = await supabaseSync.syncCreditCard(card, card.workspace_id);
    const idx = this.store.cards.findIndex(c => c.id === saved.id);
    if (idx >= 0) {
      this.store.cards[idx] = saved;
    } else {
      this.store.cards.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteCreditCard(arg1: string, arg2: string): Promise<DeleteResult> {
    let cardId = arg1;
    let workspaceId = arg2;
    if (this.store.cards.some(c => c.id === arg2) && !this.store.cards.some(c => c.id === arg1)) {
      cardId = arg2;
      workspaceId = arg1;
    }

    const card = this.store.cards.find(c => c.id === cardId);
    const result = await supabaseSync.deleteCreditCard(cardId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete credit card');
    }

    this.store.cards = this.store.cards.filter(c => c.id !== cardId);

    // If underlying account has no transactions, archive or delete it
    if (card?.account_id) {
      try {
        await this.deleteAccount(card.account_id, workspaceId);
      } catch {}
    }

    this.notify();
    return result;
  }

  // ==========================================
  // Loans
  // ==========================================
  getLoans(workspaceId: string): Loan[] {
    return this.store.loans.filter(l => l.workspace_id === workspaceId);
  }

  async saveLoan(loan: Loan): Promise<Loan> {
    const saved = await supabaseSync.syncLoan(loan, loan.workspace_id);
    const idx = this.store.loans.findIndex(l => l.id === saved.id);
    if (idx >= 0) {
      this.store.loans[idx] = saved;
    } else {
      this.store.loans.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteLoan(arg1: string, arg2: string): Promise<DeleteResult> {
    let loanId = arg1;
    let workspaceId = arg2;
    if (this.store.loans.some(l => l.id === arg2) && !this.store.loans.some(l => l.id === arg1)) {
      loanId = arg2;
      workspaceId = arg1;
    }

    const result = await supabaseSync.deleteLoan(loanId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete loan');
    }

    this.store.loans = this.store.loans.filter(l => l.id !== loanId);
    this.notify();
    return result;
  }

  // ==========================================
  // Properties
  // ==========================================
  getProperties(workspaceId: string): Property[] {
    return this.store.properties.filter(p => p.workspace_id === workspaceId);
  }

  async saveProperty(prop: Property): Promise<Property> {
    const saved = await supabaseSync.syncProperty(prop, prop.workspace_id);
    const idx = this.store.properties.findIndex(p => p.id === saved.id);
    if (idx >= 0) {
      this.store.properties[idx] = saved;
    } else {
      this.store.properties.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteProperty(arg1: string, arg2: string): Promise<DeleteResult> {
    let propertyId = arg1;
    let workspaceId = arg2;
    if (this.store.properties.some(p => p.id === arg2) && !this.store.properties.some(p => p.id === arg1)) {
      propertyId = arg2;
      workspaceId = arg1;
    }

    const result = await supabaseSync.deleteProperty(propertyId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete property');
    }

    this.store.properties = this.store.properties.filter(p => p.id !== propertyId);
    this.notify();
    return result;
  }

  // ==========================================
  // Budgets
  // ==========================================
  getBudgets(workspaceId: string): Budget[] {
    return this.store.budgets.filter(b => b.workspace_id === workspaceId);
  }

  async saveBudget(budget: Budget): Promise<Budget> {
    const saved = await supabaseSync.syncBudget(budget, budget.workspace_id);
    const idx = this.store.budgets.findIndex(b => b.id === saved.id);
    if (idx >= 0) {
      this.store.budgets[idx] = saved;
    } else {
      this.store.budgets.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteBudget(arg1: string, arg2: string): Promise<DeleteResult> {
    let budgetId = arg1;
    let workspaceId = arg2;
    if (this.store.budgets.some(b => b.id === arg2) && !this.store.budgets.some(b => b.id === arg1)) {
      budgetId = arg2;
      workspaceId = arg1;
    }

    const result = await supabaseSync.deleteBudget(budgetId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete budget');
    }

    this.store.budgets = this.store.budgets.filter(b => b.id !== budgetId);
    this.notify();
    return result;
  }

  // ==========================================
  // Savings Goals
  // ==========================================
  getSavingsGoals(workspaceId: string): SavingsGoal[] {
    return this.store.goals.filter(g => g.workspace_id === workspaceId);
  }

  async saveSavingsGoal(goal: SavingsGoal): Promise<SavingsGoal> {
    const saved = await supabaseSync.syncSavingsGoal(goal, goal.workspace_id);
    const idx = this.store.goals.findIndex(g => g.id === saved.id);
    if (idx >= 0) {
      this.store.goals[idx] = saved;
    } else {
      this.store.goals.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteSavingsGoal(arg1: string, arg2: string): Promise<DeleteResult> {
    let goalId = arg1;
    let workspaceId = arg2;
    if (this.store.goals.some(g => g.id === arg2) && !this.store.goals.some(g => g.id === arg1)) {
      goalId = arg2;
      workspaceId = arg1;
    }

    const result = await supabaseSync.deleteSavingsGoal(goalId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete savings goal');
    }

    this.store.goals = this.store.goals.filter(g => g.id !== goalId);
    this.notify();
    return result;
  }

  // ==========================================
  // Recurring Rules
  // ==========================================
  getRecurringRules(workspaceId: string): RecurringRule[] {
    return this.store.rules.filter(r => r.workspace_id === workspaceId);
  }

  async saveRecurringRule(rule: RecurringRule): Promise<RecurringRule> {
    const saved = await supabaseSync.syncRecurringRule(rule, rule.workspace_id);
    const idx = this.store.rules.findIndex(r => r.id === saved.id);
    if (idx >= 0) {
      this.store.rules[idx] = saved;
    } else {
      this.store.rules.push(saved);
    }
    this.notify();
    return saved;
  }

  async deleteRecurringRule(arg1: string, arg2: string): Promise<DeleteResult> {
    let ruleId = arg1;
    let workspaceId = arg2;
    if (this.store.rules.some(r => r.id === arg2) && !this.store.rules.some(r => r.id === arg1)) {
      ruleId = arg2;
      workspaceId = arg1;
    }

    const result = await supabaseSync.deleteRecurringRule(ruleId, workspaceId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete recurring rule');
    }

    this.store.rules = this.store.rules.filter(r => r.id !== ruleId);
    this.notify();
    return result;
  }

  // ==========================================
  // Income Types & Category Initialization
  // ==========================================
  private customIncomeTypes: Record<string, IncomeTypeItem[]> = {};

  getIncomeTypes(workspaceId: string): IncomeTypeItem[] {
    if (this.customIncomeTypes[workspaceId]) {
      return this.customIncomeTypes[workspaceId];
    }
    return [
      { id: 'salary', name: 'Salary / Employment', description: 'Monthly wages, official pay, bonuses', color: '#10b981', icon: 'briefcase' },
      { id: 'remote_freelance', name: 'Remote / Freelancing', description: 'Tech contracts, software freelancing, remittance', color: '#0284c7', icon: 'laptop' },
      { id: 'land_mortgage', name: 'Land Mortgage & Rent', description: 'Land mortgage yields, plot lease, tenant rent', color: '#d97706', icon: 'building' },
      { id: 'business', name: 'Business & Trade', description: 'Commercial enterprise, trading, products', color: '#8b5cf6', icon: 'globe' },
      { id: 'investment', name: 'Investment Returns', description: 'DPS profits, dividends, capital gains', color: '#0d9488', icon: 'trending-up' },
      { id: 'other', name: 'Other Inflows', description: 'Gifts, one-off receipts, allowances', color: '#64748b', icon: 'plus-circle' },
    ];
  }

  saveIncomeTypes(workspaceId: string, types: IncomeTypeItem[]): void {
    this.customIncomeTypes[workspaceId] = types;
    this.notify();
  }

  async ensureCategoriesForWorkspace(workspaceId: string): Promise<void> {
    const existing = this.getCategories(workspaceId);
    if (existing.length === 0) {
      await this.seedInitialWorkspaceDefaults(workspaceId);
    }
  }

  // ==========================================
  // Initial Workspace Seeding directly to Supabase
  // ==========================================
  async seedInitialWorkspaceDefaults(workspaceId: string): Promise<void> {
    const existingAccounts = this.getAccounts(workspaceId);
    if (existingAccounts.length === 0) {
      const defaultAccounts = [
        { name: 'Cash In Hand', type: 'cash', provider: 'Cash', icon: 'banknote', color: '#10b981' },
        { name: 'Cash In Bank / Online', type: 'bank', provider: 'Bank', icon: 'landmark', color: '#0284c7' },
        { name: 'bKash Wallet', type: 'mfs', provider: 'bKash', icon: 'smartphone', color: '#e11d48' },
        { name: 'Nagad Wallet', type: 'mfs', provider: 'Nagad', icon: 'smartphone', color: '#ea580c' },
        { name: 'DSPF (BAF)', type: 'savings_dps', provider: 'BAF / DSPF', icon: 'piggy-bank', color: '#0d9488' },
        { name: 'Unity Fund-2026', type: 'savings_dps', provider: 'Unity Fund', icon: 'flag', color: '#eab308' },
        { name: 'Earned Revenue & Income', type: 'income_salary', provider: 'Revenue', icon: 'trending-up', color: '#10b981' },
        { name: 'General Operating Expenses', type: 'expense_operating', provider: 'Operating', icon: 'receipt', color: '#ef4444' },
      ];

      for (const d of defaultAccounts) {
        const accUuid = toUuid(`acc_${d.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${workspaceId}`);
        await this.saveAccount({
          id: accUuid,
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
        });
      }
    }

    const existingCats = this.getCategories(workspaceId);
    if (existingCats.length === 0) {
      for (let i = 0; i < SEED_CATEGORIES_DATA.length; i++) {
        const c = SEED_CATEGORIES_DATA[i];
        const catUuid = toUuid(`cat_${workspaceId}_${c.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
        await this.saveCategory({
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
        });
      }
    }
  }
}

export const db = new CentralizedDatabaseEngine();
