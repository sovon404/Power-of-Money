import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toUuid, generateUuid } from '../lib/uuid';
import { 
  Workspace, 
  FinancialAccount, 
  JournalEntry, 
  Category, 
  CreditCard, 
  Loan, 
  Property, 
  Budget, 
  SavingsGoal 
} from '../types';

class SupabaseSyncEngine {
  private isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  // 1. Sync User Profile
  async syncProfile(userId: string, email: string, fullName: string) {
    if (!this.isAvailable() || !userId) return;
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email: email || '',
        full_name: fullName || '',
        default_currency: 'BDT',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync profile error:', err);
    }
  }

  // 2. Sync Workspace & Membership (WITHOUT .select() to prevent RLS returning error)
  async syncWorkspace(workspace: Workspace, userId: string) {
    if (!this.isAvailable() || !userId) return;
    const wsUuid = toUuid(workspace.id);

    try {
      // 1. Insert/update workspace
      await supabase.from('workspaces').upsert({
        id: wsUuid,
        name: workspace.name,
        type: workspace.type,
        created_by: userId,
        currency: workspace.currency || 'BDT',
        description: workspace.description || '',
        settings: workspace.settings || {
          fiscal_year_start: '01-01',
          dateFormat: 'YYYY-MM-DD',
          enableAiReceipts: true,
        },
        updated_at: new Date().toISOString(),
      });

      // 2. Ensure owner membership
      await supabase.from('workspace_members').upsert({
        id: toUuid(`member_${wsUuid}_${userId}`),
        workspace_id: wsUuid,
        user_id: userId,
        role: 'owner',
        status: 'active',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync workspace error:', err);
    }
  }

  // 3. Sync Financial Account
  async syncAccount(account: FinancialAccount, workspaceId: string) {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('financial_accounts').upsert({
        id: toUuid(account.id),
        workspace_id: toUuid(workspaceId),
        name: account.name,
        account_type_id: account.account_type_id,
        provider: account.provider || 'Other',
        account_number_masked: account.account_number_masked || null,
        currency: account.currency || 'BDT',
        opening_balance: account.opening_balance || 0,
        opening_date: account.opening_date || new Date().toISOString().split('T')[0],
        current_balance_cached: account.current_balance_cached || 0,
        is_archived: Boolean(account.is_archived),
        icon: account.icon || 'wallet',
        color: account.color || '#0284c7',
        notes: account.notes || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync account error:', err);
    }
  }

  // 4. Sync Category
  async syncCategory(cat: Category, workspaceId: string) {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('categories').upsert({
        id: toUuid(cat.id),
        workspace_id: toUuid(workspaceId),
        name: cat.name,
        type: cat.type,
        accounting_classification: cat.accounting_classification || 'expense_operating',
        icon: cat.icon || 'tag',
        color: cat.color || '#64748b',
        is_seed: Boolean(cat.is_seed),
        is_archived: Boolean(cat.is_archived),
        sort_order: cat.sort_order || 0,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync category error:', err);
    }
  }

  // 5. Sync Journal Entry & Lines (Omit identity column 'entry_number')
  async syncJournalEntry(entry: JournalEntry, workspaceId: string, userId?: string) {
    if (!this.isAvailable()) return;
    const entryUuid = toUuid(entry.id);
    const wsUuid = toUuid(workspaceId);

    try {
      // Upsert transaction header
      await supabase.from('journal_entries').upsert({
        id: entryUuid,
        workspace_id: wsUuid,
        entry_date: entry.entry_date,
        memo: entry.memo,
        source_type: entry.source_type,
        source_id: entry.source_id || null,
        status: entry.status || 'posted',
        is_reversal: Boolean(entry.is_reversal),
        created_by: userId ? userId : null,
        updated_at: new Date().toISOString(),
      });

      // Upsert transaction debit/credit lines
      if (entry.lines && entry.lines.length > 0) {
        const linesPayload = entry.lines.map((l, i) => ({
          id: toUuid(l.id || `${entryUuid}_line_${i}`),
          journal_entry_id: entryUuid,
          workspace_id: wsUuid,
          account_id: toUuid(l.account_id),
          line_type: l.line_type,
          amount: l.amount,
          memo: l.memo || entry.memo,
          category_id: l.category_id ? toUuid(l.category_id) : null,
          counterparty: l.counterparty || null,
          tags: l.tags || [],
        }));

        await supabase.from('journal_lines').upsert(linesPayload);
      }
    } catch (err) {
      console.warn('Sync journal entry error:', err);
    }
  }

  // 6. Sync Credit Card
  async syncCreditCard(card: CreditCard, workspaceId: string) {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('credit_cards').upsert({
        id: toUuid(card.id),
        workspace_id: toUuid(workspaceId),
        account_id: toUuid(card.account_id),
        card_name: card.card_name,
        issuing_bank: card.issuing_bank,
        card_network: card.card_network || 'Visa',
        last_four_digits: card.last_four_digits,
        credit_limit: card.credit_limit,
        statement_day: card.statement_day,
        payment_due_day: card.payment_due_day,
        interest_rate_apr: card.interest_rate_apr || 0,
        annual_fee: card.annual_fee || 0,
        status: card.status || 'active',
        notes: card.notes || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync card error:', err);
    }
  }

  // 7. Sync Loan
  async syncLoan(loan: Loan, workspaceId: string) {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('loans').upsert({
        id: toUuid(loan.id),
        workspace_id: toUuid(workspaceId),
        type: loan.type,
        account_id: loan.account_id ? toUuid(loan.account_id) : null,
        title: loan.title,
        counterparty_name: loan.counterparty_name,
        counterparty_phone: loan.counterparty_phone || null,
        counterparty_relationship: loan.counterparty_relationship || null,
        principal_amount: loan.principal_amount,
        interest_rate: loan.interest_rate || 0,
        is_interest_bearing: Boolean(loan.is_interest_bearing),
        start_date: loan.start_date,
        maturity_date: loan.maturity_date || null,
        installment_frequency: loan.installment_frequency || 'monthly',
        installment_amount: loan.installment_amount || 0,
        total_principal_repaid: loan.total_principal_repaid || 0,
        total_interest_paid: loan.total_interest_paid || 0,
        status: loan.status || 'active',
        notes: loan.notes || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync loan error:', err);
    }
  }

  // 8. Sync Property
  async syncProperty(property: Property, workspaceId: string) {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('properties').upsert({
        id: toUuid(property.id),
        workspace_id: toUuid(workspaceId),
        property_code: property.property_code,
        name: property.name,
        category: property.category || 'Residential Plot',
        property_type: property.property_type || 'Freehold',
        original_size_description: property.original_size_description,
        normalized_size: property.normalized_size || null,
        measurement_unit: property.measurement_unit || 'Khara',
        original_ownership_description: property.original_ownership_description,
        normalized_ownership_percentage: property.normalized_ownership_percentage || null,
        ownership_uncertainty: Boolean(property.ownership_uncertainty),
        ownership_type: property.ownership_type || 'sole_member',
        location_address: property.location_address,
        district: property.district || null,
        mouza: property.mouza || null,
        khatian_number: property.khatian_number || null,
        dag_number: property.dag_number || null,
        acquisition_date: property.acquisition_date || null,
        acquisition_cost: property.acquisition_cost || null,
        current_market_valuation: property.current_market_valuation || 0,
        valuation_date: property.valuation_date || new Date().toISOString().split('T')[0],
        recovery_amount_required: property.recovery_amount_required || 0,
        expected_recovery_date: property.expected_recovery_date || null,
        actual_recovery_received: property.actual_recovery_received || 0,
        status: property.status || 'active',
        remarks: property.remarks || null,
        document_urls: property.document_urls || [],
        image_urls: property.image_urls || [],
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync property error:', err);
    }
  }

  // 9. Sync Budget
  async syncBudget(budget: Budget, workspaceId: string) {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('budgets').upsert({
        id: toUuid(budget.id),
        workspace_id: toUuid(workspaceId),
        category_id: toUuid(budget.category_id),
        period_type: budget.period_type || 'monthly',
        period_start: budget.period_start,
        period_end: budget.period_end,
        budget_amount: budget.budget_amount,
        alert_threshold_percentage: budget.alert_threshold_percentage || 80,
        notes: budget.notes || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync budget error:', err);
    }
  }

  // 10. Sync Savings Goal
  async syncSavingsGoal(goal: SavingsGoal, workspaceId: string) {
    if (!this.isAvailable()) return;
    try {
      await supabase.from('savings_goals').upsert({
        id: toUuid(goal.id),
        workspace_id: toUuid(workspaceId),
        account_id: goal.account_id ? toUuid(goal.account_id) : null,
        name: goal.name,
        goal_type: goal.goal_type || 'dps',
        target_amount: goal.target_amount,
        current_saved_amount: goal.current_saved_amount || 0,
        monthly_contribution: goal.monthly_contribution || 0,
        target_date: goal.target_date || null,
        expected_maturity_date: goal.expected_maturity_date || null,
        expected_return_rate: goal.expected_return_rate || 0,
        status: goal.status || 'active',
        notes: goal.notes || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync savings goal error:', err);
    }
  }

  // Hydrate all workspace entities from Supabase to local client
  async pullRemoteWorkspaceData(workspaceId: string) {
    if (!this.isAvailable()) return null;
    const wsUuid = toUuid(workspaceId);

    try {
      const [
        accountsRes, 
        categoriesRes, 
        cardsRes, 
        loansRes, 
        propertiesRes, 
        entriesRes,
        budgetsRes,
        goalsRes
      ] = await Promise.all([
        supabase.from('financial_accounts').select('*').eq('workspace_id', wsUuid),
        supabase.from('categories').select('*').eq('workspace_id', wsUuid),
        supabase.from('credit_cards').select('*').eq('workspace_id', wsUuid),
        supabase.from('loans').select('*').eq('workspace_id', wsUuid),
        supabase.from('properties').select('*').eq('workspace_id', wsUuid),
        supabase.from('journal_entries').select('*, lines:journal_lines(*)').eq('workspace_id', wsUuid),
        supabase.from('budgets').select('*').eq('workspace_id', wsUuid),
        supabase.from('savings_goals').select('*').eq('workspace_id', wsUuid),
      ]);

      return {
        accounts: accountsRes.data || [],
        categories: categoriesRes.data || [],
        cards: cardsRes.data || [],
        loans: loansRes.data || [],
        properties: propertiesRes.data || [],
        entries: entriesRes.data || [],
        budgets: budgetsRes.data || [],
        goals: goalsRes.data || [],
      };
    } catch (err) {
      console.warn('Pull remote data notice:', err);
      return null;
    }
  }
}

export const supabaseSync = new SupabaseSyncEngine();
